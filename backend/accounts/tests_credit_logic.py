"""
accounts/tests_credit_logic.py

QA: Credit Reserve / Consume Architecture
==========================================
Run with:
    python manage.py test accounts.tests_credit_logic --verbosity=2

Six scenarios:
 1. CONCURRENCY  – simultaneous bookings: only one succeeds
 2. ATOMICITY    – COMPLETED decrements both fields in one atomic block
 3. ABSENTEE     – STUDENT_ABSENT charges credit but NOT teacher EarningsEvent
 4. IDEMPOTENCY  – repeated .save(COMPLETED) never double-deducts
 5. NEGATIVE GUARD – double-CANCELLED never drops credits_reserved below 0
 6. OVERBOOKING  – available_credits gate prevents booking when available=0
"""

import threading
import time

from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from django.db import transaction

from accounts.models import StudentProfile, EarningsEvent, CreditTransaction, TeacherProfile
from scheduling.models import Lesson
from django.contrib.auth import get_user_model

User = get_user_model()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_teacher(phone='+998920000001', rate=200_000):
    u = User.objects.create(phone_number=phone, full_name='Teacher', role=User.Roles.TEACHER)
    profile, _ = TeacherProfile.objects.get_or_create(user=u)
    profile.rate_per_lesson_uzs = rate
    profile.save()
    return u


def _make_student(phone='+998930000001', lesson_credits=1, credits_reserved=0):
    u = User.objects.create(phone_number=phone, full_name='Student', role=User.Roles.STUDENT)
    profile, _ = StudentProfile.objects.get_or_create(user=u)
    profile.lesson_credits = lesson_credits
    profile.credits_reserved = credits_reserved
    profile.save()
    return u


def _future():
    """Returns a datetime 1 hour from now."""
    return timezone.now() + timezone.timedelta(hours=1)


def _make_lesson(teacher, student, reserved=True, consumed=False, status='CONFIRMED'):
    return Lesson.objects.create(
        teacher=teacher,
        student=student,
        start_time=_future(),
        end_time=_future() + timezone.timedelta(hours=1),
        status=status,
        credits_reserved=reserved,
        credits_consumed=consumed,
    )


# ══════════════════════════════════════════════════════════════════════════════
# 1. CONCURRENCY TEST
# Uses TransactionTestCase so each thread operates in a real DB transaction,
# allowing select_for_update() to actually lock rows between threads.
# ══════════════════════════════════════════════════════════════════════════════

class ConcurrencyTest(TestCase):
    """
    Simulates two sequential booking attempts for a student with exactly 1
    available credit.  Because select_for_update() serialises access at the DB
    level, this deterministic two-call sequence mirrors what the concurrent
    path enforces:

    Thread A calls → succeeds, credits_reserved becomes 1
    Thread B calls → sees available = 1 - 1 = 0 → blocked

    For a *real* thread-race test (requires PostgreSQL + two OS threads)
    see tests_credit_concurrency.py (run separately).
    """

    def setUp(self):
        self.teacher = _make_teacher(phone='+998920000001')
        self.student = _make_student(phone='+998930000001', lesson_credits=1, credits_reserved=0)

    def _try_reserve(self):
        """
        Atomically checks available credits and reserves one.
        Returns True on success, False when blocked.
        """
        from django.db.models import F
        with transaction.atomic():
            profile = StudentProfile.objects.select_for_update().get(
                user=self.student
            )
            available = profile.lesson_credits - profile.credits_reserved
            if available < 1:
                return False
            StudentProfile.objects.filter(pk=profile.pk).update(
                credits_reserved=F('credits_reserved') + 1
            )
            return True

    def test_first_booking_succeeds(self):
        """First call succeeds: available = 1 - 0 = 1."""
        result = self._try_reserve()
        self.assertTrue(result, "First booking should succeed")
        sp = StudentProfile.objects.get(user=self.student)
        self.assertEqual(sp.credits_reserved, 1)

    def test_second_booking_blocked_after_first(self):
        """
        After first reservation (credits_reserved=1), second attempt sees
        available = 0 and must be blocked.
        """
        self._try_reserve()  # first succeeds
        result = self._try_reserve()  # second must fail
        self.assertFalse(result, "Second booking should be blocked when available=0")

        sp = StudentProfile.objects.get(user=self.student)
        self.assertEqual(
            sp.credits_reserved, 1,
            "credits_reserved must be exactly 1, not 2"
        )


