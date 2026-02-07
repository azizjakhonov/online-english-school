from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from scheduling.models import LessonSlot


class BookingFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.teacher = User.objects.create_user(
            username="t_test",
            email="t_test@example.com",
            password="pass12345",
            role=User.Roles.TEACHER,
        )
        self.student = User.objects.create_user(
            username="s_test",
            email="s_test@example.com",
            password="pass12345",
            role=User.Roles.STUDENT,
        )

        # Profiles auto-created by signal, but we can rely on relations:
        self.teacher_profile = self.teacher.teacher_profile
        self.student_profile = self.student.student_profile

        start = timezone.now() + timedelta(days=1)
        end = start + timedelta(minutes=60)

        self.slot = LessonSlot.objects.create(
            teacher=self.teacher_profile,
            start_datetime=start,
            end_datetime=end,
            is_booked=False,
        )

    def auth_as(self, user: User):
        self.client.force_authenticate(user=user)

    def test_student_can_book_slot_and_lesson_created(self):
        self.auth_as(self.student)

        res = self.client.post("/api/bookings/", {"slot_id": self.slot.id}, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.data.get("lesson_created"))

        # slot becomes booked
        self.slot.refresh_from_db()
        self.assertTrue(self.slot.is_booked)

    def test_teacher_cannot_book_slot(self):
        self.auth_as(self.teacher)
        res = self.client.post("/api/bookings/", {"slot_id": self.slot.id}, format="json")
        self.assertEqual(res.status_code, 400)  # ValidationError in your code
