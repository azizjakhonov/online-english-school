from datetime import timedelta
from django.utils import timezone
from django.core import signing
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.conf import settings
from accounts.models import UserIdentity
from .models import TelegramAccount, TelegramLoginToken
from .telegram_utils import verify_telegram_data

User = get_user_model()

def get_auth_response(user):
    """Generates JWT tokens and returns a standardized auth response."""
    refresh = RefreshToken.for_user(user)
    is_new = user.role == User.Roles.NEW or not user.full_name
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
        'role': user.role,
        'is_new_user': is_new,
    }


def _make_social_token(tg_id, first_name, last_name, username):
    """Return a signed token the client passes back during OTP verification."""
    return signing.dumps({
        'provider': 'telegram',
        'provider_id': str(tg_id),
        'first_name': first_name or '',
        'last_name': last_name or '',
        'username': username or '',
    })


class TelegramWebVerifyView(APIView):
    """Verifies Telegram Login Widget payload from the web frontend."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        data = request.data
        success, message = verify_telegram_data(data)
        if not success:
            return Response({'error': message}, status=status.HTTP_400_BAD_REQUEST)

        tg_id = str(data.get('id'))
        username = data.get('username')
        first_name = data.get('first_name')
        last_name = data.get('last_name')
        photo_url = data.get('photo_url')

        # 1. Check existing UserIdentity (new system) or legacy TelegramAccount
        try:
            identity = UserIdentity.objects.select_related('user').get(
                provider='telegram', provider_id=tg_id
            )
            user = identity.user
            # Keep legacy TelegramAccount in sync if it exists
            TelegramAccount.objects.filter(telegram_id=tg_id).update(
                username=username, first_name=first_name,
                last_name=last_name, photo_url=photo_url,
            )
            return Response(get_auth_response(user))
        except UserIdentity.DoesNotExist:
            pass

        # Legacy TelegramAccount fallback (pre-202 users)
        try:
            tg_account = TelegramAccount.objects.get(telegram_id=tg_id)
            user = tg_account.user
            # Upgrade: create the canonical UserIdentity record
            UserIdentity.objects.get_or_create(
                provider='telegram', provider_id=tg_id,
                defaults={'user': user},
            )
            tg_account.username = username
            tg_account.first_name = first_name
            tg_account.last_name = last_name
            tg_account.photo_url = photo_url
            tg_account.save()
            return Response(get_auth_response(user))
        except TelegramAccount.DoesNotExist:
            pass

        # 2. New Telegram user — phone required
        social_token = _make_social_token(tg_id, first_name, last_name, username)
        return Response(
            {
                'detail': 'Phone verification required',
                'social_token': social_token,
            },
            status=status.HTTP_202_ACCEPTED,
        )


class TelegramMobileStartView(APIView):
    """Initializes a mobile login request and returns the bot URL."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        # Rate limiting should be handled by DRF Throttling in production
        expires_at = timezone.now() + timedelta(minutes=5)
        token_obj = TelegramLoginToken.objects.create(expires_at=expires_at)
        
        bot_username = settings.TELEGRAM_BOT_USERNAME
        tg_url = f"https://t.me/{bot_username}?start={token_obj.token}"
        
        return Response({
            'token': str(token_obj.token),
            'tg_url': tg_url
        })


class TelegramMobileStatusView(APIView):
    """Polling endpoint for mobile app to check login status."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        token_str = request.query_params.get('token')
        if not token_str:
            return Response({'error': 'Token required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            token_obj = TelegramLoginToken.objects.get(token=token_str)
        except TelegramLoginToken.DoesNotExist:
            return Response({'error': 'Invalid token'}, status=status.HTTP_404_NOT_FOUND)

        if token_obj.is_expired:
            return Response({'error': 'Token expired'}, status=status.HTTP_410_GONE)

        if token_obj.verified_at:
            if token_obj.used_at:
                return Response({'error': 'Token already used'}, status=status.HTTP_400_BAD_REQUEST)

            tg_id = str(token_obj.telegram_id)

            # Check existing UserIdentity (new system) or legacy TelegramAccount
            try:
                identity = UserIdentity.objects.select_related('user').get(
                    provider='telegram', provider_id=tg_id
                )
                user = identity.user
                token_obj.used_at = timezone.now()
                token_obj.save()
                return Response(get_auth_response(user))
            except UserIdentity.DoesNotExist:
                pass

            # Legacy TelegramAccount fallback
            try:
                tg_account = TelegramAccount.objects.get(telegram_id=token_obj.telegram_id)
                user = tg_account.user
                UserIdentity.objects.get_or_create(
                    provider='telegram', provider_id=tg_id,
                    defaults={'user': user},
                )
                token_obj.used_at = timezone.now()
                token_obj.save()
                return Response(get_auth_response(user))
            except TelegramAccount.DoesNotExist:
                pass

            # New Telegram user — phone required; keep token open so client can retry
            social_token = _make_social_token(
                tg_id,
                token_obj.first_name,
                token_obj.last_name,
                token_obj.telegram_username,
            )
            return Response(
                {
                    'detail': 'Phone verification required',
                    'social_token': social_token,
                },
                status=status.HTTP_202_ACCEPTED,
            )

        return Response({'status': 'pending'})


class TelegramWebhookView(APIView):
    """Handles incoming bot updates from Telegram."""
    permission_classes = [permissions.AllowAny]

    def post(self, request, secret):
        if secret != settings.TELEGRAM_WEBHOOK_SECRET:
            return Response({'error': 'Unauthorized'}, status=403)

        update = request.data
        message = update.get('message', {})
        text = message.get('text', '')

        if text.startswith('/start '):
            token_str = text.split(' ')[1]
            try:
                token_obj = TelegramLoginToken.objects.get(token=token_str)
                if token_obj.is_valid:
                    user_info = message.get('from', {})
                    token_obj.verified_at = timezone.now()
                    token_obj.telegram_id = user_info.get('id')
                    token_obj.telegram_username = user_info.get('username')
                    token_obj.first_name = user_info.get('first_name')
                    token_obj.last_name = user_info.get('last_name')
                    token_obj.raw_update = update
                    token_obj.save()
                    
                    # Optional: send message back to user in TG
                    # requests.post(f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage", ...)
            except TelegramLoginToken.DoesNotExist:
                pass

        return Response({'ok': True})