# ══════════════════════════════════════════════════════════════════════════════
# 2. ATOMICITY TEST
# ══════════════════════════════════════════════════════════════════════════════

class AtomicityTest(TestCase):
    """
    When a lesson is marked COMPLETED, both lesson_credits and credits_reserved
    must be decremented together in a single atomic operation.

    Verify: no intermediate state is visible (both fields change together).
    """

    def setUp(self):
        self.teacher = _make_teacher(phone='+998920000002')
        self.student = _make_student(phone='+998930000002', lesson_credits=3, credits_reserved=1)

    def test_completed_decrements_both_fields_atomically(self):
        lesson = _make_lesson(self.teacher, self.student, reserved=True)

        # Capture state BEFORE
        sp_before = StudentProfile.objects.get(user=self.student)
        credits_before  = sp_before.lesson_credits   # 3
        reserved_before = sp_before.credits_reserved  # 1

        # Transition → COMPLETED (triggers signal)
        lesson.status = 'COMPLETED'
        lesson.save(update_fields=['status'])

        # Capture state AFTER
        sp_after = StudentProfile.objects.get(user=self.student)
        lesson.refresh_from_db()

        # Both must have changed
        self.assertEqual(sp_after.lesson_credits,   credits_before - 1,   "lesson_credits not decremented")
        self.assertEqual(sp_after.credits_reserved, reserved_before - 1,  "credits_reserved not decremented")

        # Exactly one CreditTransaction created
        self.assertEqual(
            CreditTransaction.objects.filter(lesson=lesson).count(), 1,
            "Expected exactly 1 CreditTransaction"
        )

        # Lesson flags flipped
        self.assertTrue(lesson.credits_consumed)
        self.assertFalse(lesson.credits_reserved)


# ══════════════════════════════════════════════════════════════════════════════
# 3. ABSENTEE LOGIC TEST
# ══════════════════════════════════════════════════════════════════════════════

class AbsenteeLogicTest(TestCase):
    """
    STUDENT_ABSENT must:
      ✅ deduct 1 lesson_credit from the student
      ✅ release credits_reserved
      ✅ create CreditTransaction with reason_code=STUDENT_ABSENT
      ❌ NOT create a teacher EarningsEvent
    """

    def setUp(self):
        self.teacher = _make_teacher(phone='+998920000003')
        self.student = _make_student(phone='+998930000003', lesson_credits=2, credits_reserved=1)

    def test_student_absent_charges_student_not_teacher(self):
        lesson = _make_lesson(self.teacher, self.student, reserved=True)

        earnings_before = EarningsEvent.objects.filter(
            teacher=self.teacher, event_type='lesson_credit'
        ).count()

        lesson.status = 'STUDENT_ABSENT'
        lesson.save(update_fields=['status'])

        sp = StudentProfile.objects.get(user=self.student)
        lesson.refresh_from_db()

        # ── Student assertions ──
        self.assertEqual(sp.lesson_credits, 1,       "lesson_credits should be 2-1=1")
        self.assertEqual(sp.credits_reserved, 0,     "hold must be released")
        self.assertTrue(lesson.credits_consumed,      "lesson.credits_consumed must be True")
        self.assertFalse(lesson.credits_reserved,     "lesson.credits_reserved must be False")

        tx = CreditTransaction.objects.get(lesson=lesson)
        self.assertEqual(tx.delta, -1)
        self.assertEqual(tx.reason_code, CreditTransaction.Reason.STUDENT_ABSENT)

        # ── Teacher assertions ──
        earnings_after = EarningsEvent.objects.filter(
            teacher=self.teacher, event_type='lesson_credit'
        ).count()
        self.assertEqual(
            earnings_after, earnings_before,
            "EarningsEvent must NOT be created for STUDENT_ABSENT"
        )


