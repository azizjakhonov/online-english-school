"""
curriculum/tests.py

Regression tests for the PdfAsset download endpoint.
"""
import os
import tempfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings

from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from curriculum.models import Course, Unit, Lesson, LessonActivity, PdfAsset

User = get_user_model()

# Use a throw-away temp directory so test files don't pollute the real MEDIA_ROOT
TEMP_MEDIA = tempfile.mkdtemp()


def _make_user(phone, role='TEACHER'):
    return User.objects.create(phone_number=phone, full_name='Test User', role=role)


def _bearer(user):
    """Return an Authorization header value for the user's JWT access token."""
    token = str(RefreshToken.for_user(user).access_token)
    return f'Bearer {token}'


def _fake_pdf(name='test.pdf'):
    """Minimal valid PDF bytes - enough for a real FileField save."""
    return SimpleUploadedFile(name, b'%PDF-1.4\n%%EOF', content_type='application/pdf')


def _make_lesson_with_pdf(pdf_asset):
    """Create curriculum objects that reference pdf_asset in a LessonActivity."""
    course = Course.objects.create(title='Test Course')
    unit = Unit.objects.create(course=course, title='Test Unit', order=1)
    lesson = Lesson.objects.create(unit=unit, title='Test Lesson', order=1)
    activity = LessonActivity.objects.create(
        lesson=lesson,
        title='PDF Slide',
        activity_type='pdf',
        order=1,
        content={'pdf_id': pdf_asset.pk},
    )
    return lesson, activity


@override_settings(MEDIA_ROOT=TEMP_MEDIA)
class PdfUploadTest(APITestCase):
    """Ensures POST /api/curriculum/pdfs/ actually saves the file."""

    def setUp(self):
        self.teacher = _make_user('+998920100001')
        self.client.credentials(HTTP_AUTHORIZATION=_bearer(self.teacher))

    def test_upload_saves_file_field(self):
        """Serializer must include 'file' so the upload is persisted."""
        res = self.client.post(
            '/api/curriculum/pdfs/',
            {'title': 'My Doc', 'file': _fake_pdf()},
            format='multipart',
        )
        self.assertEqual(res.status_code, 201, res.data)
        pdf_id = res.data['id']
        pdf = PdfAsset.objects.get(pk=pdf_id)
        self.assertTrue(bool(pdf.file), 'file field must be non-empty after upload')
        self.assertNotEqual(pdf.file.name, '')

    def test_upload_response_contains_download_url(self):
        res = self.client.post(
            '/api/curriculum/pdfs/',
            {'title': 'My Doc', 'file': _fake_pdf()},
            format='multipart',
        )
        self.assertEqual(res.status_code, 201)
        self.assertIn('download_url', res.data)
        self.assertIn('/download/', res.data['download_url'])

    def test_upload_response_does_not_expose_raw_path(self):
        """'file' is write_only; the raw storage path must not appear in the response."""
        res = self.client.post(
            '/api/curriculum/pdfs/',
            {'title': 'My Doc', 'file': _fake_pdf()},
            format='multipart',
        )
        self.assertEqual(res.status_code, 201)
        self.assertNotIn('file', res.data)


