from django.urls import reverse
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model

from accounts.models import TeacherProfile, StudentProfile

User = get_user_model()


class TeachersListAPITests(APITestCase):
    def setUp(self):
        # Teacher
        self.teacher = User.objects.create(
            phone_number='+998911111001',
            full_name='Test Teacher',
            role=User.Roles.TEACHER,
            is_active=True,
        )
        TeacherProfile.objects.get_or_create(user=self.teacher)

        # Student
        self.student = User.objects.create(
            phone_number='+998911111002',
            full_name='Test Student',
            role=User.Roles.STUDENT,
            is_active=True,
        )
        StudentProfile.objects.get_or_create(user=self.student)

    def test_student_can_list_teachers(self):
        self.client.force_authenticate(user=self.student)

        url = reverse("teachers-list")
        res = self.client.get(url)

        self.assertEqual(res.status_code, 200)
        self.assertTrue(len(res.data) >= 1)

        phone_numbers = [t["user"]["phone_number"] for t in res.data]
        self.assertIn(self.teacher.phone_number, phone_numbers)

    def test_teacher_can_also_list_teachers(self):
        """
        TeachersListView uses AllowAny — any authenticated user gets 200.
        """
        self.client.force_authenticate(user=self.teacher)

        url = reverse("teachers-list")
        res = self.client.get(url)

        self.assertEqual(res.status_code, 200)
