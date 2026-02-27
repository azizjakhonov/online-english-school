"""
accounts/admin_views.py
Custom admin-only views registered via AdminSite.get_urls().
All views require staff login (enforced by admin.site.admin_view wrapper).
"""
import json

from django.contrib import admin
from django.http import JsonResponse
from django.shortcuts import render
from django.views import View

from accounts.models import StudentProfile


# ── Analytics ────────────────────────────────────────────────────────────────

class AnalyticsAdminView(View):
    """
    Renders /admin/analytics/ — Chart.js analytics with date-range toggle.
    GET ?days=7|30|month  (default 30)
    If ?json=1, returns raw chart data as JSON (for AJAX re-render).
    """

    def get(self, request):
        from accounts.analytics import (
            revenue_by_day,
            new_students_by_day,
            credits_flow_by_day,
            lesson_status_breakdown,
        )

        # Parse days param — supported values: 7, 30, 90
        days_param = request.GET.get('days', '30')
        try:
            days = int(days_param)
            if days not in (7, 30, 90):
                days = 30
        except (ValueError, TypeError):
            days = 30

        # Defensive: chart queries must never crash the admin page
        def _safe(fn, *args, fallback='[]'):
            try:
                return fn(*args)
            except Exception:
                return fallback

        revenue_json             = _safe(revenue_by_day, days)
        students_json            = _safe(new_students_by_day, days)
        _credits                 = _safe(credits_flow_by_day, days, fallback=('[]', '[]'))
        credits_sold_json, credits_consumed_json = _credits if isinstance(_credits, tuple) else ('[]', '[]')
        lesson_status_json       = _safe(lesson_status_breakdown, days)

        if request.GET.get('json') == '1':
            return JsonResponse({
                'revenue':          json.loads(revenue_json),
                'students':         json.loads(students_json),
                'credits_sold':     json.loads(credits_sold_json),
                'credits_consumed': json.loads(credits_consumed_json),
                'lesson_status':    json.loads(lesson_status_json),
            })

        context = {
            **admin.site.each_context(request),
            'title':                'Analytics',
            'subtitle':             f'Last {days} days',
            'days':                 days,
            'revenue_json':         revenue_json,
            'students_json':        students_json,
            'credits_sold_json':    credits_sold_json,
            'credits_consumed_json': credits_consumed_json,
            'lesson_status_json':   lesson_status_json,
        }
        return render(request, 'admin/analytics.html', context)


# ── CRM Kanban Board ─────────────────────────────────────────────────────────

class CRMBoardView(View):
    """
    Renders /admin/crm/ — Kanban board grouped by crm_status.
    Accepts quick-filter GET params:
      ?has_credits=1  ?upcoming=1  ?inactive_14=1  ?tag=text
    """

    COLUMNS = [
        ('lead',     'Lead',     '#6b7280'),
        ('trial',    'Trial',    '#3b82f6'),
        ('paying',   'Paying',   '#22c55e'),
        ('inactive', 'Inactive', '#f59e0b'),
        ('churned',  'Churned',  '#ef4444'),
    ]

    def get(self, request):
        from django.utils import timezone
        from django.db.models import Max, Prefetch, Q
        from scheduling.models import Lesson

        today = timezone.localdate()
        inactive_cutoff = today - timezone.timedelta(days=14)

        # Base queryset
        qs = (
            StudentProfile.objects
            .select_related('user')
            .annotate(last_lesson_date=Max('user__learning_lessons__lesson_date'))
        )

        # Quick filters
        if request.GET.get('has_credits') == '1':
            qs = qs.filter(lesson_credits__gt=0)
        if request.GET.get('upcoming') == '1':
            qs = qs.filter(
                user__learning_lessons__lesson_date__gte=today,
                user__learning_lessons__status__in=['PENDING', 'CONFIRMED'],
            ).distinct()
        if request.GET.get('inactive_14') == '1':
            qs = qs.filter(
                Q(user__last_login__isnull=True) |
                Q(user__last_login__date__lt=inactive_cutoff)
            )
        if tag := request.GET.get('tag', '').strip():
            qs = qs.filter(tags__icontains=tag)

        # Prefetch upcoming lessons for each student (max 1 per student)
        upcoming_qs = (
            Lesson.objects
            .filter(lesson_date__gte=today, status__in=['PENDING', 'CONFIRMED'])
            .order_by('lesson_date')
        )
        qs = qs.prefetch_related(
            Prefetch('user__learning_lessons', queryset=upcoming_qs, to_attr='upcoming_lessons')
        )

        # Group into columns in Python (avoids N+1)
        columns_data = {slug: [] for slug, *_ in self.COLUMNS}
        for student in qs:
            if student.crm_status in columns_data:
                upcoming = getattr(student.user, 'upcoming_lessons', [])
                columns_data[student.crm_status].append({
                    'id':            student.pk,
                    'name':          student.user.full_name or student.user.phone_number,
                    'phone':         student.user.phone_number,
                    'credits':       student.lesson_credits,
                    'tags':          [t.strip() for t in student.tags.split(',') if t.strip()],
                    'last_lesson':   student.last_lesson_date,
                    'next_lesson':   upcoming[0].lesson_date if upcoming else None,
                    'crm_status':    student.crm_status,
                })

        columns = [
            {
                'slug':   slug,
                'label':  label,
                'color':  color,
                'cards':  columns_data[slug],
                'count':  len(columns_data[slug]),
            }
            for slug, label, color in self.COLUMNS
        ]

        context = {
            **admin.site.each_context(request),
            'title':    'CRM Pipeline Board',
            'subtitle': 'Drag cards to update student status',
            'columns':  columns,
            'filters': {
                'has_credits': request.GET.get('has_credits', ''),
                'upcoming':    request.GET.get('upcoming', ''),
                'inactive_14': request.GET.get('inactive_14', ''),
                'tag':         request.GET.get('tag', ''),
            },
        }
        return render(request, 'admin/crm_board.html', context)


class CRMMoveView(View):
    """
    POST /admin/crm/move/
    Body: {"student_id": <int>, "crm_status": "<slug>"}
    Requires is_staff. Returns {"ok": true, "new_status": "<slug>"}.
    """
    VALID_STATUSES = {'lead', 'trial', 'paying', 'inactive', 'churned'}

    def post(self, request):
        if not request.user.is_staff:
            return JsonResponse({'ok': False, 'error': 'forbidden'}, status=403)
        try:
            data       = json.loads(request.body)
            student_id = int(data['student_id'])
            new_status = data['crm_status']
        except (KeyError, ValueError, json.JSONDecodeError):
            return JsonResponse({'ok': False, 'error': 'bad_request'}, status=400)

        if new_status not in self.VALID_STATUSES:
            return JsonResponse({'ok': False, 'error': 'invalid_status'}, status=400)

        updated = StudentProfile.objects.filter(pk=student_id).update(crm_status=new_status)
        if not updated:
            return JsonResponse({'ok': False, 'error': 'not_found'}, status=404)

        return JsonResponse({'ok': True, 'new_status': new_status})
