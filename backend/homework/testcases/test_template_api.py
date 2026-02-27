from rest_framework.test import APITestCase

from accounts.models import User
from homework.models import Homework


class HomeworkTemplateApiTests(APITestCase):
    def setUp(self):
        self.teacher = User.objects.create_user(
            phone_number='+19990000001',
            full_name='Template Teacher',
            role=User.Roles.TEACHER,
        )
        self.client.force_authenticate(user=self.teacher)

    def _payload(self, title='Grammar Pack'):
        return {
            'title': title,
            'description': 'A template for classwork',
            'level': 'A2',
            'activities': [
                {
                    'activity_type': 'quiz',
                    'order': 1,
                    'points': 10,
                    'content': {
                        'question': '2 + 2 = ?',
                        'options': ['3', '4', '5', '6'],
                        'correct_index': 1,
                    },
                },
                {
                    'activity_type': 'gap_fill',
                    'order': 2,
                    'points': 5,
                    'content': {'text': 'The {sky} is blue.'},
                },
            ],
        }

    def test_create_template_with_nested_activities(self):
        response = self.client.post('/api/homework/templates/', self._payload(), format='json')
        self.assertEqual(response.status_code, 201)
        self.assertIn('id', response.data)
        self.assertEqual(len(response.data.get('activities', [])), 2)

    def test_patch_template_replaces_activities(self):
        created = self.client.post('/api/homework/templates/', self._payload(), format='json')
        template_id = created.data['id']

        patch_payload = {
            'title': 'Updated Homework',
            'activities': [
                {
                    'activity_type': 'matching',
                    'order': 1,
                    'points': 7,
                    'content': {
                        'pairs': [
                            {'left': 'hello', 'right': 'salom'},
                            {'left': 'bye', 'right': 'xayr'},
                        ]
                    },
                }
            ],
        }
        response = self.client.patch(
            f'/api/homework/templates/{template_id}/',
            patch_payload,
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['title'], 'Updated Homework')
        self.assertEqual(len(response.data.get('activities', [])), 1)
        self.assertEqual(response.data['activities'][0]['activity_type'], 'matching')

    def test_duplicate_template_copies_nested_activities(self):
        created = self.client.post('/api/homework/templates/', self._payload('Original'), format='json')
        template_id = created.data['id']

        response = self.client.post(f'/api/homework/templates/{template_id}/duplicate/', {}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data['title'].startswith('Original'))
        self.assertEqual(len(response.data.get('activities', [])), 2)

    def test_legacy_library_endpoint_still_works(self):
        Homework.objects.create(title='Legacy One', description='d', level='A1')
        response = self.client.get('/api/homework/library/')
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data), 1)
