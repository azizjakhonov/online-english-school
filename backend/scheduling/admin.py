"""
scheduling/admin.py  – Lesson operations control room.
"""
import csv
from django.contrib import admin, messages
from django.http import HttpResponse
from django.utils.html import format_html

from unfold.admin import ModelAdmin, TabularInline, StackedInline
from unfold.decorators import display

from .models import Lesson, Availability, LessonRescheduleHistory

# Cross-app imports — concrete at module load time so system check is happy
from progress.models import LessonProgress
from lessons.models import LessonContent
from accounts.models import EarningsEvent


# ════════════════════════════════════════════════════════════════════
#  INLINES
# ════════════════════════════════════════════════════════════════════

class LessonProgressInline(StackedInline):
    model = LessonProgress          # concrete at class-definition time ✓
    verbose_name_plural = '📊 Progress Scores'
    extra = 0
    can_delete = False
    max_num = 1
    fields = ('speaking', 'grammar', 'vocabulary', 'listening', 'teacher_feedback')


class LessonContentInline(StackedInline):
    model = LessonContent            # concrete at class-definition time ✓
    verbose_name_plural = '📝 Teacher Notes'
    extra = 0
    max_num = 1
    fields = ('teacher_notes',)


class EarningsEventInline(TabularInline):
    model = EarningsEvent            # concrete at class-definition time ✓
    fk_name = 'lesson'
    verbose_name_plural = '💰 Teacher Earnings'
    extra = 0
    can_delete = False
    max_num = 0
    fields = ('teacher', 'event_type', 'amount_col', 'reason', 'created_at')
    readonly_fields = ('teacher', 'event_type', 'amount_col', 'reason', 'created_at')

    def amount_col(self, obj):
        return f"{int(obj.amount_uzs):,} UZS".replace(',', '\u202f')
    amount_col.short_description = 'Amount (UZS)'

    def has_add_permission(self, request, obj=None):
        return False


# ════════════════════════════════════════════════════════════════════
#  STATUS FILTER
# ════════════════════════════════════════════════════════════════════
class LessonStatusFilter(admin.SimpleListFilter):
    title = 'Status'
    parameter_name = 'status'

    def lookups(self, request, model_admin):
        return Lesson.STATUS_CHOICES

    def queryset(self, request, queryset):
        return queryset.filter(status=self.value()) if self.value() else queryset


