"""
accounts/admin.py  – Professional CRM admin.
Inline organization:
  - StudentProfileAdmin: AdminNote + CreditTransaction (FK → StudentProfile ✓)
  - UserAdmin: Payment (FK → User/student ✓) + Lesson × 2 (FK → User ✓)
"""
import csv
from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.db import transaction
from django.http import HttpResponse
from django.utils.html import format_html

from unfold.admin import ModelAdmin, StackedInline, TabularInline
from unfold.decorators import display

from .models import (
    User, PhoneOTP,
    TeacherProfile, StudentProfile,
    AdminNote, CreditTransaction, EarningsEvent,
    ActivityEvent,
)
from scheduling.models import Lesson
from payments.models import Payment


# ════════════════════════════════════════════════════════════════════
#  HELPERS
# ════════════════════════════════════════════════════════════════════
def fmt_uzs(value):
    if value is None:
        return '— UZS'
    return f"{int(value):,} UZS".replace(',', '\u202f')


# ════════════════════════════════════════════════════════════════════
#  INLINES on StudentProfile  (FK → StudentProfile)
# ════════════════════════════════════════════════════════════════════

class AdminNoteInline(StackedInline):
    model = AdminNote
    fk_name = 'student'          # AdminNote.student → StudentProfile ✓
    extra = 1
    fields = ('body', 'created_by', 'created_at')
    readonly_fields = ('created_at', 'created_by')
    verbose_name_plural = '📝 Admin Notes'
    can_delete = True


class CreditTransactionInline(TabularInline):
    model = CreditTransaction
    fk_name = 'student'          # CreditTransaction.student → StudentProfile ✓
    extra = 0
    can_delete = False
    max_num = 0
    fields = ('delta_col', 'reason_code', 'reason_detail', 'created_by', 'created_at')
    readonly_fields = ('delta_col', 'reason_code', 'reason_detail', 'created_by', 'created_at')
    verbose_name_plural = '💳 Credit Ledger'

    def delta_col(self, obj):
        sign  = '+' if obj.delta >= 0 else ''
        color = 'green' if obj.delta >= 0 else 'red'
        return format_html('<strong style="color:{}">{}{}</strong>', color, sign, obj.delta)
    delta_col.short_description = 'Δ Credits'

    def has_add_permission(self, request, obj=None):
        return False


# ════════════════════════════════════════════════════════════════════
#  INLINES on User  (FK → User)
# ════════════════════════════════════════════════════════════════════

class UserPaymentInline(TabularInline):
    model = Payment
    fk_name = 'student'          # Payment.student → User ✓
    extra = 0
    can_delete = False
    max_num = 0
    verbose_name_plural = '💰 Payments'
    fields = ('amount_col', 'credits_amount', 'method', 'provider', 'status_col', 'created_at')
    readonly_fields = ('amount_col', 'credits_amount', 'method', 'provider', 'status_col', 'created_at')

    def amount_col(self, obj):
        return fmt_uzs(obj.amount_uzs)
    amount_col.short_description = 'Amount (UZS)'

    def status_col(self, obj):
        colors = {
            'succeeded': 'green', 'pending': 'orange',
            'failed': 'red', 'refunded': 'purple', 'canceled': 'gray',
        }
        return format_html(
            '<span style="color:{};font-weight:bold">{}</span>',
            colors.get(obj.status, 'gray'), obj.get_status_display()
        )
    status_col.short_description = 'Status'

    def has_add_permission(self, request, obj=None):
        return False


class StudentLessonInline(TabularInline):
    model = Lesson
    fk_name = 'student'          # Lesson.student → User ✓
    extra = 0
    can_delete = False
    verbose_name_plural = '📅 Lessons (as Student)'
    fields = ('lesson_date', 'teacher', 'status', 'credits_consumed')
    readonly_fields = ('lesson_date', 'teacher', 'status', 'credits_consumed')

    def has_add_permission(self, request, obj=None):
        return False


