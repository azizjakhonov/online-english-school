from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User, StudentProfile, TeacherProfile
from scheduling.models import Lesson


class BookingPresenceDefaultsTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.teacher_user = User.objects.create_user(
            phone_number='+998930100001',
            full_name='Teacher Presence',
            role=User.Roles.TEACHER,
        )
        self.student_user = User.objects.create_user(
            phone_number='+998930100002',
            full_name='Student Presence',
            role=User.Roles.STUDENT,
        )

        self.teacher_profile = TeacherProfile.objects.get(user=self.teacher_user)
        self.student_profile = StudentProfile.objects.get(user=self.student_user)
        self.student_profile.lesson_credits = 1
        self.student_profile.credits_reserved = 0
        self.student_profile.save(update_fields=['lesson_credits', 'credits_reserved'])

    def test_booking_creates_lesson_with_presence_defaults(self):
        self.client.force_authenticate(user=self.student_user)

        start = timezone.now() + timedelta(days=1)
        end = start + timedelta(hours=1)

        res = self.client.post(
            '/api/bookings/',
            {
                'teacher_id': self.teacher_profile.id,
                'start_time': start.isoformat(),
                'end_time': end.isoformat(),
            },
            format='json',
        )
        self.assertEqual(res.status_code, 201, res.data)

        lesson = Lesson.objects.get(id=res.data['id'])
        self.assertEqual(lesson.active_students_count, 0)
        self.assertFalse(lesson.active_teacher)

