from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from scheduling.models import LessonSlot, LessonBooking
from lessons.models import Lesson
from homework.models import Homework, HomeworkSubmission


class HomeworkFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.teacher = User.objects.create_user(
            username="t_hw",
            email="t_hw@example.com",
            password="pass12345",
            role=User.Roles.TEACHER,
        )
        self.student = User.objects.create_user(
            username="s_hw",
            email="s_hw@example.com",
            password="pass12345",
            role=User.Roles.STUDENT,
        )

        tprof = self.teacher.teacher_profile
        sprof = self.student.student_profile

        start = timezone.now() + timedelta(days=1)
        end = start + timedelta(minutes=60)

        slot = LessonSlot.objects.create(
            teacher=tprof,
            start_datetime=start,
            end_datetime=end,
            is_booked=True,
        )

        booking = LessonBooking.objects.create(slot=slot, student=sprof)

        # booking should auto-create lesson (your project logic)
        self.lesson = booking.lesson


    def auth_as(self, user: User):
        self.client.force_authenticate(user=user)

    def test_teacher_assign_student_submit_teacher_review(self):
        # teacher assigns
        self.auth_as(self.teacher)
        due = (timezone.now() + timedelta(days=2)).isoformat().replace("+00:00", "Z")
        res = self.client.post(
            f"/api/lessons/{self.lesson.id}/homework/",
            {"task_text": "Do exercise 1", "due_date": due},
            format="json",
        )
        self.assertEqual(res.status_code, 201)

        hw_id = res.data["homework_id"]
        self.assertTrue(Homework.objects.filter(id=hw_id).exists())

        # student submits
        self.auth_as(self.student)
        res2 = self.client.post(
            f"/api/homework/{hw_id}/submit/",
            {"answer_text": "My answer"},
            format="json",
        )
        self.assertEqual(res2.status_code, 201)
        self.assertTrue(HomeworkSubmission.objects.filter(homework_id=hw_id).exists())

        # teacher reviews
        self.auth_as(self.teacher)
        res3 = self.client.patch(
            f"/api/homework/{hw_id}/review/",
            {"is_checked": True, "teacher_comment": "Good job"},
            format="json",
        )
        self.assertEqual(res3.status_code, 200)

        sub = HomeworkSubmission.objects.get(homework_id=hw_id)
        self.assertTrue(sub.is_checked)
        self.assertEqual(sub.teacher_comment, "Good job")
