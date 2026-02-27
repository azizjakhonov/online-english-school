from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db.models import Prefetch

# --- 0. CUSTOM USER MANAGER ---
class UserManager(BaseUserManager):
    def create_user(self, phone_number, password=None, **extra_fields):
        if not phone_number:
            raise ValueError("The Phone Number must be set")
        user = self.model(phone_number=phone_number, **extra_fields)
        user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, phone_number, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'ADMIN')
        
        user = self.create_user(phone_number, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

# --- 1. THE USER MODEL ---
class User(AbstractUser):
    class Roles(models.TextChoices):
        STUDENT = "STUDENT", "Student"
        TEACHER = "TEACHER", "Teacher"
        ADMIN = "ADMIN", "Admin"
        NEW = "NEW", "New User"

    username = None 
    email = models.EmailField(blank=True, null=True)
    phone_number = models.CharField(max_length=15, unique=True)
    full_name = models.CharField(max_length=255, blank=True)
    role = models.CharField(max_length=10, choices=Roles.choices, default=Roles.NEW)
    
    # --- PROFILE PICTURE FIELD ---
    # Uploads to 'media/profile_pics/', optional (null=True, blank=True)
    profile_picture = models.ImageField(upload_to='profile_pics/', null=True, blank=True)

    # --- TIMEZONE FIELD ---
    # Stores an IANA timezone name (e.g. "Asia/Tashkent", "Europe/London").
    # Used by UserTimezoneMiddleware to activate the correct tz per request.
    # Existing users default to Asia/Tashkent — no data migration needed.
    timezone = models.CharField(
        max_length=64,
        default='Asia/Tashkent',
        blank=True,
        help_text='IANA timezone name, e.g. Asia/Tashkent',
    )

    USERNAME_FIELD = 'phone_number'
    REQUIRED_FIELDS = [] 

    objects = UserManager()

    @property
    def is_student(self): return self.role == self.Roles.STUDENT
    @property
    def is_teacher(self): return self.role == self.Roles.TEACHER

    def __str__(self): return self.phone_number

# --- 2. SOCIAL IDENTITY ---
class UserIdentity(models.Model):
    """
    Links a social provider identity (Google, Telegram) to a User.
    One user can have multiple social identities.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='identities',
    )
    provider = models.CharField(max_length=50)      # 'google' | 'telegram'
    provider_id = models.CharField(max_length=255)  # Google sub or Telegram user ID

    class Meta:
        unique_together = ('provider', 'provider_id')

    def __str__(self):
        return f"{self.provider}:{self.provider_id} → {self.user}"


# --- 3. OTP STORAGE ---
class PhoneOTP(models.Model):
    phone_number = models.CharField(max_length=15, unique=True)
    otp = models.CharField(max_length=6)
    count = models.IntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self): return f"{self.phone_number} -> {self.otp}"

# --- 3. PROFILES ---
class TeacherProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="teacher_profile")
    bio = models.TextField(blank=True, help_text="About me")
    headline = models.CharField(max_length=100, blank=True)
    languages = models.CharField(max_length=255, null=True, blank=True)
    subjects = models.CharField(max_length=255, blank=True, null=True)
    youtube_intro_url = models.URLField(blank=True, null=True)
    hourly_rate = models.DecimalField(max_digits=6, decimal_places=2, default=15.00)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=5.00)
    lessons_taught = models.IntegerField(default=0)
    is_accepting_students = models.BooleanField(default=True)

    # --- EARNINGS CONFIG ---
    rate_per_lesson_uzs = models.DecimalField(
        max_digits=12, decimal_places=0, default=0,
        help_text="Teacher\'s pay per 1-hour lesson in UZS (set by admin)"
    )
    payout_day = models.PositiveSmallIntegerField(
        default=25,
        help_text="Day of month on which teacher receives salary payout (1-28)"
    )

    def __str__(self): return f"Teacher: {self.user.phone_number}"

class StudentProfile(models.Model):
    class CRMStatus(models.TextChoices):
        LEAD     = 'lead',     'Lead'
        TRIAL    = 'trial',    'Trial'
        PAYING   = 'paying',   'Paying'
        INACTIVE = 'inactive', 'Inactive'
        CHURNED  = 'churned',  'Churned'

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='student_profile')
    level = models.CharField(max_length=50, default='Beginner')
    lesson_credits = models.IntegerField(default=0)
    credits_reserved = models.PositiveIntegerField(
        default=0,
        help_text='Credits currently held for upcoming/in-progress lessons'
    )
    goals = models.TextField(blank=True)

    @property
    def available_credits(self) -> int:
        """Credits the student can actually spend (total minus held reservations)."""
        return max(0, self.lesson_credits - self.credits_reserved)

    # --- CRM FIELDS ---
    crm_status = models.CharField(
        max_length=20, choices=CRMStatus.choices, default='lead',
        help_text='CRM lifecycle stage for this student'
    )
    tags = models.CharField(
        max_length=255, blank=True,
        help_text='Comma-separated tags, e.g. "VIP, at-risk, scholarship"'
    )
    churn_reason = models.TextField(
        blank=True,
        help_text='Reason for churn (set when crm_status = churned)'
    )

    def __str__(self):
        return f"Student: {self.user.full_name}"


class AdminNote(models.Model):
    """
    Timestamped admin notes on a student. Append-only (no edit).
    FK to StudentProfile so it appears as an inline on the CRM admin page.
    """
    student = models.ForeignKey(
        'StudentProfile',
        on_delete=models.CASCADE,
        related_name='admin_notes',
    )
    body = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True,
        related_name='notes_authored',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Admin Note'
        verbose_name_plural = 'Admin Notes'

    def __str__(self):
        author = getattr(self.created_by, 'phone_number', '?') if self.created_by else '?'
        return f"Note by {author} on {self.created_at:%Y-%m-%d}"


class CreditTransaction(models.Model):
    """
    Immutable ledger of every credit balance change for a student.
    Positive delta = credits added; negative = credits consumed/deducted.
    """
    class Reason(models.TextChoices):
        PURCHASE      = 'purchase',       'Credit Purchase'
        LESSON        = 'lesson',         'Lesson Consumed'
        STUDENT_ABSENT = 'student_absent', 'Student Absent – Charged'
        ADMIN_ADD     = 'admin_add',      'Admin Gift/Adjustment'
        ADMIN_SUB     = 'admin_sub',      'Admin Deduction'
        REFUND        = 'refund',         'Refund'

    student = models.ForeignKey(
        'StudentProfile',
        on_delete=models.PROTECT,
        related_name='credit_transactions',
    )
    delta = models.IntegerField(
        help_text='Credits added (positive) or removed (negative)'
    )
    reason_code = models.CharField(max_length=20, choices=Reason.choices)
    reason_detail = models.TextField(blank=True, help_text='Human-readable explanation')
    payment = models.ForeignKey(
        'payments.Payment', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='credit_transactions'
    )
    lesson = models.ForeignKey(
        'scheduling.Lesson', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='credit_transactions'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='credit_transactions_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Credit Transaction'
        verbose_name_plural = 'Credit Transactions'

    def __str__(self):
        sign = '+' if self.delta >= 0 else ''
        user = self.student.user
        student_str = user.full_name or user.phone_number
        return f"{student_str} | {sign}{self.delta} credits | {self.get_reason_code_display()}"

# --- 4. EARNINGS LEDGER ---
class EarningsEvent(models.Model):
    """
    Immutable ledger of every teacher earnings credit/debit.
    Positive amount_uzs = income; negative = deduction/payout.
    """
    class EventType(models.TextChoices):
        LESSON_CREDIT = 'lesson_credit', 'Lesson Credit'
        ADJUSTMENT    = 'adjustment',    'Manual Adjustment'
        PAYOUT        = 'payout',        'Payout'
        CORRECTION    = 'correction',    'Correction'

    teacher    = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='earnings_events',
        limit_choices_to={'role': 'TEACHER'},
    )
    event_type = models.CharField(max_length=20, choices=EventType.choices)
    amount_uzs = models.DecimalField(
        max_digits=12, decimal_places=0,
        help_text='Positive = credit (earned/bonus), negative = debit (deduction/payout)'
    )
    reason     = models.TextField(blank=True)
    lesson     = models.ForeignKey(
        'scheduling.Lesson', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='earnings_events'
    )
    payout_ref = models.CharField(max_length=255, blank=True, help_text='Bank transfer reference')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='earnings_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Earnings Event'
        verbose_name_plural = 'Earnings Events'

    def __str__(self):
        teacher_str = getattr(self.teacher, 'full_name', None) or self.teacher.phone_number
        sign = '+' if self.amount_uzs >= 0 else ''
        return f"{teacher_str} | {self.get_event_type_display()} | {sign}{self.amount_uzs} UZS"


# --- 5. ACTIVITY FEED ---
class ActivityEvent(models.Model):
    """
    Immutable log of key business events for the admin activity feed.
    Created via signals (payments/lessons/earnings) and explicit hooks
    (credit adjustments, admin notes). Never edited after creation.
    """
    class EventType(models.TextChoices):
        STUDENT_REGISTERED = 'student_registered', 'Student Registered'
        PAYMENT_SUCCEEDED  = 'payment_succeeded',  'Payment Succeeded'
        PAYMENT_FAILED     = 'payment_failed',     'Payment Failed'
        PAYMENT_REFUNDED   = 'payment_refunded',   'Payment Refunded'
        PAYMENT_MANUAL     = 'payment_manual',     'Manual Payment'
        CREDITS_ADJUSTED   = 'credits_adjusted',   'Credits Adjusted'
        LESSON_SCHEDULED   = 'lesson_scheduled',   'Lesson Scheduled'
        LESSON_CANCELLED   = 'lesson_cancelled',   'Lesson Cancelled'
        LESSON_COMPLETED   = 'lesson_completed',   'Lesson Completed'
        LESSON_ABSENT      = 'lesson_absent',      'Student Absent'
        TEACHER_PAYOUT     = 'teacher_payout',     'Teacher Payout'
        ADMIN_NOTE_ADDED   = 'admin_note_added',   'Admin Note Added'

    event_type        = models.CharField(
        max_length=30, choices=EventType.choices, db_index=True
    )
    actor             = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='activity_events_as_actor',
    )
    subject_student   = models.ForeignKey(
        'StudentProfile', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='activity_events',
    )
    subject_teacher   = models.ForeignKey(
        'TeacherProfile', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='activity_events',
    )
    # Soft references — store PKs without FK constraints so deleting
    # a payment/lesson never cascades into the audit log.
    payment_id        = models.PositiveIntegerField(null=True, blank=True)
    lesson_id_ref     = models.PositiveIntegerField(null=True, blank=True)  # avoid clash with any lesson FK
    credit_tx_id      = models.PositiveIntegerField(null=True, blank=True)
    earnings_event_id = models.PositiveIntegerField(null=True, blank=True)

    summary           = models.CharField(max_length=500)
    metadata          = models.JSONField(default=dict, blank=True)
    created_at        = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Activity Event'
        verbose_name_plural = 'Activity Events'
        indexes = [
            models.Index(fields=['created_at']),
            models.Index(fields=['event_type']),
            models.Index(fields=['subject_student', 'created_at']),
            models.Index(fields=['subject_teacher', 'created_at']),
        ]

    def __str__(self):
        return f"[{self.event_type}] {self.summary[:60]} @ {self.created_at:%Y-%m-%d %H:%M}"


# --- 6. SIGNALS ---
@receiver(post_save, sender=User)
def manage_user_profile(sender, instance, created, **kwargs):
    if instance.role == User.Roles.TEACHER:
        TeacherProfile.objects.get_or_create(user=instance)
    elif instance.role == User.Roles.STUDENT:
        profile, was_created = StudentProfile.objects.get_or_create(user=instance)
        # Fire activity event only when the profile is genuinely new
        if was_created:
            from accounts.services.activity_log import log_activity
            log_activity(
                ActivityEvent.EventType.STUDENT_REGISTERED,
                student=profile,
                summary=f"New student registered: {instance.full_name or instance.phone_number}",
            )


@receiver(post_save, sender='scheduling.Lesson')
def handle_lesson_credit_lifecycle(sender, instance, created, update_fields, **kwargs):
    """
    Unified credit lifecycle handler for Lesson status changes.

    CHARGE (consume 1 credit + release hold): COMPLETED, STUDENT_ABSENT
    RELEASE (release hold only, no charge):    CANCELLED
    Teacher EarningsEvent:                     COMPLETED only

    Guards:
    - Newly created lessons are skipped.
    - Re-saves that don't touch 'status' are skipped.
    - Idempotent: credits_consumed flag prevents double-charge.
    - Race-safe: select_for_update() on StudentProfile + .update() with F().
    - Recursion-safe: Lesson flags updated via .update(), not instance.save().
    """
    if created:
        return
    if update_fields is not None and 'status' not in update_fields:
        return

    from django.db import transaction as db_transaction
    from django.db.models import F as DbF, Case, When, Value
    from scheduling.models import Lesson as LessonModel

    CHARGE_STATUSES = {'COMPLETED', 'STUDENT_ABSENT'}

    # ── COMPLETED / STUDENT_ABSENT: charge credit + release hold ────────────
    if instance.status in CHARGE_STATUSES:

        # Idempotency: already finalized
        if instance.credits_consumed:
            return
        # Belt & suspenders: check ledger too
        if CreditTransaction.objects.filter(
            lesson=instance,
            reason_code__in=[CreditTransaction.Reason.LESSON, CreditTransaction.Reason.STUDENT_ABSENT]
        ).exists():
            return

        # Teacher earnings (COMPLETED only)
        if instance.status == 'COMPLETED':
            if not EarningsEvent.objects.filter(lesson=instance, event_type='lesson_credit').exists():
                try:
                    t_profile = instance.teacher.teacher_profile
                    EarningsEvent.objects.create(
                        teacher=instance.teacher,
                        event_type='lesson_credit',
                        amount_uzs=t_profile.rate_per_lesson_uzs or 0,
                        reason=f'Lesson #{instance.id} completed',
                        lesson=instance,
                    )
                except TeacherProfile.DoesNotExist:
                    pass

        # Guard: only charge if a hold was actually placed
        if not instance.credits_reserved:
            import logging
            logging.getLogger(__name__).warning(
                'Lesson #%s reached %s but has no credit reservation — skipping charge.',
                instance.id, instance.status
            )
            return

        try:
            student_profile = instance.student.student_profile
        except Exception:
            return

        reason_code = (
            CreditTransaction.Reason.LESSON
            if instance.status == 'COMPLETED'
            else CreditTransaction.Reason.STUDENT_ABSENT
        )

        with db_transaction.atomic():
            # Lock and update: decrement lesson_credits, release reserve
            StudentProfile.objects.filter(pk=student_profile.pk).update(
                lesson_credits=DbF('lesson_credits') - 1,
                credits_reserved=Case(
                    When(credits_reserved__gt=0, then=DbF('credits_reserved') - 1),
                    default=Value(0),
                ),
            )

            CreditTransaction.objects.create(
                student=student_profile,
                delta=-1,
                reason_code=reason_code,
                reason_detail=f'Lesson #{instance.id} — {instance.status}',
                lesson=instance,
            )

            # Flip lesson flags atomically (avoids recursion)
            LessonModel.objects.filter(pk=instance.pk, credits_consumed=False).update(
                credits_consumed=True,
                credits_reserved=False,
            )

    # ── CANCELLED: release hold only, no charge ──────────────────────────────
    elif instance.status == 'CANCELLED':
        if not instance.credits_reserved or instance.credits_consumed:
            return  # Nothing to release

        try:
            student_profile = instance.student.student_profile
        except Exception:
            return

        with db_transaction.atomic():
            StudentProfile.objects.filter(pk=student_profile.pk).update(
                credits_reserved=Case(
                    When(credits_reserved__gt=0, then=DbF('credits_reserved') - 1),
                    default=Value(0),
                ),
            )
            LessonModel.objects.filter(
                pk=instance.pk,
                credits_reserved=True,
                credits_consumed=False,
            ).update(credits_reserved=False)


# ── ACTIVITY: Payment status changes ────────────────────────────────────────
@receiver(post_save, sender='payments.Payment')
def on_payment_change(sender, instance, created, **kwargs):
    """
    Records ActivityEvent when a Payment reaches a terminal status.
    Uses get_or_create keyed on (event_type, payment_id) to avoid duplication
    on incidental re-saves.
    """
    _STATUS_TO_EVENT = {
        'succeeded': (
            ActivityEvent.EventType.PAYMENT_MANUAL
            if instance.method == 'manual'
            else ActivityEvent.EventType.PAYMENT_SUCCEEDED
        ),
        'failed':   ActivityEvent.EventType.PAYMENT_FAILED,
        'refunded': ActivityEvent.EventType.PAYMENT_REFUNDED,
    }
    etype = _STATUS_TO_EVENT.get(instance.status)
    if not etype:
        return

    from accounts.services.activity_log import log_activity
    amount_fmt = f"{int(instance.amount_uzs):,}".replace(',', '\u202f')
    log_activity(
        etype,
        student=instance.student,
        payment=instance,
        summary=(
            f"Payment {instance.get_status_display()}: "
            f"{amount_fmt} UZS \u2022 {instance.credits_amount} credits"
        ),
        metadata={
            'method':   instance.method,
            'provider': instance.provider,
            'receipt':  instance.receipt_id,
        },
    )


# ── ACTIVITY: Lesson lifecycle ───────────────────────────────────────────────
@receiver(post_save, sender='scheduling.Lesson')
def on_lesson_activity(sender, instance, created, update_fields, **kwargs):
    """
    Creates an ActivityEvent when a lesson is scheduled (created) or its
    status changes to a meaningful terminal state.
    Runs AFTER create_earnings_on_lesson_complete so earnings are already
    recorded when this fires.
    """
    from accounts.services.activity_log import log_activity

    if created:
        student_name = (getattr(instance.student, 'full_name', None)
                        or instance.student.phone_number)
        teacher_name = (getattr(instance.teacher, 'full_name', None)
                        or instance.teacher.phone_number)
        log_activity(
            ActivityEvent.EventType.LESSON_SCHEDULED,
            lesson=instance,
            summary=(
                f"Lesson scheduled: {student_name}"
                f" with {teacher_name} on {instance.lesson_date}"
            ),
        )
        return

    if update_fields is not None and 'status' not in update_fields:
        return

    _STATUS_MAP = {
        'CANCELLED':      ActivityEvent.EventType.LESSON_CANCELLED,
        'COMPLETED':      ActivityEvent.EventType.LESSON_COMPLETED,
        'STUDENT_ABSENT': ActivityEvent.EventType.LESSON_ABSENT,
    }
    etype = _STATUS_MAP.get(instance.status)
    if not etype:
        return

    student_name = (getattr(instance.student, 'full_name', None)
                    or instance.student.phone_number)

    # For COMPLETED: link both the EarningsEvent and the CreditTransaction
    earnings_ev = None
    credit_tx_ev = None
    if etype == ActivityEvent.EventType.LESSON_COMPLETED:
        earnings_ev = EarningsEvent.objects.filter(
            lesson=instance, event_type='lesson_credit'
        ).first()
        # CreditTransaction FK: student → StudentProfile
        from accounts.models import CreditTransaction
        credit_tx_ev = CreditTransaction.objects.filter(
            lesson=instance, reason_code=CreditTransaction.Reason.LESSON
        ).first()

    log_activity(
        etype,
        lesson=instance,
        earnings_event=earnings_ev,
        credit_tx=credit_tx_ev,
        summary=f"Lesson #{instance.id} {instance.get_status_display().lower()} — {student_name}",
    )


# ── ACTIVITY: Teacher payout ─────────────────────────────────────────────────
@receiver(post_save, sender=EarningsEvent)
def on_teacher_payout(sender, instance, created, **kwargs):
    """
    Records ActivityEvent when an admin creates a Payout EarningsEvent.
    """
    if not created or instance.event_type != EarningsEvent.EventType.PAYOUT:
        return

    from accounts.services.activity_log import log_activity
    amount_fmt = f"{abs(int(instance.amount_uzs)):,}".replace(',', '\u202f')
    name = getattr(instance.teacher, 'full_name', None) or instance.teacher.phone_number
    log_activity(
        ActivityEvent.EventType.TEACHER_PAYOUT,
        teacher=instance.teacher,
        earnings_event=instance,
        summary=f"Payout to {name}: {amount_fmt} UZS" + (
            f" (ref: {instance.payout_ref})" if instance.payout_ref else ""
        ),
        metadata={'payout_ref': instance.payout_ref, 'amount_uzs': str(instance.amount_uzs)},
    )
