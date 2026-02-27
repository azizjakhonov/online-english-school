from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User, TeacherProfile, StudentProfile
from scheduling.models import LessonSlot
from lessons.models import Lesson


class BookingCreatesLessonTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.teacher_user = User.objects.create_user(
            username="t_book",
            email="t_book@test.com",
            password="test12345",
            role=User.Roles.TEACHER,
        )
        self.student_user = User.objects.create_user(
            username="s_book",
            email="s_book@test.com",
            password="test12345",
            role=User.Roles.STUDENT,
        )

        self.teacher = TeacherProfile.objects.get(user=self.teacher_user)
        self.student = StudentProfile.objects.get(user=self.student_user)

        start = timezone.now() + timedelta(days=2)
        end = start + timedelta(hours=1)

        self.slot = LessonSlot.objects.create(
            teacher=self.teacher,
            start_datetime=start,
            end_datetime=end,
            is_booked=False,
        )

    def test_student_booking_creates_lesson(self):
        self.client.force_authenticate(user=self.student_user)

        res = self.client.post("/api/bookings/", {"slot_id": self.slot.id}, format="json")
        self.assertEqual(res.status_code, 201)

        self.slot.refresh_from_db()
        self.assertTrue(self.slot.is_booked)

        lesson = Lesson.objects.get(booking__slot=self.slot)
        self.assertEqual(lesson.teacher, self.teacher)
        self.assertEqual(lesson.student, self.student)
