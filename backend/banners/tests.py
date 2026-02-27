from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.utils import timezone
from datetime import timedelta
from accounts.models import User
from .models import BannerCampaign

class BannerAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Create users
        self.student_user = User.objects.create_user(phone_number="998901234567", role="STUDENT")
        self.teacher_user = User.objects.create_user(phone_number="998901234568", role="TEACHER")
        
        # Create banners
        self.student_banner = BannerCampaign.objects.create(
            name="Student Banner",
            placement="student_home_top",
            target_role="STUDENT",
            priority=10,
            target_value="/student/credits"
        )
        self.teacher_banner = BannerCampaign.objects.create(
            name="Teacher Banner",
            placement="teacher_home_top",
            target_role="TEACHER",
            priority=5,
            target_value="/teacher/earnings"
        )
        self.both_banner = BannerCampaign.objects.create(
            name="Both Banner",
            placement="student_home_top",
            target_role="BOTH",
            priority=1,
            target_value="/common"
        )
        self.inactive_banner = BannerCampaign.objects.create(
            name="Inactive",
            is_active=False,
            placement="student_home_top",
            target_role="STUDENT"
        )
        self.future_banner = BannerCampaign.objects.create(
            name="Future",
            start_at=timezone.now() + timedelta(days=1),
            placement="student_home_top",
            target_role="STUDENT"
        )

    def test_student_sees_correct_banners(self):
        self.client.force_authenticate(user=self.student_user)
        url = reverse('banner-list') + "?placement=student_home_top"
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should see "Student Banner" and "Both Banner"
        # Inactive and Future should be hidden
        self.assertEqual(len(response.data), 2)
        
        names = [b['name'] for b in response.data]
        self.assertIn("Student Banner", names)
        self.assertIn("Both Banner", names)
        self.assertNotIn("Teacher Banner", names)
        
        # Check ordering (priority 10 > 1)
        self.assertEqual(response.data[0]['name'], "Student Banner")

    def test_teacher_sees_correct_banners(self):
        self.client.force_authenticate(user=self.teacher_user)
        url = reverse('banner-list') + "?placement=teacher_home_top"
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should see "Teacher Banner" (Both Banner is in student_home_top, so wouldn't show here unless placement matches)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], "Teacher Banner")

    def test_scheduling(self):
        self.client.force_authenticate(user=self.student_user)
        
        # Banner that just expired
        BannerCampaign.objects.create(
            name="Expired",
            end_at=timezone.now() - timedelta(hours=1),
            placement="student_home_top",
            target_role="STUDENT"
        )
        
        url = reverse('banner-list') + "?placement=student_home_top"
        response = self.client.get(url)
        
        names = [b['name'] for b in response.data]
        self.assertNotIn("Expired", names)
        self.assertNotIn("Future", names)
        self.assertNotIn("Inactive", names)