class TeacherLessonInline(TabularInline):
    model = Lesson
    fk_name = 'teacher'          # Lesson.teacher → User ✓
    extra = 0
    can_delete = False
    verbose_name_plural = '📅 Lessons (as Teacher)'
    fields = ('lesson_date', 'student', 'status', 'credits_consumed')
    readonly_fields = ('lesson_date', 'student', 'status', 'credits_consumed')

    def has_add_permission(self, request, obj=None):
        return False


# ════════════════════════════════════════════════════════════════════
#  CREDIT BALANCE FILTER
# ════════════════════════════════════════════════════════════════════
class CreditBalanceFilter(admin.SimpleListFilter):
    title = 'Credit Balance'
    parameter_name = 'credit_range'

    def lookups(self, request, model_admin):
        return [
            ('zero',   '0 credits'),
            ('low',    '1–3 credits'),
            ('medium', '4–10 credits'),
            ('high',   '10+ credits'),
        ]

    def queryset(self, request, queryset):
        v = self.value()
        if v == 'zero':   return queryset.filter(lesson_credits=0)
        if v == 'low':    return queryset.filter(lesson_credits__gte=1, lesson_credits__lte=3)
        if v == 'medium': return queryset.filter(lesson_credits__gte=4, lesson_credits__lte=10)
        if v == 'high':   return queryset.filter(lesson_credits__gt=10)
        return queryset


# ════════════════════════════════════════════════════════════════════
#  CREDIT ACTION HELPER
# ════════════════════════════════════════════════════════════════════
def _adjust_credits(request, queryset, delta, reason_code, label):
    for profile in queryset.select_related('user'):
        with transaction.atomic():
            profile.lesson_credits = max(0, profile.lesson_credits + delta)
            profile.save(update_fields=['lesson_credits'])
            tx = CreditTransaction.objects.create(
                student=profile,          # FK → StudentProfile
                delta=delta,
                reason_code=reason_code,
                reason_detail=f'Admin action: {label}',
                created_by=request.user,
            )
            # Explicit ActivityEvent — not a signal (admin action, not model save)
            student_name = profile.user.full_name or profile.user.phone_number
            ActivityEvent.objects.create(
                event_type=ActivityEvent.EventType.CREDITS_ADJUSTED,
                actor=request.user,
                subject_student=profile,
                credit_tx_id=tx.id,
                summary=(
                    f"Credits {'added' if delta >= 0 else 'removed'}: "
                    f"{'+'if delta >= 0 else ''}{delta} for {student_name} ({label})"
                ),
                metadata={'delta': delta, 'reason_code': reason_code, 'label': label},
            )
    messages.success(request, f"✅ {label}: applied to {queryset.count()} student(s).")


# ════════════════════════════════════════════════════════════════════
#  1. USER ADMIN
# ════════════════════════════════════════════════════════════════════
@admin.register(User)
class CustomUserAdmin(BaseUserAdmin, ModelAdmin):
    ordering      = ('-date_joined',)
    list_display  = ('avatar_preview', 'phone_number', 'full_name', 'role_badge', 'date_joined', 'is_staff')
    search_fields = ('phone_number', 'full_name', 'email')
    list_filter   = ('role', 'is_staff', 'is_active')
    readonly_fields = ('avatar_preview',)

    fieldsets = (
        (None,            {'fields': ('phone_number', 'password')}),
        ('Personal Info', {'fields': ('full_name', 'email', 'avatar_preview', 'profile_picture', 'role')}),
        ('Permissions',   {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Dates',         {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('phone_number', 'role', 'full_name', 'password1', 'password2'),
        }),
    )
    # Payments + lessons are here because their FKs point to User
    inlines = [UserPaymentInline, StudentLessonInline, TeacherLessonInline]

    @display(description='Role', label=True)
    def role_badge(self, obj):
        color_map = {'STUDENT': 'blue', 'TEACHER': 'purple', 'ADMIN': 'red', 'NEW': 'gray'}
        return obj.get_role_display(), color_map.get(obj.role, 'gray')

    def avatar_preview(self, obj):
        if not obj.profile_picture:
            return "—"
        try:
            url = obj.profile_picture.url
        except Exception:
            return "—"
        return format_html(
            '<img src="{}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" />',
            url,
        )
    avatar_preview.short_description = 'Avatar'


