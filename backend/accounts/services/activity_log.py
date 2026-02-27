"""
accounts/services/activity_log.py

Centralised ActivityEvent creation service.
All event-logging code should call log_activity() to guarantee consistent
population of all FK reference fields (subject_student, subject_teacher,
lesson_id_ref, payment_id, credit_tx_id, earnings_event_id).

Usage:
    from accounts.services.activity_log import log_activity

    log_activity(
        'lesson_scheduled',
        actor=request.user,        # optional – set when a request context exists
        lesson=lesson_instance,    # resolves student + teacher automatically
    )
"""
from __future__ import annotations


def log_activity(
    event_type: str,
    *,
    actor=None,
    student=None,           # User (role=STUDENT) OR StudentProfile
    teacher=None,           # User (role=TEACHER) OR TeacherProfile
    lesson=None,            # scheduling.Lesson instance
    payment=None,           # payments.Payment instance
    credit_tx=None,         # any object with .pk (future CreditTransaction)
    earnings_event=None,    # accounts.EarningsEvent instance
    summary: str | None = None,
    metadata: dict | None = None,
):
    """
    Create (or retrieve) an ActivityEvent with all reference fields populated.

    Idempotency:
        Uses get_or_create keyed on (event_type, <most-specific-id>).
        If an existing event is found, any newly-available NULL fields are
        backfilled without overwriting non-null ones.

    Returns:
        ActivityEvent instance
    """
    from accounts.models import ActivityEvent, StudentProfile, TeacherProfile

    # ── Resolve StudentProfile ──────────────────────────────────────────────────
    subject_student = None
    if student is not None:
        if isinstance(student, StudentProfile):
            subject_student = student
        else:
            subject_student = getattr(student, 'student_profile', None)

    # ── Resolve TeacherProfile ──────────────────────────────────────────────────
    subject_teacher = None
    if teacher is not None:
        if isinstance(teacher, TeacherProfile):
            subject_teacher = teacher
        else:
            subject_teacher = getattr(teacher, 'teacher_profile', None)

    # ── Auto-resolve from lesson (if not already provided) ─────────────────────
    if lesson is not None:
        if subject_student is None:
            subject_student = getattr(
                getattr(lesson, 'student', None), 'student_profile', None
            )
        if subject_teacher is None:
            subject_teacher = getattr(
                getattr(lesson, 'teacher', None), 'teacher_profile', None
            )

    # ── Soft-reference IDs (no FK constraints — safe against cascades) ──────────
    lesson_id_ref     = lesson.pk          if lesson         else None
    payment_id        = payment.pk         if payment        else None
    credit_tx_id      = credit_tx.pk       if credit_tx      else None
    earnings_event_id = earnings_event.pk  if earnings_event else None

    # ── Auto-generate summary if none provided ──────────────────────────────────
    if not summary:
        parts = [f"[{event_type.replace('_', ' ')}]"]
        if subject_student:
            u = getattr(subject_student, 'user', None)
            name = (getattr(u, 'full_name', None) or getattr(u, 'phone_number', '?')) if u else '?'
            parts.append(name)
        if lesson_id_ref:
            parts.append(f"lesson #{lesson_id_ref}")
        summary = " ".join(parts)

    # ── Dedup key: most specific ID available ───────────────────────────────────
    dedup = {'event_type': event_type}
    if lesson_id_ref is not None:
        dedup['lesson_id_ref'] = lesson_id_ref
    elif payment_id is not None:
        dedup['payment_id'] = payment_id
    elif earnings_event_id is not None:
        dedup['earnings_event_id'] = earnings_event_id

    # ── Build defaults (only non-null values get set on create) ────────────────
    defaults: dict = {'summary': summary, 'metadata': metadata or {}}
    if subject_student   is not None: defaults['subject_student']   = subject_student
    if subject_teacher   is not None: defaults['subject_teacher']   = subject_teacher
    if actor             is not None: defaults['actor']             = actor
    if payment_id        is not None and 'payment_id'        not in dedup:
        defaults['payment_id']        = payment_id
    if credit_tx_id      is not None: defaults['credit_tx_id']      = credit_tx_id
    if earnings_event_id is not None and 'earnings_event_id' not in dedup:
        defaults['earnings_event_id'] = earnings_event_id

    event, created = ActivityEvent.objects.get_or_create(**dedup, defaults=defaults)

    # ── Backfill any newly-available NULL fields without overwriting ────────────
    if not created:
        updates: list[str] = []
        _backfill = [
            ('subject_student',   subject_student),
            ('subject_teacher',   subject_teacher),
            ('actor',             actor),
            ('credit_tx_id',      credit_tx_id),
            ('earnings_event_id', earnings_event_id),
        ]
        for field, value in _backfill:
            if value is not None and getattr(event, field) is None:
                setattr(event, field, value)
                updates.append(field)
        if updates:
            event.save(update_fields=updates)

    return event
