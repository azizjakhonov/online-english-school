"""
accounts/analytics.py
ORM aggregation queries for the Admin Analytics page.
All queries use TruncDay + GROUP BY (single DB round-trip each).
Results are serialised to plain Python dicts for safe JSON rendering.
"""
import json
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, Sum
from django.db.models.functions import TruncDay
from django.utils import timezone

User = get_user_model()


# ── helpers ─────────────────────────────────────────────────────────────────

def _date_range(days: int) -> list:
    """Return a list of `days` consecutive dates ending today (in active timezone)."""
    today = timezone.localdate()
    return [today - timedelta(days=i) for i in range(days - 1, -1, -1)]


def _fill(rows, value_key: str, days: int) -> list[dict]:
    """
    Given DB rows like [{day: date, <value_key>: N}, …], produce a
    full list of {label: 'D Mon', value: N} for every day in the window,
    filling missing dates with 0.
    """
    mapping = {row['day'].date() if hasattr(row['day'], 'date') else row['day']: row[value_key]
               for row in rows}
    result = []
    for d in _date_range(days):
        raw = mapping.get(d, 0)
        # Safely convert Decimal/None → int (Sum returns Decimal, Count returns int)
        try:
            value = int(raw) if raw is not None else 0
        except (TypeError, ValueError):
            value = 0
        # Cross-platform date label: d.day is already an int (no leading zero);
        # '%-d' is Linux-only and crashes on Windows.
        label = f"{d.day} {d.strftime('%b')}"
        result.append({'label': label, 'value': value})
    return result



def _jsonify(data: list[dict]) -> str:
    return json.dumps(data)


# ── Chart 1: Revenue (UZS) per day ──────────────────────────────────────────

def revenue_by_day(days: int = 30) -> str:
    from payments.models import Payment
    since = timezone.localdate() - timedelta(days=days)
    rows = (
        Payment.objects
        .filter(status='succeeded', created_at__date__gte=since)
        .annotate(day=TruncDay('created_at'))
        .values('day')
        .annotate(total=Sum('amount_uzs'))
        .order_by('day')
    )
    filled = _fill(rows, 'total', days)
    return _jsonify(filled)


# ── Chart 2: New students per day ───────────────────────────────────────────

def new_students_by_day(days: int = 30) -> str:
    since = timezone.localdate() - timedelta(days=days)
    rows = (
        User.objects
        .filter(role='STUDENT', date_joined__date__gte=since)
        .annotate(day=TruncDay('date_joined'))
        .values('day')
        .annotate(total=Count('id'))
        .order_by('day')
    )
    filled = _fill(rows, 'total', days)
    return _jsonify(filled)


# ── Chart 3: Credits sold vs consumed per day ───────────────────────────────

def credits_flow_by_day(days: int = 30) -> tuple[str, str]:
    from payments.models import Payment
    from scheduling.models import Lesson
    since = timezone.localdate() - timedelta(days=days)

    sold_rows = (
        Payment.objects
        .filter(status='succeeded', created_at__date__gte=since)
        .annotate(day=TruncDay('created_at'))
        .values('day')
        .annotate(total=Sum('credits_amount'))
        .order_by('day')
    )
    consumed_rows = (
        Lesson.objects
        .filter(credits_consumed=True, lesson_date__gte=since)
        .annotate(day=TruncDay('start_time'))
        .values('day')
        .annotate(total=Count('id'))
        .order_by('day')
    )
    return _jsonify(_fill(sold_rows, 'total', days)), _jsonify(_fill(consumed_rows, 'total', days))


# ── Chart 4: Lesson status breakdown (pie/doughnut) ─────────────────────────

def lesson_status_breakdown(days: int = 30) -> str:
    from scheduling.models import Lesson
    since = timezone.localdate() - timedelta(days=days)
    rows = (
        Lesson.objects
        .filter(lesson_date__gte=since)
        .values('status')
        .annotate(count=Count('id'))
        .order_by('status')
    )
    data = [{'label': r['status'].replace('_', ' ').title(), 'value': r['count']} for r in rows]
    return json.dumps(data)