# ════════════════════════════════════════════════════════════════════
#  2. STUDENT PROFILE ADMIN  (CRM PAGE)
# ════════════════════════════════════════════════════════════════════
@admin.register(StudentProfile)
class StudentProfileAdmin(ModelAdmin):
    list_display  = (
        'avatar_preview', 'get_name', 'get_phone', 'crm_status_badge',
        'credit_balance', 'level', 'tags', 'last_login_date',
    )
    list_filter   = ('crm_status', 'level', CreditBalanceFilter)
    search_fields = ('user__phone_number', 'user__full_name', 'user__email', 'tags')
    ordering      = ('-user__date_joined',)
    autocomplete_fields = ['user']

    fieldsets = (
        ('Identity', {'fields': ('user', 'avatar_preview', 'level', 'goals')}),
        ('🎯 CRM',   {'fields': ('crm_status', 'tags', 'churn_reason')}),
        ('Credits (read-only — use list actions to change)', {
            'fields': ('lesson_credits',),
        }),
    )
    readonly_fields = ('lesson_credits', 'avatar_preview')
    # Notes + credit ledger FK → StudentProfile → work on this page ✓
    inlines = [AdminNoteInline, CreditTransactionInline]

    actions = ['add_5_credits', 'remove_1_credit', 'mark_trial', 'mark_paying', 'mark_inactive', 'mark_churned']

    @admin.action(description='➕ Add 5 credits')
    def add_5_credits(self, request, queryset):
        _adjust_credits(request, queryset, +5, 'admin_add', 'Add 5 credits')

    @admin.action(description='➖ Remove 1 credit')
    def remove_1_credit(self, request, queryset):
        _adjust_credits(request, queryset, -1, 'admin_sub', 'Remove 1 credit')

    @admin.action(description='🔵 Mark as Trial')
    def mark_trial(self, request, queryset):
        messages.success(request, f"Marked {queryset.update(crm_status='trial')} student(s) as Trial.")

    @admin.action(description='✅ Mark as Paying')
    def mark_paying(self, request, queryset):
        messages.success(request, f"Marked {queryset.update(crm_status='paying')} student(s) as Paying.")

    @admin.action(description='🟡 Mark as Inactive')
    def mark_inactive(self, request, queryset):
        messages.warning(request, f"Marked {queryset.update(crm_status='inactive')} student(s) as Inactive.")

    @admin.action(description='⬛ Mark as Churned')
    def mark_churned(self, request, queryset):
        messages.warning(request, f"Marked {queryset.update(crm_status='churned')} student(s) as Churned.")

    def avatar_preview(self, obj):
        if not obj.user.profile_picture:
            return "—"
        try:
            url = obj.user.profile_picture.url
        except Exception:
            return "—"
        return format_html(
            '<img src="{}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" />',
            url,
        )
    avatar_preview.short_description = 'Avatar'

    def get_name(self, obj):
        return obj.user.full_name or '(no name)'
    get_name.short_description = 'Name'
    get_name.admin_order_field = 'user__full_name'

    def get_phone(self, obj):
        return obj.user.phone_number
    get_phone.short_description = 'Phone'
    get_phone.admin_order_field = 'user__phone_number'

    def last_login_date(self, obj):
        return obj.user.last_login.strftime('%Y-%m-%d') if obj.user.last_login else '—'
    last_login_date.short_description = 'Last Login'

    @display(description='CRM Status', label=True)
    def crm_status_badge(self, obj):
        color_map = {
            'lead': 'gray', 'trial': 'blue', 'paying': 'green',
            'inactive': 'orange', 'churned': 'red',
        }
        return obj.get_crm_status_display(), color_map.get(obj.crm_status, 'gray')

    def credit_balance(self, obj):
        color = 'red' if obj.lesson_credits == 0 else ('orange' if obj.lesson_credits <= 3 else 'green')
        return format_html('<strong style="color:{}">{}</strong>', color, obj.lesson_credits)
    credit_balance.short_description = 'Credits'
    credit_balance.admin_order_field = 'lesson_credits'

    def save_formset(self, request, form, formset, change):
        instances = formset.save(commit=False)
        for instance in instances:
            if isinstance(instance, AdminNote) and not instance.pk:
                instance.created_by = request.user
                instance.save()
                # Explicit ActivityEvent for new admin notes
                student_name = (
                    instance.student.user.full_name
                    or instance.student.user.phone_number
                )
                ActivityEvent.objects.create(
                    event_type=ActivityEvent.EventType.ADMIN_NOTE_ADDED,
                    actor=request.user,
                    subject_student=instance.student,
                    summary=f"Admin note added for {student_name}: {instance.body[:80]}",
                    metadata={'note_preview': instance.body[:200]},
                )
            else:
                instance.save()
        formset.save_m2m()


