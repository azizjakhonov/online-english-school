import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics, permissions
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core import signing
from django.conf import settings as django_settings
from .models import PhoneOTP, StudentProfile, User, UserIdentity
from .utils import generate_otp
from .serializers import UserSerializer
from .services.devsms import DevSmsService
import time
import os

logger = logging.getLogger(__name__)
User = get_user_model()  # keep as canonical reference throughout file

class SendOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        phone = request.data.get('phone')
        if not phone:
            return Response({'error': 'Phone number is required'}, status=status.HTTP_400_BAD_REQUEST)

        otp = generate_otp()

        PhoneOTP.objects.update_or_create(
            phone_number=phone,
            defaults={'otp': otp}
        )

        message = f"Allright.uz код подтверждения для регистрации на сайт: {otp}"
        sms_result = DevSmsService().send_sms(phone, message)

        if not sms_result.get('success'):
            logger.error("DevSms failed for %s: %s", phone, sms_result)
            return Response(
                {'error': 'Failed to send SMS. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({'message': 'OTP sent successfully'})


class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        phone = request.data.get('phone')
        code = request.data.get('code')
        social_token = request.data.get('social_token')  # optional — links a social identity

        # 1. Check OTP
        try:
            otp_record = PhoneOTP.objects.get(phone_number=phone)
        except PhoneOTP.DoesNotExist:
            return Response({'error': 'Invalid phone number'}, status=status.HTTP_400_BAD_REQUEST)

        if otp_record.otp != code:
            return Response({'error': 'Invalid code'}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Get or Create User
        user, created = User.objects.get_or_create(phone_number=phone)

        # 3. Link social identity if a signed social_token was provided
        if social_token:
            try:
                payload = signing.loads(social_token, max_age=600)  # 10-minute window
                provider = payload['provider']
                provider_id = str(payload['provider_id'])
                identity, _ = UserIdentity.objects.get_or_create(
                    provider=provider,
                    provider_id=provider_id,
                    defaults={'user': user},
                )
                if identity.user_id != user.pk:
                    logger.warning(
                        'social_token %s:%s already linked to user %s; ignoring for user %s',
                        provider, provider_id, identity.user_id, user.pk,
                    )
            except signing.BadSignature:
                return Response({'error': 'Invalid or expired social_token'}, status=status.HTTP_400_BAD_REQUEST)
            except (KeyError, TypeError):
                return Response({'error': 'Malformed social_token payload'}, status=status.HTTP_400_BAD_REQUEST)

        # 4. Generate Tokens
        refresh = RefreshToken.for_user(user)

        # 5. Check if onboarding is needed
        is_new = created or user.role == 'NEW' or not user.full_name

        # Clear OTP after success
        otp_record.delete()

        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'role': user.role,
            'is_new_user': is_new
        })


class SelectRoleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        role = request.data.get('role') # 'student' or 'teacher'
        full_name = request.data.get('full_name')

        if role not in ['student', 'teacher']:
            return Response({'error': 'Invalid role'}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        user.full_name = full_name
        
        # Update Role (Case insensitive mapping)
        if role == 'student':
            user.role = User.Roles.STUDENT
        elif role == 'teacher':
            user.role = User.Roles.TEACHER
        
        user.save()
        
        # Signal will automatically create Profile
        return Response({'message': 'Setup complete'})
    
class MockPurchaseCreditsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        package_id = request.data.get('packageId')
        
        packages = {
            1: 5,   # ID 1 = 5 credits
            2: 20,  # ID 2 = 20 credits
            3: 50,  # ID 3 = 50 credits
        }
        
        credits_to_add = packages.get(package_id)
        
        if not credits_to_add:
            return Response({"error": "Invalid package selected"}, status=400)

        # Simulate processing delay
        time.sleep(1.5) 

        try:
            # ✅ Now this will work because StudentProfile is imported
            profile, created = StudentProfile.objects.get_or_create(user=request.user)
            
            profile.lesson_credits += credits_to_add
            profile.save()
            
            return Response({
                "message": "Payment successful (Demo)",
                "credits_added": credits_to_add,
                "new_balance": profile.lesson_credits
            })
        except Exception as e:
            return Response({"error": str(e)}, status=500)
class AddCreditsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role != User.Roles.STUDENT:
            return Response({'error': 'Only students can have a balance'}, status=400)

        amount = request.data.get('amount')
        if not amount or float(amount) <= 0:
            return Response({'error': 'Invalid amount'}, status=400)

        profile = user.student_profile
        # Atomic update is better for balances
        profile.lesson_credits += float(amount)
        profile.save()

        return Response({
            'message': f'Successfully added {amount} credits.',
            'new_balance': profile.lesson_credits
        })
    

class ManageUserView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    # THIS LINE IS CRITICAL: Without it, files are ignored in PATCH requests
    parser_classes = [MultiPartParser, FormParser]

    def get_object(self):
        return self.request.user


# ============================================================
# AVATAR UPLOAD
# ============================================================
AVATAR_MAX_BYTES = 5 * 1024 * 1024          # 5 MB
AVATAR_ALLOWED_TYPES = {'image/jpeg', 'image/png', 'image/webp'}
AVATAR_SIZE = (400, 400)                     # resize target


class AvatarUploadView(APIView):
    """
    PATCH /api/accounts/avatar/
    Accepts multipart/form-data with field 'avatar' (or legacy 'profile_picture').
    Validates type (jpeg/png/webp) and size (<= 5 MB).
    Resizes to 400x400 using Pillow, saves, deletes old file.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def patch(self, request):
        # Log which DB and host are serving this request
        _db = django_settings.DATABASES['default']['NAME']
        logger.debug("[AvatarUpload] DB=%r  HOST=%r", _db, request.get_host())

        # Accept both 'avatar' (preferred) and 'profile_picture' (legacy key)
        avatar_file = request.FILES.get('avatar') or request.FILES.get('profile_picture')
        if not avatar_file:
            return Response(
                {'error': 'No file received. Send a multipart/form-data request with field "avatar".'},
                status=400,
            )

        # --- Validate content type ---
        content_type = avatar_file.content_type
        if content_type not in AVATAR_ALLOWED_TYPES:
            return Response(
                {'error': f'Unsupported file type "{content_type}". Allowed: jpeg, png, webp.'},
                status=400
            )

        # --- Validate size ---
        if avatar_file.size > AVATAR_MAX_BYTES:
            mb = avatar_file.size / (1024 * 1024)
            return Response(
                {'error': f'Image too large ({mb:.1f} MB). Maximum allowed size is 5 MB.'},
                status=400,
            )

        user = request.user

        # --- Delete old file from disk ---
        if user.profile_picture:
            old_path = user.profile_picture.path
            if os.path.isfile(old_path):
                os.remove(old_path)

        # --- Resize with Pillow and save ---
        try:
            from PIL import Image
            import io
            img = Image.open(avatar_file)
            img = img.convert('RGB')          # normalise (handles RGBA png etc.)
            img.thumbnail(AVATAR_SIZE, Image.LANCZOS)  # maintains aspect ratio

            buf = io.BytesIO()
            img.save(buf, format='JPEG', quality=88)
            buf.seek(0)

            filename = f'avatar_{user.id}.jpg'
            user.profile_picture.save(filename, ContentFile(buf.read()), save=True)
        except Exception as e:
            return Response({'error': f'Image processing failed: {e}'}, status=500)

        url = request.build_absolute_uri(user.profile_picture.url) if user.profile_picture else None
        return Response({'profile_picture_url': url, 'detail': 'Avatar updated successfully.'}, status=200)