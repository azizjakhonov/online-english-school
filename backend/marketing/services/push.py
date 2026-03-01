"""
Push notification service.
- Expo: sends to Expo push token endpoint (https://exp.host/--/api/v2/push/send)
- Web:  placeholder — requires pywebpush (optional, uncomment when VAPID keys are set)

Settings required for Expo: EXPO_PUSH_URL (set by default)
Settings required for Web:  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_ADMIN_EMAIL
"""
import logging

import requests
from django.conf import settings
from django.utils import timezone

from ..models import PushCampaign, PushToken

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = getattr(settings, 'EXPO_PUSH_URL', 'https://exp.host/--/api/v2/push/send')
EXPO_BATCH_SIZE = 100   # Expo recommends <= 100 per request


def _get_user_model():
    from django.contrib.auth import get_user_model
    return get_user_model()


# ─── Audience helper ──────────────────────────────────────────────────────────

class PushCampaignService:

    @staticmethod
    def get_audience_token_queryset(campaign: PushCampaign):
        """Return PushToken queryset for the campaign's audience + platform."""
        from datetime import timedelta
        User = _get_user_model()

        # First, build the user queryset
        qs = User.objects.filter(is_active=True)
        audience = campaign.audience

        if audience == 'students':
            qs = qs.filter(role__iexact='student')
        elif audience == 'teachers':
            qs = qs.filter(role__iexact='teacher')
        elif audience == 'inactive_students':
            cutoff = timezone.now() - timedelta(days=30)
            qs = qs.filter(role__iexact='student', last_login__lt=cutoff)
        elif audience == 'new_signups':
            cutoff = timezone.now() - timedelta(days=7)
            qs = qs.filter(date_joined__gte=cutoff)
        elif audience == 'paid_students':
            from payments.models import Payment
            paid_ids = (
                Payment.objects
                .filter(status='succeeded')
                .values_list('student_id', flat=True)
                .distinct()
            )
            qs = qs.filter(role__iexact='student', id__in=paid_ids)
        elif audience == 'free_students':
            from payments.models import Payment
            paid_ids = (
                Payment.objects
                .filter(status='succeeded')
                .values_list('student_id', flat=True)
                .distinct()
            )
            qs = qs.filter(role__iexact='student').exclude(id__in=paid_ids)
        # 'all' → full user queryset

        # Filter tokens to matching users + active tokens + platform
        token_qs = PushToken.objects.filter(
            user__in=qs,
            is_active=True,
        )
        if campaign.platform == 'mobile':
            token_qs = token_qs.filter(platform='expo')
        elif campaign.platform == 'web':
            token_qs = token_qs.filter(platform='web')
        # 'all' → both platforms

        return token_qs

    @classmethod
    def send_campaign(cls, campaign: PushCampaign) -> None:
        """Send push notifications to all matching token holders."""
        token_qs = cls.get_audience_token_queryset(campaign)

        campaign.status = 'sending'
        campaign.recipients_count = token_qs.count()
        campaign.save(update_fields=['status', 'recipients_count'])

        expo_tokens = []
        web_tokens  = []

        for pt in token_qs.iterator(chunk_size=200):
            if pt.platform == 'expo':
                expo_tokens.append(pt.token)
            else:
                web_tokens.append(pt.token)

        delivered = 0
        failed    = 0

        # ── Expo ──────────────────────────────────────────────────────────────
        for i in range(0, len(expo_tokens), EXPO_BATCH_SIZE):
            batch = expo_tokens[i:i + EXPO_BATCH_SIZE]
            messages = [
                {
                    'to':    token,
                    'title': campaign.title,
                    'body':  campaign.body,
                    'data':  {'deep_link': campaign.deep_link} if campaign.deep_link else {},
                    'sound': 'default',
                    **(({'image': campaign.image_url}) if campaign.image_url else {}),
                }
                for token in batch
            ]
            try:
                resp = requests.post(
                    EXPO_PUSH_URL,
                    json=messages,
                    headers={'Content-Type': 'application/json', 'Accept': 'application/json'},
                    timeout=30,
                )
                resp.raise_for_status()
                results = resp.json().get('data', [])
                for r in results:
                    if r.get('status') == 'ok':
                        delivered += 1
                    else:
                        failed += 1
                        if r.get('details', {}).get('error') == 'DeviceNotRegistered':
                            # Mark token inactive
                            PushToken.objects.filter(token=r.get('id', ''), platform='expo').update(is_active=False)
            except Exception as exc:
                logger.error('Expo push batch failed: %s', exc)
                failed += len(batch)

        # ── Web push (placeholder) ─────────────────────────────────────────
        # Uncomment once pywebpush is installed and VAPID keys are configured.
        # from pywebpush import webpush, WebPushException
        # vapid_private = getattr(settings, 'WEB_PUSH_VAPID_PRIVATE_KEY', '')
        # vapid_email   = getattr(settings, 'WEB_PUSH_VAPID_ADMIN_EMAIL', '')
        # for sub_info in web_tokens:
        #     try:
        #         webpush(subscription_info=json.loads(sub_info), ...)
        #         delivered += 1
        #     except WebPushException:
        #         failed += 1

        if web_tokens:
            logger.info('Web push: %d tokens skipped (pywebpush not configured)', len(web_tokens))

        campaign.status = 'sent'
        campaign.sent_at = timezone.now()
        campaign.delivered_count = delivered
        campaign.save(update_fields=['status', 'sent_at', 'delivered_count'])
        logger.info(
            'Push campaign %s sent: %d delivered, %d failed',
            campaign.id, delivered, failed,
        )