# ════════════════════════════════════════════════════════════════════
#  3. TEACHER PROFILE ADMIN
# ════════════════════════════════════════════════════════════════════
@admin.register(TeacherProfile)
class TeacherProfileAdmin(ModelAdmin):
    list_display  = (
        'avatar_preview', 'get_name', 'headline', 'rating_badge',
        'rate_display', 'payout_day', 'lessons_taught', 'is_accepting_students',
    )
    list_filter   = ('is_accepting_students',)
    search_fields = ('user__full_name', 'user__phone_number', 'headline', 'subjects')
    autocomplete_fields = ['user']
    readonly_fields = ('avatar_preview',)

    fieldsets = (
        (None, {'fields': ('user', 'avatar_preview', 'headline', 'bio', 'subjects', 'languages', 'youtube_intro_url')}),
        ('Rates & Availability', {'fields': ('hourly_rate', 'is_accepting_students', 'rating', 'lessons_taught')}),
        ('💰 Earnings Config', {
            'fields': ('rate_per_lesson_uzs', 'payout_day'),
            'description': 'UZS salary per lesson and monthly payout day (1–28).',
        }),
    )

    def avatar_preview(self, obj):
        if not obj.user.profile_picture:
            return "—"
        try:
            url = obj.user.profile_picture.url
        except Exception:
            return "—"
        return format_html(
            '<img src="{}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" />',
            url,
        )
    avatar_preview.short_description = 'Avatar'

    def get_name(self, obj):
        return obj.user.full_name or obj.user.phone_number
    get_name.short_description = 'Teacher'
    get_name.admin_order_field = 'user__full_name'

    @display(description='Rating', label=True)
    def rating_badge(self, obj):
        return str(obj.rating), ('green' if obj.rating >= 4.5 else 'orange')

    def rate_display(self, obj):
        return fmt_uzs(obj.rate_per_lesson_uzs)
    rate_display.short_description = 'Rate/Lesson'
    rate_display.admin_order_field = 'rate_per_lesson_uzs'


# ════════════════════════════════════════════════════════════════════
#  4. ADMIN NOTE
# ════════════════════════════════════════════════════════════════════
@admin.register(AdminNote)
class AdminNoteAdmin(ModelAdmin):
    list_display   = ('get_student', 'body_preview', 'created_by', 'created_at')
    list_filter    = ('created_at',)
    search_fields  = ('student__user__phone_number', 'student__user__full_name', 'body')
    ordering       = ('-created_at',)
    readonly_fields = ('created_at', 'created_by')
    date_hierarchy  = 'created_at'

    def get_student(self, obj):
        return obj.student.user.full_name or obj.student.user.phone_number
    get_student.short_description = 'Student'

    def body_preview(self, obj):
        return obj.body[:80] + '…' if len(obj.body) > 80 else obj.body
    body_preview.short_description = 'Note'

    def save_model(self, request, obj, form, change):
        if not obj.pk:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