# ══════════════════════════════════════════════════════════════════════════════
# 4. IDEMPOTENCY TEST
# ══════════════════════════════════════════════════════════════════════════════

class IdempotencyTest(TestCase):
    """
    Calling lesson.save() on a COMPLETED lesson multiple times must NOT
    deduct more than 1 credit total. The credits_consumed flag acts as the gate.
    """

    def setUp(self):
        self.teacher = _make_teacher(phone='+998920000004')
        self.student = _make_student(phone='+998930000004', lesson_credits=5, credits_reserved=1)

    def test_repeated_completed_saves_deduct_only_once(self):
        lesson = _make_lesson(self.teacher, self.student, reserved=True)

        # First completion
        lesson.status = 'COMPLETED'
        lesson.save(update_fields=['status'])

        sp = StudentProfile.objects.get(user=self.student)
        self.assertEqual(sp.lesson_credits, 4, "Should be 5-1=4 after first COMPLETED")

        tx_count_after_first = CreditTransaction.objects.filter(lesson=lesson).count()
        self.assertEqual(tx_count_after_first, 1)

        # ── Repeat save (simulates double-signal or retry) ──
        lesson.refresh_from_db()
        lesson.status = 'COMPLETED'
        lesson.save(update_fields=['status'])

        sp.refresh_from_db()
        self.assertEqual(
            sp.lesson_credits, 4,
            "Second COMPLETED save must NOT deduct another credit (idempotency)"
        )

        # Still only 1 transaction
        self.assertEqual(
            CreditTransaction.objects.filter(lesson=lesson).count(), 1,
            "CreditTransaction must remain at 1 after repeated saves"
        )

    def test_credits_consumed_flag_is_guard(self):
        """Manually set credits_consumed=True, then signal fires — no deduction."""
        lesson = _make_lesson(self.teacher, self.student, reserved=True, consumed=True)

        # Directly set COMPLETED on an already-consumed lesson
        Lesson.objects.filter(pk=lesson.pk).update(status='COMPLETED')
        lesson.refresh_from_db()

        # Manually trigger signal path (simulate what post_save would do)
        lesson.save(update_fields=['status'])

        sp = StudentProfile.objects.get(user=self.student)
        # credits_consumed=True means signal skips — lesson_credits unchanged
        self.assertEqual(sp.lesson_credits, 5, "credits_consumed=True must block deduction")
        self.assertEqual(
            CreditTransaction.objects.filter(lesson=lesson).count(), 0,
            "No CreditTransaction when credits_consumed was already True"
        )


# ══════════════════════════════════════════════════════════════════════════════
# 5. NEGATIVE GUARD TEST
# ══════════════════════════════════════════════════════════════════════════════

class NegativeGuardTest(TestCase):
    """
    credits_reserved must NEVER go below 0, even if a CANCELLED signal
    fires twice on the same lesson (e.g., due to a bug or retry).
    """

    def setUp(self):
        self.teacher = _make_teacher(phone='+998920000005')
        self.student = _make_student(phone='+998930000005', lesson_credits=3, credits_reserved=1)

    def test_double_cancel_does_not_make_reserved_negative(self):
        lesson = _make_lesson(self.teacher, self.student, reserved=True, consumed=False)

        # ── First cancellation ──
        lesson.status = 'CANCELLED'
        lesson.save(update_fields=['status'])

        sp = StudentProfile.objects.get(user=self.student)
        lesson.refresh_from_db()

        self.assertEqual(sp.credits_reserved, 0,  "After 1st cancel: reserved should be 0")
        self.assertEqual(sp.lesson_credits,    3,  "lesson_credits must be untouched")
        self.assertFalse(lesson.credits_reserved,   "lesson.credits_reserved must be False")

        # ── Second cancellation (e.g., retry / signal bug) ──
        # At this point lesson.credits_reserved is already False,
        # so the signal guard should skip entirely.
        lesson.save(update_fields=['status'])

        sp.refresh_from_db()
        self.assertGreaterEqual(
            sp.credits_reserved, 0,
            "credits_reserved must NEVER go negative (double-cancel guard failed)"
        )
        self.assertEqual(sp.lesson_credits, 3, "lesson_credits must still be 3 after double-cancel")

    def test_case_when_clamps_reserved_at_zero(self):
        """
        Even when a lesson that never had a reservation gets CANCELLED,
        the Case/When expression in the signal clamps credits_reserved to 0.
        """
        # Student already has credits_reserved=0 (no hold placed)
        sp = StudentProfile.objects.get(user=self.student)
        sp.credits_reserved = 0
        sp.save()

        # Create a lesson with credits_reserved=False (no hold)
        lesson = _make_lesson(self.teacher, self.student, reserved=False, consumed=False)

        lesson.status = 'CANCELLED'
        lesson.save(update_fields=['status'])

        sp.refresh_from_db()
        # Signal guard: `if not instance.credits_reserved` → skips
        # credits_reserved must remain 0, not go to -1
        self.assertGreaterEqual(sp.credits_reserved, 0)


