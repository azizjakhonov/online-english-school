"""
accounts/dashboard.py  – Unfold admin dashboard callback.
Called via UNFOLD["DASHBOARD_CALLBACK"] = "accounts.dashboard.dashboard_callback".
Injects KPI stats and integrity alerts into the /admin/ home page.
"""
from django.utils import timezone
from django.db.models import Sum, Q


def dashboard_callback(request, context):
    from django.contrib.auth import get_user_model
    from scheduling.models import Lesson
    from payments.models import Payment
    from accounts.models import EarningsEvent, TeacherProfile

    User = get_user_model()

    now       = timezone.now()
    # localdate() returns the date in the active timezone (Asia/Tashkent by default),
    # not the UTC date. This matters at midnight: UTC midnight ≠ Tashkent midnight.
    today     = timezone.localdate()
    week_ago  = today - timezone.timedelta(days=7)
    month_ago = today - timezone.timedelta(days=30)
    day_ago   = now   - timezone.timedelta(hours=24)

    # ── STUDENTS ──────────────────────────────────────────────────────
    students_qs = User.objects.filter(role='STUDENT')
    kpi_students = {
        'total':       students_qs.count(),
        'new_today':   students_qs.filter(date_joined__date=today).count(),
        'new_week':    students_qs.filter(date_joined__date__gte=week_ago).count(),
        'active_30d':  students_qs.filter(last_login__date__gte=month_ago).count(),
        'inactive_14': students_qs.filter(
            Q(last_login__isnull=True) | Q(last_login__date__lt=today - timezone.timedelta(days=14))
        ).count(),
    }

    # ── LESSONS ───────────────────────────────────────────────────────
    lessons_qs = Lesson.objects
    kpi_lessons = {
        'scheduled_today': lessons_qs.filter(
            lesson_date=today, status__in=['PENDING', 'CONFIRMED']
        ).count(),
        'completed_today':  lessons_qs.filter(lesson_date=today, status='COMPLETED').count(),
        'cancelled_today':  lessons_qs.filter(lesson_date=today, status='CANCELLED').count(),
        'absent_today':     lessons_qs.filter(lesson_date=today, status='STUDENT_ABSENT').count(),
        'completed_week':   lessons_qs.filter(lesson_date__gte=week_ago, status='COMPLETED').count(),
        'completed_month':  lessons_qs.filter(lesson_date__gte=month_ago, status='COMPLETED').count(),
    }

    # ── REVENUE (UZS, succeeded payments only) ─────────────────────────
    def _uzs(qs):
        return int(qs.aggregate(t=Sum('amount_uzs'))['t'] or 0)

    succeeded = Payment.objects.filter(status='succeeded')
    kpi_revenue = {
        'today': _uzs(succeeded.filter(created_at__date=today)),
        'week':  _uzs(succeeded.filter(created_at__date__gte=week_ago)),
        'month': _uzs(succeeded.filter(created_at__date__gte=month_ago)),
    }

    # ── CREDITS ────────────────────────────────────────────────────────
    def _credits(qs):
        return int(qs.aggregate(t=Sum('credits_amount'))['t'] or 0)

    kpi_credits = {
        'sold_today':     _credits(succeeded.filter(created_at__date=today)),
        'sold_week':      _credits(succeeded.filter(created_at__date__gte=week_ago)),
        'sold_month':     _credits(succeeded.filter(created_at__date__gte=month_ago)),
        'consumed_today': lessons_qs.filter(lesson_date=today, credits_consumed=True).count(),
        'consumed_week':  lessons_qs.filter(lesson_date__gte=week_ago, credits_consumed=True).count(),
    }

    # ── TEACHER PAYOUTS ───────────────────────────────────────────────
    earned = int(EarningsEvent.objects.filter(
        event_type='lesson_credit').aggregate(t=Sum('amount_uzs'))['t'] or 0)
    paid   = abs(int(EarningsEvent.objects.filter(
        event_type='payout').aggregate(t=Sum('amount_uzs'))['t'] or 0))
    kpi_teachers = {
        'with_lessons_today': lessons_qs.filter(lesson_date=today)
                              .values('teacher').distinct().count(),
        'pending_payout_uzs': max(0, earned - paid),
    }

    # ── ALERTS ────────────────────────────────────────────────────────
    alerts = []

    # 1. Students with 0 credits + upcoming lesson
    zero_credit_upcoming = (
        Lesson.objects
        .filter(lesson_date__gte=today, status__in=['PENDING', 'CONFIRMED'])
        .filter(student__student_profile__lesson_credits=0)
        .select_related('student')
        .values('student__phone_number', 'student__full_name')[:10]
    )
    if zero_credit_upcoming:
        names = ', '.join(
            row.get('student__full_name') or row.get('student__phone_number', '?')
            for row in zero_credit_upcoming
        )
        alerts.append({
            'level': 'danger',
            'icon': '💳',
            'message': f"{zero_credit_upcoming.count()} student(s) have 0 credits but upcoming lessons: {names}",
        })

    # 2. Teachers with rate = 0
    zero_rate_count = TeacherProfile.objects.filter(rate_per_lesson_uzs=0).count()
    if zero_rate_count:
        alerts.append({
            'level': 'warning',
            'icon': '⚠️',
            'message': f"{zero_rate_count} teacher(s) have rate_per_lesson_uzs = 0.",
        })

    # 3. Completed lessons missing EarningsEvent
    completed_ids = set(Lesson.objects.filter(status='COMPLETED').values_list('id', flat=True))
    credited_ids  = set(EarningsEvent.objects.filter(
        event_type='lesson_credit').values_list('lesson_id', flat=True))
    missing = completed_ids - credited_ids
    if missing:
        alerts.append({
            'level': 'warning',
            'icon': '🔍',
            'message': f"{len(missing)} completed lesson(s) missing an EarningsEvent. IDs: {sorted(missing)[:10]}",
        })

    # 4. Payment failures last 24h
    failures_24h = Payment.objects.filter(status='failed', created_at__gte=day_ago).count()
    if failures_24h:
        alerts.append({
            'level': 'danger',
            'icon': '❌',
            'message': f"{failures_24h} payment failure(s) in the last 24 hours.",
        })

    context.update({
        'kpi_students': kpi_students,
        'kpi_lessons':  kpi_lessons,
        'kpi_revenue':  kpi_revenue,
        'kpi_credits':  kpi_credits,
        'kpi_teachers': kpi_teachers,
        'dashboard_alerts': alerts,
    })
    return context