# ════════════════════════════════════════════════════════════════════
#  5. CREDIT TRANSACTION
# ════════════════════════════════════════════════════════════════════
@admin.register(CreditTransaction)
class CreditTransactionAdmin(ModelAdmin):
    list_display   = ('get_student', 'delta_col', 'reason_code', 'reason_short', 'created_by', 'created_at')
    list_filter    = ('reason_code', 'created_at')
    search_fields  = ('student__user__phone_number', 'student__user__full_name', 'reason_detail')
    ordering       = ('-created_at',)
    date_hierarchy  = 'created_at'
    readonly_fields = ('student', 'delta', 'reason_code', 'reason_detail', 'payment', 'lesson', 'created_by', 'created_at')

    def get_student(self, obj):
        return obj.student.user.full_name or obj.student.user.phone_number
    get_student.short_description = 'Student'

    def delta_col(self, obj):
        sign  = '+' if obj.delta >= 0 else ''
        color = 'green' if obj.delta >= 0 else 'red'
        return format_html('<strong style="color:{}">{}{}</strong>', color, sign, obj.delta)
    delta_col.short_description = 'Δ Credits'

    def reason_short(self, obj):
        return obj.reason_detail[:60] + '…' if len(obj.reason_detail) > 60 else obj.reason_detail
    reason_short.short_description = 'Detail'

    def has_add_permission(self, request):
        return False
    def has_delete_permission(self, request, obj=None):
        return False
    def has_change_permission(self, request, obj=None):
        return False


# ════════════════════════════════════════════════════════════════════
#  6. EARNINGS EVENT
# ════════════════════════════════════════════════════════════════════
@admin.register(EarningsEvent)
class EarningsEventAdmin(ModelAdmin):
    list_display   = ('get_teacher', 'event_badge', 'amount_col', 'reason_short', 'lesson', 'created_at')
    list_filter    = ('event_type', 'created_at')
    search_fields  = ('teacher__full_name', 'teacher__phone_number', 'reason', 'payout_ref')
    ordering       = ('-created_at',)
    readonly_fields = ('created_at',)
    date_hierarchy  = 'created_at'
    fields = ('teacher', 'event_type', 'amount_uzs', 'reason', 'lesson', 'payout_ref', 'created_by', 'created_at')
    actions = ['export_csv']

    def get_teacher(self, obj):
        return obj.teacher.full_name or obj.teacher.phone_number
    get_teacher.short_description = 'Teacher'

    def amount_col(self, obj):
        sign  = '+' if obj.amount_uzs >= 0 else ''
        color = 'green' if obj.amount_uzs >= 0 else 'red'
        return format_html('<span style="color:{};font-weight:bold">{}{}</span>',
                           color, sign, fmt_uzs(obj.amount_uzs))
    amount_col.short_description = 'Amount (UZS)'

    def reason_short(self, obj):
        return obj.reason[:60] + '…' if len(obj.reason) > 60 else obj.reason
    reason_short.short_description = 'Reason'

    @display(description='Type', label=True)
    def event_badge(self, obj):
        color_map = {
            'lesson_credit': 'green', 'adjustment': 'orange',
            'payout': 'purple', 'correction': 'gray',
        }
        return obj.get_event_type_display(), color_map.get(obj.event_type, 'gray')

    def save_model(self, request, obj, form, change):
        if not obj.pk:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser

    @admin.action(description='📥 Export selected as CSV')
    def export_csv(self, request, queryset):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="earnings_events.csv"'
        w = csv.writer(response)
        w.writerow(['ID', 'Teacher', 'Type', 'Amount UZS', 'Reason', 'Payout Ref', 'Date'])
        for ev in queryset.select_related('teacher'):
            w.writerow([
                ev.id,
                ev.teacher.full_name or ev.teacher.phone_number,
                ev.get_event_type_display(),
                int(ev.amount_uzs),
                ev.reason, ev.payout_ref,
                ev.created_at.strftime('%Y-%m-%d %H:%M'),
            ])
        return response


