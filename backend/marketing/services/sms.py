"""
SMS campaign service — uses Eskiz.uz REST API directly.
Docs: https://documenter.getpostman.com/view/663428/TVK5eMco
Settings required: ESKIZ_EMAIL, ESKIZ_PASSWORD, ESKIZ_NICKNAME
"""
import logging

import requests
from django.conf import settings
from django.utils import timezone

from ..models import SmsCampaign

logger = logging.getLogger(__name__)

ESKIZ_BASE = 'https://notify.eskiz.uz/api'
ESKIZ_TIMEOUT = 15  # seconds


def _get_user_model():
    from django.contrib.auth import get_user_model
    return get_user_model()


# ─── Low-level Eskiz HTTP client ─────────────────────────────────────────────

class EskizClient:
    """
    Thin stateless wrapper around the Eskiz.uz SMS REST API.
    Obtains a JWT token on first use and refreshes on 401.
    """

    _token: str | None = None

    @classmethod
    def _login(cls) -> str:
        resp = requests.post(
            f'{ESKIZ_BASE}/auth/login',
            data={
                'email': settings.ESKIZ_EMAIL,
                'password': settings.ESKIZ_PASSWORD,
            },
            timeout=ESKIZ_TIMEOUT,
        )
        resp.raise_for_status()
        token = resp.json()['data']['token']
        cls._token = token
        return token

    @classmethod
    def _get_token(cls) -> str:
        return cls._token or cls._login()

    @classmethod
    def _invalidate(cls) -> None:
        cls._token = None

    @classmethod
    def send_sms(cls, mobile_phone: str, message: str, sender: str = '') -> bool:
        """
        Send a single SMS.  Returns True on success.
        Retries once if the token has expired (HTTP 401).
        """
        from_name = sender or getattr(settings, 'ESKIZ_NICKNAME', '') or '4546'

        for attempt in range(2):
            token = cls._get_token()
            try:
                resp = requests.post(
                    f'{ESKIZ_BASE}/message/sms/send',
                    headers={'Authorization': f'Bearer {token}'},
                    data={
                        'mobile_phone': mobile_phone,
                        'message': message,
                        'from': from_name,
                        'callback_url': '',
                    },
                    timeout=ESKIZ_TIMEOUT,
                )
            except requests.RequestException as exc:
                logger.error('Eskiz network error: %s', exc)
                return False

            if resp.status_code == 401 and attempt == 0:
                # Token expired — re-authenticate and retry
                cls._invalidate()
                continue

            if resp.status_code in (200, 201):
                return True

            logger.warning(
                'Eskiz rejected SMS to %s: HTTP %s — %s',
                mobile_phone, resp.status_code, resp.text[:200]
            )
            return False

        return False

    @classmethod
    def refresh_token(cls) -> str:
        """Force a token refresh (e.g. call from a management command)."""
        cls._invalidate()
        return cls._login()


# ─── Campaign service ─────────────────────────────────────────────────────────

class SmsCampaignService:

    @staticmethod
    def get_audience_queryset(campaign: SmsCampaign):
        """Return the User queryset matching campaign.audience."""
        from datetime import timedelta
        User = _get_user_model()
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
        # 'all' and 'custom' → full queryset
        return qs

    @classmethod
    def send_campaign(cls, campaign: SmsCampaign) -> None:
        """Send the campaign to all recipients via Eskiz."""
        if not getattr(settings, 'ESKIZ_EMAIL', '') or not getattr(settings, 'ESKIZ_PASSWORD', ''):
            raise ValueError(
                'ESKIZ_EMAIL and ESKIZ_PASSWORD are not configured. '
                'Set them in backend/.env before sending SMS campaigns.'
            )

        recipients = cls.get_audience_queryset(campaign)
        campaign.status = 'sending'
        campaign.recipients_count = recipients.count()
        campaign.save(update_fields=['status', 'recipients_count'])

        delivered = 0
        failed = 0

        for user in recipients.iterator(chunk_size=200):
            # phone_number is the login field for this project
            phone = getattr(user, 'phone_number', None)
            if not phone:
                failed += 1
                continue

            # Normalise: strip leading +, spaces, dashes
            phone_str = str(phone).replace('+', '').replace(' ', '').replace('-', '')
            if not phone_str:
                failed += 1
                continue

            try:
                success = EskizClient.send_sms(phone_str, campaign.message)
                if success:
                    delivered += 1
                else:
                    failed += 1
            except Exception as exc:
                logger.warning(
                    'SMS delivery failed for user %s (%s): %s',
                    user.id, phone_str, exc
                )
                failed += 1

        campaign.status = 'sent'
        campaign.sent_at = timezone.now()
        campaign.delivered_count = delivered
        campaign.failed_count = failed
        campaign.save(update_fields=['status', 'sent_at', 'delivered_count', 'failed_count'])
        logger.info(
            'SMS campaign %s sent: %d delivered, %d failed',
            campaign.id, delivered, failed
        )
