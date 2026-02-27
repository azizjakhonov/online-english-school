from rest_framework.test import APITestCase

from accounts.models import User
from homework.models import Homework


class HomeworkLegacyFlowTests(APITestCase):
    def setUp(self):
        self.teacher = User.objects.create_user(
            phone_number='+19990000002',
            full_name='Legacy Teacher',
            role=User.Roles.TEACHER,
        )
        self.client.force_authenticate(user=self.teacher)

    def test_legacy_create_and_add_activity_flow(self):
        create_res = self.client.post(
            '/api/homework/admin/create/',
            {
                'title': 'Legacy Template',
                'description': 'Legacy create endpoint',
                'level': 'A1',
            },
            format='json',
        )
        self.assertEqual(create_res.status_code, 201)
        template_id = create_res.data['id']

        add_res = self.client.post(
            f'/api/homework/admin/activity/{template_id}/add/',
            {
                'activity_type': 'quiz',
                'order': 1,
                'points': 10,
                'content': {
                    'question': 'Which one is correct?',
                    'options': ['A', 'B', 'C', 'D'],
                    'correct_index': 0,
                },
            },
            format='json',
        )
        self.assertEqual(add_res.status_code, 201)
        self.assertTrue(Homework.objects.filter(pk=template_id).exists())

    def test_legacy_library_lists_templates(self):
        Homework.objects.create(title='H1', description='d', level='A2')
        response = self.client.get('/api/homework/library/')
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data), 1)