# ════════════════════════════════════════════════════════════════════
#  7. PHONE OTP
# ════════════════════════════════════════════════════════════════════
@admin.register(PhoneOTP)
class PhoneOTPAdmin(ModelAdmin):
    list_display  = ('phone_number', 'otp', 'count', 'updated_at')
    search_fields = ('phone_number',)
    ordering      = ('-updated_at',)


# ════════════════════════════════════════════════════════════════════
#  8. ACTIVITY FEED  – inline + full list
# ════════════════════════════════════════════════════════════════════

class StudentActivityInline(TabularInline):
    """Last 20 activity events for a student – shown on StudentProfile admin."""
    model           = ActivityEvent
    fk_name         = 'subject_student'
    extra           = 0
    max_num         = 0
    can_delete      = False
    verbose_name_plural = '📋 Activity Feed (last 20)'
    fields          = ('created_at', 'event_type_badge', 'summary', 'actor')
    readonly_fields = ('created_at', 'event_type_badge', 'summary', 'actor')

    def get_queryset(self, request):
        # IMPORTANT: do NOT slice the returned queryset.
        # Django's InlineModelAdmin applies a WHERE subject_student_id = <pk>
        # filter AFTER get_queryset() returns. Slicing first raises:
        #   TypeError: Cannot filter a query once a slice has been taken
        # Fix: use an id__in subquery — Django compiles [:20] into a SQL
        # LIMIT 20 sub-SELECT that the outer queryset can still filter on.
        qs = (
            super().get_queryset(request)
            .select_related('actor')
            .order_by('-created_at')
        )
        latest_ids = qs.values_list('id', flat=True)[:20]
        return qs.filter(id__in=latest_ids)

    def event_type_badge(self, obj):
        _colors = {
            'student_registered': 'blue',   'payment_succeeded': 'green',
            'payment_failed':     'red',     'payment_refunded':  'purple',
            'payment_manual':     'teal',    'credits_adjusted':  'orange',
            'lesson_scheduled':   'blue',    'lesson_cancelled':  'red',
            'lesson_completed':   'green',   'lesson_absent':     'orange',
            'teacher_payout':     'purple',  'admin_note_added':  'gray',
        }
        color = _colors.get(obj.event_type, 'gray')
        return format_html(
            '<span style="background:{};color:#fff;padding:2px 8px;border-radius:12px;'
            'font-size:11px;white-space:nowrap">{}</span>',
            color, obj.get_event_type_display()
        )
    event_type_badge.short_description = 'Event'

    def has_add_permission(self, request, obj=None):
        return False
    def has_change_permission(self, request, obj=None):
        return False


class TeacherActivityInline(StudentActivityInline):
    """Last 20 activity events for a teacher – shown on TeacherProfile admin."""
    fk_name             = 'subject_teacher'
    verbose_name_plural = '📋 Activity Feed (last 20)'

    def get_queryset(self, request):
        # Same fix as StudentActivityInline: use id__in subquery, not slice.
        qs = (
            super(StudentActivityInline, self).get_queryset(request)
            .select_related('actor')
            .order_by('-created_at')
        )
        latest_ids = qs.values_list('id', flat=True)[:20]
        return qs.filter(id__in=latest_ids)


