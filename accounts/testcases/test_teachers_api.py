from django.urls import reverse
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model

from accounts.models import TeacherProfile

User = get_user_model()


class TeachersListAPITests(APITestCase):
    def setUp(self):
        # Teacher
        self.teacher = User.objects.create_user(
            username="t1",
            email="t1@example.com",
            password="test12345",
            role=User.Roles.TEACHER,
            is_active=True,
        )
        # Profile is auto-created by signal, but safe to ensure it exists
        TeacherProfile.objects.get_or_create(user=self.teacher)

        # Student
        self.student = User.objects.create_user(
            username="s1",
            email="s1@example.com",
            password="test12345",
            role=User.Roles.STUDENT,
            is_active=True,
        )

    def test_student_can_list_teachers(self):
        self.client.force_authenticate(user=self.student)

        url = reverse("teachers-list")
        res = self.client.get(url)

        self.assertEqual(res.status_code, 200)
        self.assertTrue(len(res.data) >= 1)

        usernames = [t["username"] for t in res.data]
        self.assertIn("t1", usernames)

    def test_teacher_cannot_list_teachers(self):
        self.client.force_authenticate(user=self.teacher)

        url = reverse("teachers-list")
        res = self.client.get(url)

        self.assertEqual(res.status_code, 400)
        self.assertIn("detail", res.data)
