from datetime import time

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User, TeacherProfile


class SchedulingFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.teacher_user = User.objects.create_user(
            phone_number='+998930200001',
            full_name='Teacher Scheduling',
            role=User.Roles.TEACHER,
        )
        self.teacher = TeacherProfile.objects.get(user=self.teacher_user)

    def test_teacher_can_create_rule_and_regenerate_slots(self):
        self.client.force_authenticate(user=self.teacher_user)

        # Create rule
        url = reverse('availability-rules')
        res = self.client.post(
            url,
            {
                'weekday': 0,  # Monday
                'start_time': '09:00:00',
                'end_time': '11:00:00',
                'is_active': True,
            },
            format='json',
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['weekday'], 0)

        # Regenerate slots
        regen_url = reverse('regenerate-my-slots')
        res2 = self.client.post(regen_url, {'days': 14, 'slot_minutes': 60}, format='json')
        self.assertEqual(res2.status_code, 200)
        self.assertIn('created', res2.data)
        # should create at least 1 slot
        self.assertGreaterEqual(res2.data['created'] + res2.data['skipped_existing'], 1)

    def test_student_cannot_manage_rules(self):
        student_user = User.objects.create_user(
            phone_number='+998930200002',
            full_name='Student Scheduling',
            role=User.Roles.STUDENT,
        )
        self.client.force_authenticate(user=student_user)

        url = reverse('availability-rules')
        res = self.client.post(
            url,
            {'weekday': 0, 'start_time': '09:00:00', 'end_time': '11:00:00'},
            format='json',
        )
        self.assertEqual(res.status_code, 400)  # your API uses ValidationError -> 400
        self.assertIn('detail', res.data)