@override_settings(MEDIA_ROOT=TEMP_MEDIA)
class PdfDownloadTest(APITestCase):
    """
    Covers permission paths and response headers for
    GET /api/curriculum/pdfs/<id>/download/.
    """

    def setUp(self):
        self.teacher = _make_user('+998920100002', 'TEACHER')
        self.student = _make_user('+998920100003', 'STUDENT')
        self.other = _make_user('+998920100004', 'STUDENT')

        # PDF owned by teacher, attached to a lesson (so 'in_use' check passes)
        self.pdf = PdfAsset.objects.create(
            owner=self.teacher,
            title='Lesson PDF',
            file=_fake_pdf('lesson.pdf'),
        )
        _make_lesson_with_pdf(self.pdf)
        self.url = f'/api/curriculum/pdfs/{self.pdf.pk}/download/'

    def test_owner_gets_200_with_pdf_content_type(self):
        self.client.credentials(HTTP_AUTHORIZATION=_bearer(self.teacher))
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res['Content-Type'], 'application/pdf')

    def test_authenticated_user_gets_200_when_pdf_in_lesson(self):
        """Any authenticated user can download a PDF that is attached to a lesson."""
        self.client.credentials(HTTP_AUTHORIZATION=_bearer(self.student))
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res['Content-Type'], 'application/pdf')

    def test_content_disposition_header_present(self):
        self.client.credentials(HTTP_AUTHORIZATION=_bearer(self.teacher))
        res = self.client.get(self.url)
        self.assertIn('Content-Disposition', res)
        self.assertIn('Lesson PDF.pdf', res['Content-Disposition'])

    @override_settings(
        CORS_ALLOW_ALL_ORIGINS=False,
        CORS_ALLOWED_ORIGINS=['http://127.0.0.1:5173'],
        CORS_ALLOW_CREDENTIALS=True,
    )
    def test_download_includes_cors_headers_for_allowed_origin(self):
        self.client.credentials(HTTP_AUTHORIZATION=_bearer(self.teacher))
        res = self.client.get(self.url, HTTP_ORIGIN='http://127.0.0.1:5173')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get('Access-Control-Allow-Origin'), 'http://127.0.0.1:5173')
        exposed = res.get('Access-Control-Expose-Headers', '')
        self.assertIn('Content-Disposition', exposed)
        self.assertIn('Content-Type', exposed)

    @override_settings(
        CORS_ALLOW_ALL_ORIGINS=False,
        CORS_ALLOWED_ORIGINS=['http://127.0.0.1:5173'],
        CORS_ALLOW_CREDENTIALS=True,
    )
    def test_options_preflight_allows_authorization_header(self):
        res = self.client.options(
            self.url,
            HTTP_ORIGIN='http://127.0.0.1:5173',
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='GET',
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS='authorization,content-type',
        )
        self.assertIn(res.status_code, [200, 204])
        self.assertEqual(res.get('Access-Control-Allow-Origin'), 'http://127.0.0.1:5173')
        allow_headers = res.get('Access-Control-Allow-Headers', '').lower()
        self.assertIn('authorization', allow_headers)
        self.assertIn('content-type', allow_headers)

    def test_orphan_pdf_returns_403_for_non_owner(self):
        """A PDF not yet attached to any lesson activity is owner-only."""
        orphan = PdfAsset.objects.create(
            owner=self.teacher,
            title='Orphan',
            file=_fake_pdf('orphan.pdf'),
        )
        self.client.credentials(HTTP_AUTHORIZATION=_bearer(self.other))
        res = self.client.get(f'/api/curriculum/pdfs/{orphan.pk}/download/')
        self.assertEqual(res.status_code, 403)

    def test_unauthenticated_returns_401(self):
        """No credentials -> blocked by IsAuthenticated before entering the view."""
        self.client.credentials()  # clear auth
        res = self.client.get(self.url)
        self.assertIn(res.status_code, [401, 403])

    def test_empty_file_field_returns_400(self):
        """
        PdfAsset saved without a file must return 400, not crash with ValueError/500.
        """
        empty = PdfAsset.objects.create(owner=self.teacher, title='No file here')
        self.client.credentials(HTTP_AUTHORIZATION=_bearer(self.teacher))
        res = self.client.get(f'/api/curriculum/pdfs/{empty.pk}/download/')
        self.assertEqual(res.status_code, 400)

    def test_nonexistent_pdf_returns_404(self):
        self.client.credentials(HTTP_AUTHORIZATION=_bearer(self.teacher))
        res = self.client.get('/api/curriculum/pdfs/99999/download/')
        self.assertEqual(res.status_code, 404)

    def test_file_deleted_from_disk_returns_410(self):
        """
        If the DB row exists but the underlying file is removed from storage,
        download must return 410 Gone.
        """
        pdf_with_file = PdfAsset.objects.create(
            owner=self.teacher,
            title='Soon Deleted',
            file=_fake_pdf('to_delete.pdf'),
        )
        os.remove(pdf_with_file.file.path)

        self.client.credentials(HTTP_AUTHORIZATION=_bearer(self.teacher))
        res = self.client.get(f'/api/curriculum/pdfs/{pdf_with_file.pk}/download/')
        self.assertEqual(res.status_code, 410)


class LessonTemplateCrudTest(APITestCase):
    """
    Coverage for canonical lesson template CRUD additions.
    """

    def setUp(self):
        self.teacher = _make_user('+998920100099', 'TEACHER')
        self.client.credentials(HTTP_AUTHORIZATION=_bearer(self.teacher))
        self.course = Course.objects.create(title='English A1')
        self.unit = Unit.objects.create(course=self.course, title='Unit 1', order=1)

    def test_create_lesson_with_nested_activities(self):
        payload = {
            'title': 'Lesson Template',
            'unit': self.unit.id,
            'order': 1,
            'description': 'Nested create test',
            'activities': [
                {
                    'title': 'Warmup',
                    'activity_type': 'gap_fill',
                    'order': 1,
                    'content': {'text': 'The {sun} is bright.'},
                },
                {
                    'title': 'Quiz',
                    'activity_type': 'quiz',
                    'order': 2,
                    'content': {'question': '2+2?', 'options': ['3', '4'], 'correct_index': 1},
                },
            ],
        }
        res = self.client.post('/api/curriculum/lessons/', payload, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(len(res.data.get('activities', [])), 2)

    def test_replace_activities_endpoint(self):
        lesson = Lesson.objects.create(unit=self.unit, title='L1', order=1)
        LessonActivity.objects.create(
            lesson=lesson,
            title='Old Activity',
            activity_type='gap_fill',
            order=1,
            content={'text': 'Old'},
        )

        res = self.client.put(
            f'/api/curriculum/lessons/{lesson.id}/activities/',
            [
                {
                    'title': 'New Activity',
                    'activity_type': 'matching',
                    'order': 1,
                    'content': {'pairs': [{'left': 'hello', 'right': 'salom'}]},
                }
            ],
            format='json',
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(len(res.data.get('activities', [])), 1)
        self.assertEqual(res.data['activities'][0]['activity_type'], 'matching')

    def test_duplicate_copies_nested_activities(self):
        source = Lesson.objects.create(unit=self.unit, title='Original', order=1)
        LessonActivity.objects.create(
            lesson=source,
            title='Quiz 1',
            activity_type='quiz',
            order=1,
            content={'question': 'Q', 'options': ['A', 'B'], 'correct_index': 0},
        )

        res = self.client.post(f'/api/curriculum/lessons/{source.id}/duplicate/', {}, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(res.data['title'].startswith('Original'))
        self.assertEqual(len(res.data.get('activities', [])), 1)