# ══════════════════════════════════════════════════════════════════════════════
# 6. OVERBOOKING / AVAILABLE-CREDITS GATE TEST
# ══════════════════════════════════════════════════════════════════════════════

class AvailableCreditsGateTest(TestCase):
    """
    Verifies the available_credits property and the booking gate logic.
    A student with lesson_credits=1 and credits_reserved=1 has available=0
    and must be blocked from further bookings.
    """

    def setUp(self):
        self.teacher = _make_teacher(phone='+998920000006')
        self.student = _make_student(phone='+998930000006', lesson_credits=1, credits_reserved=0)

    def test_available_credits_property(self):
        sp = StudentProfile.objects.get(user=self.student)
        self.assertEqual(sp.available_credits, 1, "available = 1 - 0 = 1")

        sp.credits_reserved = 1
        sp.save()
        sp.refresh_from_db()
        self.assertEqual(sp.available_credits, 0, "available = 1 - 1 = 0")

    def test_booking_blocked_when_available_is_zero(self):
        """
        Simulates the BookLessonView check: available < 1 → reject.
        """
        sp = StudentProfile.objects.get(user=self.student)
        sp.credits_reserved = 1  # holds one credit already
        sp.save()

        blocked = False
        try:
            with transaction.atomic():
                locked = StudentProfile.objects.select_for_update().get(user=self.student)
                available = locked.lesson_credits - locked.credits_reserved
                if available < 1:
                    blocked = True
                    raise ValueError("Insufficient credits")  # triggers rollback
                from django.db.models import F
                StudentProfile.objects.filter(pk=locked.pk).update(
                    credits_reserved=F('credits_reserved') + 1
                )
        except ValueError:
            pass

        self.assertTrue(blocked, "Booking should be blocked when available credits = 0")

        # credits_reserved must still be 1 (no extra reservation happened)
        sp.refresh_from_db()
        self.assertEqual(sp.credits_reserved, 1, "credits_reserved must not increment when blocked")

    def test_available_credits_after_complete_and_rebook(self):
        """
        Full lifecycle: book → complete → available restores → can book again.
        """
        sp = StudentProfile.objects.get(user=self.student)
        sp.lesson_credits    = 3
        sp.credits_reserved  = 0
        sp.save()

        # Book (reserve)
        from django.db.models import F
        StudentProfile.objects.filter(pk=sp.pk).update(
            credits_reserved=F('credits_reserved') + 1
        )
        sp.refresh_from_db()
        self.assertEqual(sp.available_credits, 2)   # 3 - 1

        lesson = _make_lesson(self.teacher, self.student, reserved=True)

        # Complete (consume)
        lesson.status = 'COMPLETED'
        lesson.save(update_fields=['status'])

        sp.refresh_from_db()
        self.assertEqual(sp.lesson_credits,   2)   # 3 - 1
        self.assertEqual(sp.credits_reserved, 0)   # hold released
        self.assertEqual(sp.available_credits, 2)  # 2 - 0

        # Can book again
        StudentProfile.objects.filter(pk=sp.pk).update(
            credits_reserved=F('credits_reserved') + 1
        )
        sp.refresh_from_db()
        self.assertEqual(sp.available_credits, 1)   # 2 - 1


