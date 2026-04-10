"""
Marketing campaign tasks.

These are plain functions right now — no Celery required.
To enable async/scheduled sending, install Celery and wrap each
function with @shared_task (or call them from celery.shared_task).

Usage (synchronous, from a ViewSet action):
    from marketing.tasks import send_email_campaign
    send_email_campaign(campaign_id)

Usage (with Celery, once configured):
    from marketing.tasks import send_email_campaign
    send_email_campaign.delay(campaign_id)
"""
import logging

logger = logging.getLogger(__name__)


# ─── Email ────────────────────────────────────────────────────────────────────

def send_email_campaign(campaign_id: int) -> None:
    """Send a single email campaign by ID."""
    from .models import EmailCampaign
    from .services.email import EmailCampaignService

    campaign = EmailCampaign.objects.get(id=campaign_id)
    EmailCampaignService.send_campaign(campaign)


# ─── SMS ──────────────────────────────────────────────────────────────────────

def send_sms_campaign(campaign_id: int) -> None:
    """Send a single SMS campaign by ID."""
    from .models import SmsCampaign
    from .services.sms import SmsCampaignService

    campaign = SmsCampaign.objects.get(id=campaign_id)
    SmsCampaignService.send_campaign(campaign)


# ─── Push ─────────────────────────────────────────────────────────────────────

def send_push_campaign(campaign_id: int) -> None:
    """Send a single push notification campaign by ID."""
    from .models import PushCampaign
    from .services.push import PushCampaignService

    campaign = PushCampaign.objects.get(id=campaign_id)
    PushCampaignService.send_campaign(campaign)


# ─── Scheduler (run every 5 min via cron / management command) ────────────────

def send_scheduled_campaigns() -> None:
    """
    Fire any campaigns whose scheduled_at has passed and are still 'scheduled'.
    Call this from a cron job or management command until Celery beat is set up.
    """
    from django.utils import timezone
    from .models import EmailCampaign, SmsCampaign

    now = timezone.now()

    for campaign in EmailCampaign.objects.filter(status='scheduled', scheduled_at__lte=now):
        try:
            send_email_campaign(campaign.id)
        except Exception as exc:
            logger.error('Failed to send email campaign %s: %s', campaign.id, exc)

    for campaign in SmsCampaign.objects.filter(status='scheduled', scheduled_at__lte=now):
        try:
            send_sms_campaign(campaign.id)
        except Exception as exc:
            logger.error('Failed to send SMS campaign %s: %s', campaign.id, exc)

    from .models import PushCampaign
    for campaign in PushCampaign.objects.filter(status='scheduled', scheduled_at__lte=now):
        try:
            send_push_campaign(campaign.id)
        except Exception as exc:
            logger.error('Failed to send push campaign %s: %s', campaign.id, exc)


# ─── Daily metrics snapshot ───────────────────────────────────────────────────

def snapshot_daily_metrics() -> None:
    """
    Aggregate yesterday's key metrics into MarketingMetricsSnapshot.
    Run daily at midnight via cron / management command.
    """
    from datetime import timedelta

    from django.db.models import Sum
    from django.utils import timezone

    from accounts.models import User
    from payments.models import Payment
    from scheduling.models import Lesson
    from .models import MarketingMetricsSnapshot

    today = timezone.now().date()
    yesterday = today - timedelta(days=1)

    snap, _ = MarketingMetricsSnapshot.objects.get_or_create(date=yesterday)

    snap.new_signups = User.objects.filter(date_joined__date=yesterday).count()
    snap.new_students = User.objects.filter(
        role__iexact='student', date_joined__date=yesterday
    ).count()
    snap.new_teachers = User.objects.filter(
        role__iexact='teacher', date_joined__date=yesterday
    ).count()
    snap.total_users = User.objects.count()

    snap.revenue_total = (
        Payment.objects
        .filter(status='succeeded', created_at__date=yesterday)
        .aggregate(t=Sum('amount_uzs'))['t'] or 0
    )

    snap.lessons_booked = Lesson.objects.filter(created_at__date=yesterday).count()
    snap.lessons_completed = Lesson.objects.filter(
        status='COMPLETED', start_time__date=yesterday
    ).count()

    # Active students: logged in within the last 30 days
    from django.utils import timezone as tz
    thirty_days_ago = tz.now() - timedelta(days=30)
    snap.active_students_30d = User.objects.filter(
        role='STUDENT', last_login__gte=thirty_days_ago
    ).count()

    # CAC: requires ad-spend data. Left at 0 until an ad-spend input model is added.
    # To set manually: MarketingMetricsSnapshot.objects.filter(date=yesterday).update(cac=<value>)
    if not snap.cac:
        snap.cac = 0

    snap.save()
    logger.info('Daily metrics snapshot saved for %s', yesterday)
