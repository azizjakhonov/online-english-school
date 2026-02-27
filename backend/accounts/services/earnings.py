"""
accounts/services/earnings.py

Shared financial computation for teacher earnings.
Used by both TeacherSettingsView and TeacherEarningsSummaryView so that
the numbers are always consistent regardless of which endpoint the caller uses.

All amounts returned as plain Python int (UZS, no decimals).
"""
from __future__ import annotations

from django.utils import timezone


def compute_teacher_financials(teacher_user) -> dict:
    """
    Return a dict of financial metrics for the given teacher (User instance).

    Keys returned:
        rate_per_lesson_uzs          int
        payout_day                   int (1-28)
        period_start                 str  ISO date
        next_payout_date             str  ISO date
        current_period_earned_uzs    int
        pending_payout_uzs           int
        total_earned_uzs             int
        total_paid_uzs               int
        completed_lessons_count      int
        payout_history               list[dict]  (up to 20, newest first)
    """
    from accounts.models import EarningsEvent

    # ── Profile / payout config ─────────────────────────────────────────────────
    profile = getattr(teacher_user, 'teacher_profile', None)
    payout_day = int(profile.payout_day) if profile and profile.payout_day else 25

    # localdate() uses the active timezone (set per-request by UserTimezoneMiddleware,
    # defaulting to Asia/Tashkent). Replaces the naive date.today() call.
    today = timezone.localdate()

    # ── Payout period boundaries ────────────────────────────────────────────────
    if today.day >= payout_day:
        period_start = today.replace(day=payout_day)
    else:
        if today.month == 1:
            period_start = today.replace(year=today.year - 1, month=12, day=payout_day)
        else:
            period_start = today.replace(month=today.month - 1, day=payout_day)

    if today.day < payout_day:
        next_payout = today.replace(day=payout_day)
    else:
        if today.month == 12:
            next_payout = today.replace(year=today.year + 1, month=1, day=payout_day)
        else:
            next_payout = today.replace(month=today.month + 1, day=payout_day)

    # ── Aggregate queries (2 queries total) ─────────────────────────────────────
    from django.db.models import Sum

    events = EarningsEvent.objects.filter(teacher=teacher_user)
    CREDIT_TYPES = ['lesson_credit', 'adjustment', 'correction']

    agg = events.filter(event_type__in=CREDIT_TYPES, amount_uzs__gt=0).aggregate(
        total=Sum('amount_uzs')
    )
    total_earned = int(agg['total'] or 0)

    agg_period = events.filter(
        event_type__in=CREDIT_TYPES,
        amount_uzs__gt=0,
        created_at__date__gte=period_start,
    ).aggregate(total=Sum('amount_uzs'))
    current_period_earned = int(agg_period['total'] or 0)

    agg_paid = events.filter(event_type='payout').aggregate(total=Sum('amount_uzs'))
    # Use abs() so this works whether admin enters payouts as positive or negative amounts.
    # Model convention: negative = debit/payout, but abs() makes both safe.
    total_paid = int(abs(agg_paid['total'] or 0))

    # Awaiting payout = all-time earned minus all-time paid (never negative).
    # This is the single source of truth: it decreases immediately when any
    # payout EarningsEvent is created, regardless of which period it belongs to.
    awaiting_payout = max(0, total_earned - total_paid)

    completed_count = events.filter(event_type='lesson_credit').count()

    # ── Payout history (last 20) ────────────────────────────────────────────────
    raw_payouts = list(
        events.filter(event_type='payout')
        .order_by('-created_at')
        .values('id', 'amount_uzs', 'created_at', 'payout_ref')[:20]
    )
    payout_history = [
        {
            'id':         p['id'],
            'amount_uzs': int(abs(p['amount_uzs'])),
            'date':       p['created_at'].date().isoformat(),
            'ref':        p['payout_ref'] or '',
        }
        for p in raw_payouts
    ]

    return {
        'rate_per_lesson_uzs':       int(profile.rate_per_lesson_uzs) if profile else 0,
        'payout_day':                payout_day,
        'period_start':              period_start.isoformat(),
        'next_payout_date':          next_payout.isoformat(),
        'current_period_earned_uzs': current_period_earned,
        # FIX: was incorrectly set to current_period_earned (ignoring all payouts).
        # Now correctly = max(0, total_earned - total_paid), so creating a payout
        # event in Django admin immediately reduces this value to zero (or remainder).
        'pending_payout_uzs':        awaiting_payout,
        'awaiting_payout_uzs':       awaiting_payout,   # explicit alias for frontend
        'total_earned_uzs':          total_earned,
        'total_paid_uzs':            total_paid,
        'completed_lessons_count':   completed_count,
        'payout_history':            payout_history,
    }