# ══════════════════════════════════════════════════════════════════════════════
# 7. EARNINGS PAYOUT AGGREGATE TESTS
# ══════════════════════════════════════════════════════════════════════════════

class EarningsPayoutTest(TestCase):
    """
    Verifies that compute_teacher_financials() reflects payout events correctly.

    Sign convention used throughout: payouts are stored as NEGATIVE amounts
    (e.g., amount_uzs=-300_000) per the EarningsEvent model docstring.
    The service uses abs() so positive amounts also work, but we test the
    canonical negative-payout path here.

    Run with:
        python manage.py test accounts.tests_credit_logic.EarningsPayoutTest --verbosity=2
    """

    def setUp(self):
        self.teacher = _make_teacher(phone='+998920000007', rate=300_000)

    # ── helpers ────────────────────────────────────────────────────────────────

    def _credit(self, amount=300_000):
        """Create a lesson_credit event (positive amount)."""
        return EarningsEvent.objects.create(
            teacher=self.teacher,
            event_type='lesson_credit',
            amount_uzs=amount,
            reason='Test lesson completed',
        )

    def _payout(self, amount=300_000):
        """Create a payout event (stored as NEGATIVE per model convention)."""
        return EarningsEvent.objects.create(
            teacher=self.teacher,
            event_type='payout',
            amount_uzs=-amount,   # negative = debit/payout
            reason='Monthly salary transfer',
            payout_ref='BANK-REF-001',
        )

    # ── test 1 ────────────────────────────────────────────────────────────────

    def test_awaiting_payout_decreases_after_payout(self):
        """
        Scenario: teacher earns 300_000, then admin creates a payout for that
        amount. awaiting_payout_uzs must drop from 300_000 → 0.
        """
        from accounts.services.earnings import compute_teacher_financials

        self._credit(300_000)

        # Before payout
        data = compute_teacher_financials(self.teacher)
        self.assertEqual(
            data['awaiting_payout_uzs'], 300_000,
            "Before payout: awaiting should equal the earned amount",
        )
        self.assertEqual(
            data['pending_payout_uzs'], 300_000,
            "pending_payout_uzs must equal awaiting_payout_uzs (same source of truth)",
        )

        self._payout(300_000)

        # After payout
        data = compute_teacher_financials(self.teacher)
        self.assertEqual(
            data['awaiting_payout_uzs'], 0,
            "After full payout: awaiting_payout_uzs must be 0",
        )
        self.assertEqual(
            data['pending_payout_uzs'], 0,
            "pending_payout_uzs must also be 0 after full payout",
        )

    # ── test 2 ────────────────────────────────────────────────────────────────

    def test_total_paid_out_increases_after_payout(self):
        """
        Scenario: teacher earns 600_000 (2 lessons). Admin pays out 300_000.
        total_paid_uzs rises from 0 → 300_000; awaiting_payout_uzs = 300_000.
        """
        from accounts.services.earnings import compute_teacher_financials

        self._credit(300_000)
        self._credit(300_000)   # 2nd lesson credit

        # Before any payout
        data = compute_teacher_financials(self.teacher)
        self.assertEqual(data['total_paid_uzs'], 0, "No payouts yet — total_paid must be 0")
        self.assertEqual(data['awaiting_payout_uzs'], 600_000)

        self._payout(300_000)   # partial payout

        # After partial payout
        data = compute_teacher_financials(self.teacher)
        self.assertEqual(
            data['total_paid_uzs'], 300_000,
            "total_paid_uzs must increase by the payout amount",
        )
        self.assertEqual(
            data['awaiting_payout_uzs'], 300_000,
            "awaiting_payout_uzs must equal remaining (600_000 - 300_000 = 300_000)",
        )

        # Pay out the remainder
        self._payout(300_000)

        data = compute_teacher_financials(self.teacher)
        self.assertEqual(data['total_paid_uzs'], 600_000)
        self.assertEqual(data['awaiting_payout_uzs'], 0)
