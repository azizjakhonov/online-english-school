from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User, TeacherProfile, StudentProfile
from scheduling.models import LessonSlot, LessonBooking
from lessons.models import Lesson


class ProgressFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.teacher_user = User.objects.create_user(
            username="t_prog",
            email="t_prog@test.com",
            password="test12345",
            role=User.Roles.TEACHER,
        )
        self.student_user = User.objects.create_user(
            username="s_prog",
            email="s_prog@test.com",
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
            )

    def test_teacher_creates_progress_student_views(self):
        self.client.force_authenticate(user=self.teacher_user)

        payload = {
            "speaking": 4,
            "grammar": 3,
            "vocabulary": 4,
            "listening": 5,
            "teacher_feedback": "Nice work.",
        }

        res = self.client.post(f"/api/lessons/{self.lesson.id}/progress/", payload, format="json")
        self.assertEqual(res.status_code, 201)

        self.client.force_authenticate(user=self.student_user)
        res2 = self.client.get("/api/my/progress/")
        self.assertEqual(res2.status_code, 200)

        # depending on your response format, could be list or dict
        self.assertTrue(res2.data)