# ════════════════════════════════════════════════════════════════════
#  LESSON ADMIN
# ════════════════════════════════════════════════════════════════════
@admin.register(Lesson)
class LessonAdmin(ModelAdmin):
    list_display   = (
        'id', 'lesson_date', 'start_col', 'teacher_col', 'student_col',
        'status_badge', 'credits_consumed', 'no_show_reason',
    )
    list_filter    = (LessonStatusFilter, 'credits_consumed')
    search_fields  = (
        'teacher__full_name', 'teacher__phone_number',
        'student__full_name', 'student__phone_number',
    )
    ordering       = ('-lesson_date', '-start_time')
    date_hierarchy  = 'lesson_date'
    readonly_fields = ('room_sid', 'created_at')
    raw_id_fields   = ('teacher', 'student', 'availability_slot')

    fieldsets = (
        (None,     {'fields': ('teacher', 'student', 'availability_slot', 'lesson_date')}),
        ('Timing', {'fields': ('start_time', 'end_time', 'ended_at')}),
        ('Status', {'fields': ('status', 'credits_consumed', 'no_show_reason', 'meeting_link', 'notes')}),
        ('System', {'fields': ('room_sid', 'created_at'), 'classes': ('collapse',)}),
    )

    inlines = [LessonProgressInline, LessonContentInline, EarningsEventInline]
    actions = ['mark_completed', 'mark_student_absent', 'mark_cancelled', 'export_csv']

    # ── Actions ─────────────────────────────────────────────────────
    @admin.action(description='✅ Mark as COMPLETED')
    def mark_completed(self, request, queryset):
        already = queryset.filter(status='COMPLETED').count()
        if already:
            messages.warning(request, f"⚠️ {already} lesson(s) already COMPLETED — skipped.")

        count = 0
        for lesson in queryset.exclude(status='COMPLETED').select_related('teacher'):
            # Dedup guard — warn if earnings would duplicate
            if EarningsEvent.objects.filter(lesson=lesson, event_type='lesson_credit').exists():
                messages.warning(
                    request,
                    f"⚠️ Lesson #{lesson.id}: EarningsEvent already exists — status updated, no duplicate created."
                )
            lesson.status = 'COMPLETED'
            lesson.save(update_fields=['status'])   # triggers earnings signal
            count += 1
        if count:
            messages.success(request, f"✅ Marked {count} lesson(s) as COMPLETED.")

    @admin.action(description='🔴 Mark as STUDENT ABSENT')
    def mark_student_absent(self, request, queryset):
        n = queryset.exclude(status='STUDENT_ABSENT').update(status='STUDENT_ABSENT')
        messages.warning(request, f"Marked {n} lesson(s) as Student Absent.")

    @admin.action(description='❌ Mark as CANCELLED')
    def mark_cancelled(self, request, queryset):
        n = queryset.exclude(status='CANCELLED').update(status='CANCELLED')
        messages.success(request, f"Marked {n} lesson(s) as Cancelled.")

    @admin.action(description='📥 Export selected as CSV')
    def export_csv(self, request, queryset):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="lessons.csv"'
        w = csv.writer(response)
        w.writerow(['ID', 'Date', 'Teacher', 'Student', 'Status', 'Credits Consumed', 'No-show Reason'])
        for lesson in queryset.select_related('teacher', 'student'):
            w.writerow([
                lesson.id, lesson.lesson_date,
                lesson.teacher.full_name or lesson.teacher.phone_number,
                lesson.student.full_name or lesson.student.phone_number,
                lesson.status, lesson.credits_consumed, lesson.no_show_reason,
            ])
        return response

    # ── Display helpers ──────────────────────────────────────────────
    def teacher_col(self, obj):
        return obj.teacher.full_name or obj.teacher.phone_number
    teacher_col.short_description = 'Teacher'
    teacher_col.admin_order_field = 'teacher__full_name'

    def student_col(self, obj):
        return obj.student.full_name or obj.student.phone_number
    student_col.short_description = 'Student'
    student_col.admin_order_field = 'student__full_name'

    def start_col(self, obj):
        return obj.start_time.strftime('%H:%M') if obj.start_time else '—'
    start_col.short_description = 'Time'
    start_col.admin_order_field = 'start_time'

    @display(description='Status', label=True)
    def status_badge(self, obj):
        color_map = {
            'COMPLETED': 'green', 'CONFIRMED': 'blue', 'PENDING': 'gray',
            'CANCELLED': 'red', 'STUDENT_ABSENT': 'orange', 'TECHNICAL_ISSUES': 'purple',
        }
        return obj.get_status_display(), color_map.get(obj.status, 'gray')


# ════════════════════════════════════════════════════════════════════
#  AVAILABILITY ADMIN
# ════════════════════════════════════════════════════════════════════
@admin.register(Availability)
class AvailabilityAdmin(ModelAdmin):
    list_display  = ('teacher', 'get_day', 'start_time', 'end_time')
    list_filter   = ('day_of_week',)
    search_fields = ('teacher__full_name', 'teacher__phone_number')
    ordering      = ('day_of_week', 'start_time')

    def get_day(self, obj):
        return obj.get_day_of_week_display()
    get_day.short_description = 'Day'
    get_day.admin_order_field = 'day_of_week'


# ════════════════════════════════════════════════════════════════════
#  LESSON RESCHEDULE HISTORY ADMIN
# ════════════════════════════════════════════════════════════════════
@admin.register(LessonRescheduleHistory)
class LessonRescheduleHistoryAdmin(ModelAdmin):
    list_display  = ('lesson', 'old_scheduled_at', 'new_scheduled_at', 'changed_by', 'changed_at')
    list_filter   = ('changed_at',)
    search_fields = (
        'lesson__teacher__full_name', 'lesson__student__full_name',
        'changed_by__full_name', 'changed_by__phone_number',
    )
    ordering      = ('-changed_at',)
    readonly_fields = ('changed_at',)

    def has_add_permission(self, request):
        return False   # Reschedule history is created programmatically, never manually
    def has_change_permission(self, request, obj=None):
        return False   # Immutable audit log
    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser
