"""
Email campaign service — uses Resend (https://resend.com).
Install: pip install resend
Settings required: RESEND_API_KEY, RESEND_FROM_EMAIL
"""
import logging

import resend
from django.conf import settings
from django.utils import timezone

from ..models import EmailCampaign

logger = logging.getLogger(__name__)


def _get_user_model():
    from django.contrib.auth import get_user_model
    return get_user_model()


class EmailCampaignService:

    # ── Audience helpers ──────────────────────────────────────────────────────

    @staticmethod
    def get_audience_queryset(campaign: EmailCampaign):
        """Return the User queryset matching campaign.audience."""
        from datetime import timedelta
        User = _get_user_model()
        qs = User.objects.filter(is_active=True).exclude(email='')

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

    # ── Send ──────────────────────────────────────────────────────────────────

    @classmethod
    def send_campaign(cls, campaign: EmailCampaign) -> None:
        """Send the campaign to all recipients via Resend."""
        api_key = getattr(settings, 'RESEND_API_KEY', '')
        if not api_key:
            raise ValueError(
                'RESEND_API_KEY is not configured. '
                'Set it in backend/.env before sending email campaigns.'
            )

        resend.api_key = api_key
        from_email = getattr(settings, 'RESEND_FROM_EMAIL', 'noreply@yourdomain.com')

        recipients = cls.get_audience_queryset(campaign)
        campaign.status = 'sending'
        campaign.recipients_count = recipients.count()
        campaign.save(update_fields=['status', 'recipients_count'])

        delivered = 0
        bounced = 0

        # Build HTML (optionally prepend hidden preview text)
        html_body = campaign.html_body
        if campaign.preview_text:
            preview_span = (
                '<div style="display:none;max-height:0;overflow:hidden;'
                'mso-hide:all">'
                + campaign.preview_text
                + '&zwnj;&nbsp;' * 100
                + '</div>'
            )
            html_body = preview_span + html_body

        for user in recipients.iterator(chunk_size=200):
            email_addr = getattr(user, 'email', '') or ''
            if not email_addr:
                bounced += 1
                continue

            full_name = getattr(user, 'full_name', '') or getattr(user, 'username', '')

            try:
                params: resend.Emails.SendParams = {
                    'from': from_email,
                    'to': [email_addr],
                    'subject': campaign.subject,
                    'html': html_body,
                    # Tag every send with campaign_id so our webhook can route
                    # open/click/unsubscribe events back to the correct campaign.
                    'tags': [{'name': 'campaign_id', 'value': str(campaign.id)}],
                }
                # Personalise plain text if provided
                if campaign.plain_text_body:
                    params['text'] = campaign.plain_text_body.replace(
                        '{name}', full_name
                    )
                resend.Emails.send(params)
                delivered += 1
            except Exception as exc:
                logger.warning(
                    'Email delivery failed for user %s (%s): %s',
                    user.id, email_addr, exc
                )
                bounced += 1

        campaign.status = 'sent'
        campaign.sent_at = timezone.now()
        campaign.delivered_count = delivered
        campaign.bounced_count = bounced
        campaign.save(update_fields=['status', 'sent_at', 'delivered_count', 'bounced_count'])
        logger.info(
            'Email campaign %s sent: %d delivered, %d bounced',
            campaign.id, delivered, bounced
        )
