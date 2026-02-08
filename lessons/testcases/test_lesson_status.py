from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User, TeacherProfile, StudentProfile
from scheduling.models import LessonSlot, LessonBooking
from lessons.models import Lesson


class LessonStatusTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.teacher_user = User.objects.create_user(
            username="t_stat",
            email="t_stat@test.com",
            password="test12345",
            role=User.Roles.TEACHER,
        )
        self.student_user = User.objects.create_user(
            username="s_stat",
            email="s_stat@test.com",
            password="test12345",
            role=User.Roles.STUDENT,
        )

        self.teacher = TeacherProfile.objects.get(user=self.teacher_user)
        self.student = StudentProfile.objects.get(user=self.student_user)

        start = timezone.now() + timedelta(days=1)
        end = start + timedelta(hours=1)

        slot = LessonSlot.objects.create(
            teacher=self.teacher,
            start_datetime=start,
            end_datetime=end,
            is_booked=True,
        )

        booking = LessonBooking.objects.create(slot=slot, student=self.student)

        # ✅ IMPORTANT: if your app auto-creates Lesson for a booking, use it
        self.lesson = Lesson.objects.filter(booking=booking).first()
        if self.lesson is None:
            self.lesson = Lesson.objects.create(
                booking=booking,
                teacher=self.teacher,
                student=self.student,
                start_datetime=start,
                end_datetime=end,
                status=Lesson.Status.SCHEDULED,
            )

    def test_teacher_can_cancel(self):
        self.client.force_authenticate(user=self.teacher_user)
        res = self.client.patch(
            f"/api/lessons/{self.lesson.id}/status/",
            {"status": "CANCELLED"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)

    def test_student_cannot_update_status(self):
        self.client.force_authenticate(user=self.student_user)
        res = self.client.patch(
            f"/api/lessons/{self.lesson.id}/status/",
            {"status": "CANCELLED"},
            format="json",
        )
        self.assertIn(res.status_code, (400, 403))