# Wire inlines onto existing admins (post-definition patching to avoid circular refs)
StudentProfileAdmin.inlines = [AdminNoteInline, CreditTransactionInline, StudentActivityInline]
TeacherProfileAdmin.inlines = [TeacherActivityInline]


@admin.register(ActivityEvent)
class ActivityEventAdmin(ModelAdmin):
    list_display   = (
        'created_at', 'event_type_badge', 'summary_short',
        'actor', 'subject_student_link', 'subject_teacher_link',
    )
    list_filter    = ('event_type', 'created_at')
    search_fields  = (
        'summary',
        'subject_student__user__full_name',
        'subject_student__user__phone_number',
        'subject_teacher__user__full_name',
        'actor__full_name',
    )
    ordering       = ('-created_at',)
    date_hierarchy = 'created_at'
    readonly_fields = (
        'event_type', 'actor', 'subject_student', 'subject_teacher',
        'payment_id', 'lesson_id_ref', 'credit_tx_id', 'earnings_event_id',
        'summary', 'metadata', 'created_at',
    )
    list_per_page  = 50

    def get_queryset(self, request):
        return (
            super().get_queryset(request)
            .select_related(
                'actor',
                'subject_student__user',
                'subject_teacher__user',
            )
        )

    @display(description='Event', label=True)
    def event_type_badge(self, obj):
        _colors = {
            'student_registered': 'blue',   'payment_succeeded': 'green',
            'payment_failed':     'red',     'payment_refunded':  'purple',
            'payment_manual':     'teal',    'credits_adjusted':  'orange',
            'lesson_scheduled':   'blue',    'lesson_cancelled':  'red',
            'lesson_completed':   'green',   'lesson_absent':     'orange',
            'teacher_payout':     'purple',  'admin_note_added':  'gray',
        }
        return obj.get_event_type_display(), _colors.get(obj.event_type, 'gray')

    def summary_short(self, obj):
        return obj.summary[:90] + '…' if len(obj.summary) > 90 else obj.summary
    summary_short.short_description = 'Summary'

    def subject_student_link(self, obj):
        if not obj.subject_student:
            return '—'
        name = obj.subject_student.user.full_name or obj.subject_student.user.phone_number
        url  = f'/admin/accounts/studentprofile/{obj.subject_student_id}/change/'
        return format_html('<a href="{}">{}</a>', url, name)
    subject_student_link.short_description = 'Student'

    def subject_teacher_link(self, obj):
        if not obj.subject_teacher:
            return '—'
        name = obj.subject_teacher.user.full_name or obj.subject_teacher.user.phone_number
        url  = f'/admin/accounts/teacherprofile/{obj.subject_teacher_id}/change/'
        return format_html('<a href="{}">{}</a>', url, name)
    subject_teacher_link.short_description = 'Teacher'

    # Activity feed is immutable — no add/edit/delete
    def has_add_permission(self, request):
        return False
    def has_change_permission(self, request, obj=None):
        return False
    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


# ════════════════════════════════════════════════════════════════════
#  9. CUSTOM ADMIN URLS
#  Registers /admin/analytics/, /admin/crm/, /admin/crm/move/
#  via monkey-patch on AdminSite so we don't need a custom AdminSite
#  subclass or changes to backend/urls.py.
# ════════════════════════════════════════════════════════════════════
from django.urls import path as _path
from accounts.admin_views import AnalyticsAdminView, CRMBoardView, CRMMoveView

_orig_get_urls = admin.AdminSite.get_urls


def _custom_get_urls(self):
    custom = [
        _path('analytics/',  self.admin_view(AnalyticsAdminView.as_view()), name='analytics'),
        _path('crm/',        self.admin_view(CRMBoardView.as_view()),        name='crm_board'),
        _path('crm/move/',   self.admin_view(CRMMoveView.as_view()),         name='crm_move'),
    ]
    return custom + _orig_get_urls(self)


admin.AdminSite.get_urls = _custom_get_urls

