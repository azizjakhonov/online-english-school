"""
accounts/tests_credit_concurrency.py

Real OS-thread concurrency test for the credit reserve logic.

IMPORTANT: Must be run in ISOLATION from other test modules:
    python manage.py test accounts.tests_credit_concurrency --verbosity=2

Reason: Uses TransactionTestCase which flushes the entire DB after each test.
When mixed with regular TestCase tests in one runner invocation, the teardown
can block if threads still hold PostgreSQL connections. Running alone avoids
this entirely.
"""

import threading

from django.test import TransactionTestCase
from django.db import transaction

from accounts.models import StudentProfile, TeacherProfile
from scheduling.models import Lesson
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


def _make_teacher(phone='+998960000001', rate=200_000):
    u = User.objects.create(phone_number=phone, full_name='ConcTeacher', role=User.Roles.TEACHER)
    profile, _ = TeacherProfile.objects.get_or_create(user=u)
    profile.rate_per_lesson_uzs = rate
    profile.save()
    return u


def _make_student(phone='+998970000001', lesson_credits=1, credits_reserved=0):
    u = User.objects.create(phone_number=phone, full_name='ConcStudent', role=User.Roles.STUDENT)
    profile, _ = StudentProfile.objects.get_or_create(user=u)
    profile.lesson_credits   = lesson_credits
    profile.credits_reserved = credits_reserved
    profile.save()
    return u


class RealConcurrencyTest(TransactionTestCase):
    """
    Spins up two OS threads that simultaneously attempt to reserve a credit
    for a student who has exactly 1 available credit.
    select_for_update() at the DB level must ensure only ONE succeeds.

    Both threads call connections.close_all() in their finally block so that
    TransactionTestCase teardown can acquire the DB for flushing.
    """

    def setUp(self):
        self.teacher = _make_teacher()
        self.student = _make_student(lesson_credits=1, credits_reserved=0)

    def _try_reserve_thread(self, results, index, barrier):
        """
        Thread entry point: waits at the barrier, then atomically tries to
        increment credits_reserved. Closes DB connection before returning.
        """
        try:
            barrier.wait()  # both threads start simultaneously
            try:
                from django.db.models import F
                with transaction.atomic():
                    profile = StudentProfile.objects.select_for_update().get(
                        user=self.student
                    )
                    available = profile.lesson_credits - profile.credits_reserved
                    if available < 1:
                        results[index] = 'BLOCKED'
                        return
                    StudentProfile.objects.filter(pk=profile.pk).update(
                        credits_reserved=F('credits_reserved') + 1
                    )
                    results[index] = 'OK'
            except Exception as e:
                results[index] = f'ERROR:{e}'
        finally:
            # Must close the thread's connection so TransactionTestCase can flush.
            from django.db import connections
            connections.close_all()

    def test_concurrent_bookings_only_one_reserves(self):
        """
        Two threads compete to reserve 1 available credit.
        Exactly one must succeed; credits_reserved must end at 1, not 2.
        """
        results = [None, None]
        barrier = threading.Barrier(2)

        t0 = threading.Thread(target=self._try_reserve_thread, args=(results, 0, barrier))
        t1 = threading.Thread(target=self._try_reserve_thread, args=(results, 1, barrier))

        t0.start()
        t1.start()
        t0.join(timeout=15)
        t1.join(timeout=15)

        self.assertIsNotNone(results[0], "Thread 0 timed out")
        self.assertIsNotNone(results[1], "Thread 1 timed out")

        ok_count      = sum(1 for r in results if r == 'OK')
        blocked_count = sum(1 for r in results if r == 'BLOCKED')

        self.assertEqual(ok_count,      1, f"Expected exactly 1 OK, got: {results}")
        self.assertEqual(blocked_count, 1, f"Expected exactly 1 BLOCKED, got: {results}")

        profile = StudentProfile.objects.get(user=self.student)
        self.assertEqual(
            profile.credits_reserved, 1,
            f"credits_reserved must be 1 after race, got: {profile.credits_reserved}"
        )
