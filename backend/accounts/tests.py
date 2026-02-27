"""
accounts/tests.py

Targeted tests for:
  1. ActivityEvent population via signals (lesson scheduled/completed, payment)
  2. Student profile history API
  3. Teacher settings API (GET, PATCH, financial fields guard)
  4. Avatar upload (AvatarUploadView) — valid upload, oversize, wrong type, auth

Run with:
    python manage.py test accounts
"""
import io
import os
import shutil
import tempfile

from django.test import TestCase, override_settings
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model

from accounts.models import (
    TeacherProfile, StudentProfile, ActivityEvent, EarningsEvent,
)

User = get_user_model()


# ── Test helpers ──────────────────────────────────────────────────────────────

def make_student(phone='+998901000001', name='Test Student'):
    u = User.objects.create(phone_number=phone, full_name=name, role=User.Roles.STUDENT)
    StudentProfile.objects.get_or_create(user=u)
    return u


def make_teacher(phone='+998902000001', name='Test Teacher', rate=150_000):
    u = User.objects.create(phone_number=phone, full_name=name, role=User.Roles.TEACHER)
    profile, _ = TeacherProfile.objects.get_or_create(user=u)
    profile.rate_per_lesson_uzs = rate
    profile.save()
    return u


def _now():
    return timezone.now()


# ── Part 1: ActivityEvent signal tests ────────────────────────────────────────

class LessonScheduledActivityTest(TestCase):
    """
    test_lesson_scheduled_fills_teacher_student:
    When a Lesson is created, the resulting ActivityEvent must have
    subject_student, subject_teacher, and lesson_id_ref populated.
    """

    def test_lesson_scheduled_fills_teacher_student(self):
        from scheduling.models import Lesson

        student = make_student('+998901000010')
        teacher = make_teacher('+998902000010')

        now = _now()
        lesson = Lesson.objects.create(
            student=student,
            teacher=teacher,
            start_time=now + timezone.timedelta(hours=1),
            end_time=now + timezone.timedelta(hours=2),
            lesson_date=(now + timezone.timedelta(hours=1)).date(),
        )

        event = ActivityEvent.objects.filter(
            event_type=ActivityEvent.EventType.LESSON_SCHEDULED,
            lesson_id_ref=lesson.id,
        ).first()

        self.assertIsNotNone(event, 'LESSON_SCHEDULED event not created')
        self.assertEqual(event.subject_student, student.student_profile)
        self.assertEqual(event.subject_teacher, teacher.teacher_profile)
        self.assertEqual(event.lesson_id_ref, lesson.id)


class PaymentActivityTest(TestCase):
    """
    test_payment_fills_student:
    When a Payment reaches 'succeeded', the ActivityEvent must have
    subject_student and payment_id populated.
    """

    def test_payment_fills_student(self):
        from payments.models import Payment

        student = make_student('+998901000020')

        payment = Payment.objects.create(
            student=student,
            credits_amount=5,
            amount_uzs=500_000,
            method=Payment.Method.CASH,
            provider=Payment.Provider.MANUAL,
            status=Payment.Status.SUCCEEDED,
        )

        event = ActivityEvent.objects.filter(
            payment_id=payment.id,
        ).first()

        self.assertIsNotNone(event, 'Payment activity event not created')
        self.assertEqual(event.subject_student, student.student_profile)
        self.assertEqual(event.payment_id, payment.id)


class LessonCompletedActivityTest(TestCase):
    """
    test_lesson_completed_fills_earnings_event:
    When a Lesson is marked COMPLETED, the resulting ActivityEvent must have
    earnings_event_id populated (linking to the EarningsEvent created first).
    """

    def test_lesson_completed_fills_earnings_event(self):
        from scheduling.models import Lesson

        student = make_student('+998901000030')
        teacher = make_teacher('+998902000030', rate=200_000)

        now = _now()
        lesson = Lesson.objects.create(
            student=student,
            teacher=teacher,
            start_time=now - timezone.timedelta(hours=2),
            end_time=now - timezone.timedelta(hours=1),
            lesson_date=(now - timezone.timedelta(hours=2)).date(),
        )

        # Mark as COMPLETED — triggers both earnings and activity signals
        lesson.status = 'COMPLETED'
        lesson.save(update_fields=['status'])

        event = ActivityEvent.objects.filter(
            event_type=ActivityEvent.EventType.LESSON_COMPLETED,
            lesson_id_ref=lesson.id,
        ).first()

        earnings = EarningsEvent.objects.filter(
            lesson=lesson, event_type='lesson_credit'
        ).first()

        self.assertIsNotNone(event,    'LESSON_COMPLETED event not created')
        self.assertIsNotNone(earnings, 'EarningsEvent not created for completed lesson')
        self.assertEqual(event.earnings_event_id, earnings.id)
        self.assertEqual(event.subject_student, student.student_profile)
        self.assertEqual(event.subject_teacher, teacher.teacher_profile)


# ── Part 2: Student profile API tests ─────────────────────────────────────────

class StudentProfileAPITest(APITestCase):

    def setUp(self):
        from scheduling.models import Lesson
        from payments.models import Payment

        self.student = make_student('+998901000040', 'Profile Student')
        self.teacher = make_teacher('+998902000040')

        now = _now()
        self.lesson = Lesson.objects.create(
            student=self.student,
            teacher=self.teacher,
            start_time=now - timezone.timedelta(hours=2),
            end_time=now - timezone.timedelta(hours=1),
            lesson_date=(now - timezone.timedelta(hours=2)).date(),
            status='COMPLETED',
            credits_consumed=True,
        )
        self.payment = Payment.objects.create(
            student=self.student,
            credits_amount=3,
            amount_uzs=300_000,
            method='cash',
            provider='manual',
            status='succeeded',
        )

    def test_student_profile_api_returns_lesson_history(self):
        self.client.force_authenticate(user=self.student)
        res = self.client.get('/api/student/profile/')

        self.assertEqual(res.status_code, 200)
        data = res.json()

        # Profile section
        self.assertEqual(data['profile']['phone_number'], self.student.phone_number)

        # Lesson history must include our completed lesson
        lesson_ids = [ls['lesson_id'] for ls in data['lesson_history']]
        self.assertIn(self.lesson.id, lesson_ids)

        # Stats
        self.assertGreaterEqual(data['stats']['completed_lessons'], 1)

        # Payment history must include our payment
        payment_ids = [p['payment_id'] for p in data['payment_history']]
        self.assertIn(self.payment.id, payment_ids)

    def test_teacher_cannot_access_student_profile(self):
        self.client.force_authenticate(user=self.teacher)
        res = self.client.get('/api/student/profile/')
        self.assertEqual(res.status_code, 403)


# ── Part 3: Teacher settings API tests ────────────────────────────────────────

class TeacherSettingsAPITest(APITestCase):

    def setUp(self):
        self.teacher = make_teacher('+998902000050', rate=175_000)
        self.student = make_student('+998901000050')

    def test_teacher_settings_get_returns_financial(self):
        self.client.force_authenticate(user=self.teacher)
        res = self.client.get('/api/teacher/settings/')

        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn('profile',   data)
        self.assertIn('financial', data)
        self.assertIn('rate_per_lesson_uzs', data['financial'])
        self.assertIn('next_payout_date',    data['financial'])
        self.assertIn('payout_history',      data['financial'])

    def test_teacher_settings_rate_zero_safe(self):
        """Teacher with rate_per_lesson_uzs=0 still returns full financial dict."""
        profile = self.teacher.teacher_profile
        profile.rate_per_lesson_uzs = 0
        profile.save()

        self.client.force_authenticate(user=self.teacher)
        res = self.client.get('/api/teacher/settings/')

        self.assertEqual(res.status_code, 200)
        fin = res.json()['financial']
        self.assertEqual(fin['rate_per_lesson_uzs'], 0)
        self.assertIn('next_payout_date', fin)   # must still be present

    def test_teacher_settings_patch_updates_bio(self):
        self.client.force_authenticate(user=self.teacher)
        res = self.client.patch(
            '/api/teacher/settings/',
            data={'bio': 'New bio text', 'headline': 'Senior Teacher'},
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.teacher.teacher_profile.refresh_from_db()
        self.assertEqual(self.teacher.teacher_profile.bio, 'New bio text')
        self.assertEqual(self.teacher.teacher_profile.headline, 'Senior Teacher')

    def test_teacher_settings_patch_ignores_financial_fields(self):
        """
        PATCH with rate_per_lesson_uzs in body must NOT change the stored rate.
        Financial keys are silently stripped, no 400 error returned.
        """
        original_rate = int(self.teacher.teacher_profile.rate_per_lesson_uzs)

        self.client.force_authenticate(user=self.teacher)
        res = self.client.patch(
            '/api/teacher/settings/',
            data={
                'bio':               'Some bio',
                'rate_per_lesson_uzs': 9_999_999,   # should be ignored
                'payout_day':          1,            # should be ignored
            },
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.teacher.teacher_profile.refresh_from_db()
        # Rate must be unchanged
        self.assertEqual(
            int(self.teacher.teacher_profile.rate_per_lesson_uzs),
            original_rate,
        )

    def test_student_cannot_access_teacher_settings(self):
        self.client.force_authenticate(user=self.student)
        res = self.client.get('/api/teacher/settings/')
        self.assertEqual(res.status_code, 403)


# ── Part 4: Avatar upload API tests ───────────────────────────────────────────

# Use a temp directory so test files never pollute the real media folder.
_TEMP_MEDIA = tempfile.mkdtemp(prefix='test_media_')


def _make_jpeg_bytes(width=20, height=20):
    """Return bytes of a tiny valid JPEG image (uses Pillow, already required)."""
    from PIL import Image
    buf = io.BytesIO()
    img = Image.new('RGB', (width, height), color=(100, 149, 237))
    img.save(buf, format='JPEG')
    buf.seek(0)
    return buf.read()


@override_settings(MEDIA_ROOT=_TEMP_MEDIA)
class AvatarUploadTest(APITestCase):
    """
    Tests for PATCH /api/accounts/avatar/ (AvatarUploadView).

    All uploaded files go to a temp directory that is wiped after the class.
    The endpoint is reachable at /api/accounts/avatar/ because urls.py includes
    accounts.urls under both 'api/' and 'api/accounts/'.
    """

    URL = '/api/accounts/avatar/'

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(_TEMP_MEDIA, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.user = make_student('+998901000060', 'Avatar Student')

    # ── 1. valid upload ──────────────────────────────────────────────────────

    def test_valid_jpeg_returns_200_and_url(self):
        """
        Upload a small JPEG (<1 MB).
        Expect: 200 | 'profile_picture_url' in response | DB field not empty.
        """
        self.client.force_authenticate(user=self.user)

        image_file = SimpleUploadedFile(
            'avatar.jpg', _make_jpeg_bytes(), content_type='image/jpeg'
        )
        res = self.client.patch(self.URL, {'avatar': image_file}, format='multipart')

        self.assertEqual(res.status_code, 200,
                         f'Expected 200, got {res.status_code}: {res.json()}')
        data = res.json()
        self.assertIn('profile_picture_url', data,
                      'Response must contain profile_picture_url')
        self.assertIsNotNone(data['profile_picture_url'],
                             'profile_picture_url must not be null on success')

        # Confirm the DB was updated
        self.user.refresh_from_db()
        self.assertTrue(bool(self.user.profile_picture),
                        'User.profile_picture must be non-empty after upload')

    def test_valid_png_accepted(self):
        """PNG is in the allowed-types set — must return 200."""
        from PIL import Image
        buf = io.BytesIO()
        Image.new('RGBA', (10, 10), (0, 255, 0, 128)).save(buf, format='PNG')
        buf.seek(0)

        self.client.force_authenticate(user=self.user)
        png_file = SimpleUploadedFile('img.png', buf.read(), content_type='image/png')
        res = self.client.patch(self.URL, {'avatar': png_file}, format='multipart')

        self.assertEqual(res.status_code, 200,
                         f'PNG upload should succeed, got {res.status_code}: {res.json()}')

    # ── 2. /api/me/ reflects the new URL (absolute) ─────────────────────────

    def test_me_endpoint_returns_new_url_after_upload(self):
        """
        After a successful upload, GET /api/me/ must return a non-null,
        ABSOLUTE profile_picture_url so the browser can load it from any origin.

        Root-cause regression guard: MeSerializer must receive request context
        so build_absolute_uri() produces 'http://testserver/...' not '/media/...'.
        Without the fix the URL was relative — browsers on a different origin
        (e.g. localhost:5173) resolved it against the frontend server and got 404.
        """
        self.client.force_authenticate(user=self.user)

        image_file = SimpleUploadedFile(
            'me_test.jpg', _make_jpeg_bytes(), content_type='image/jpeg'
        )
        upload_res = self.client.patch(self.URL, {'avatar': image_file}, format='multipart')
        self.assertEqual(upload_res.status_code, 200)

        # DB must be updated
        self.user.refresh_from_db()
        self.assertTrue(
            bool(self.user.profile_picture),
            'User.profile_picture field must be non-empty in DB after upload',
        )

        me_res = self.client.get('/api/me/')
        self.assertEqual(me_res.status_code, 200)
        me_data = me_res.json()

        url = me_data.get('profile_picture_url')
        self.assertIsNotNone(
            url,
            'GET /api/me/ must return profile_picture_url after upload; '
            f'got: {url}',
        )
        # CRITICAL: URL must be absolute so cross-origin React app can load it
        self.assertTrue(
            url.startswith('http'),
            f'profile_picture_url must be absolute (start with "http"), got: {url!r}. '
            'Fix: pass context={{\'request\': request}} to MeSerializer in MeView.get().',
        )
        # Must reference the saved file (filename is avatar_<id>.jpg)
        self.assertIn('avatar_', url, f'Unexpected URL format: {url}')

    # ── 3. size enforcement ──────────────────────────────────────────────────

    def test_oversize_file_returns_400(self):
        """
        File > 5 MB must return 400 with an error message that mentions '5 MB'.
        The content passes the type check ('image/jpeg') so only the size check fires.
        """
        self.client.force_authenticate(user=self.user)

        # 5 MB + 1 byte — content_type passes, size fails
        big_content = b'\xff\xd8\xff' + b'x' * (5 * 1024 * 1024 + 1)
        big_file = SimpleUploadedFile('big.jpg', big_content, content_type='image/jpeg')

        res = self.client.patch(self.URL, {'avatar': big_file}, format='multipart')

        self.assertEqual(res.status_code, 400,
                         f'Oversize file must return 400, got {res.status_code}: {res.json()}')
        data = res.json()
        self.assertIn('error', data, 'Response must have "error" key')
        self.assertIn('5 MB', data['error'],
                      f'Error must mention "5 MB" limit, got: {data["error"]}')

    # ── 4. wrong content-type ────────────────────────────────────────────────

    def test_pdf_returns_400(self):
        """Sending a PDF must return 400 with unsupported-type error."""
        self.client.force_authenticate(user=self.user)

        pdf_file = SimpleUploadedFile(
            'doc.pdf', b'%PDF-1.4 fake', content_type='application/pdf'
        )
        res = self.client.patch(self.URL, {'avatar': pdf_file}, format='multipart')

        self.assertEqual(res.status_code, 400)
        self.assertIn('error', res.json())

    # ── 5. missing file ──────────────────────────────────────────────────────

    def test_no_file_returns_400(self):
        """PATCH with no file field must return 400."""
        self.client.force_authenticate(user=self.user)
        res = self.client.patch(self.URL, {}, format='multipart')

        self.assertEqual(res.status_code, 400)
        self.assertIn('error', res.json())

    # ── 6. authentication guard ──────────────────────────────────────────────

    def test_unauthenticated_returns_401(self):
        """No auth token → 401 Unauthorized."""
        image_file = SimpleUploadedFile(
            'unauth.jpg', _make_jpeg_bytes(), content_type='image/jpeg'
        )
        res = self.client.patch(self.URL, {'avatar': image_file}, format='multipart')

        self.assertEqual(res.status_code, 401,
                         f'Expected 401, got {res.status_code}')


# ── Part 5: Avatar persistence — full round-trip proof ────────────────────────

@override_settings(MEDIA_ROOT=_TEMP_MEDIA)
class AvatarPersistenceTest(APITestCase):
    """
    Proves that an uploaded avatar:
      1. Is saved to the DB (profile_picture field non-empty after refresh_from_db).
      2. Is returned as an ABSOLUTE URL from GET /api/me/ immediately after upload.
      3. Is still returned as an ABSOLUTE URL from GET /api/me/ on a fresh client
         session (simulating a browser refresh).

    This test class was added to catch the root-cause bug where MeSerializer was
    instantiated without request context, producing a relative URL (/media/...)
    that the React SPA (served from a different origin) resolved to the wrong host.
    """

    URL = '/api/accounts/avatar/'

    def setUp(self):
        self.user = make_student('+998901000070', 'Persistence Student')

    def _upload_jpeg(self):
        """Helper: upload a tiny JPEG and return the response."""
        image_file = SimpleUploadedFile(
            'persist.jpg', _make_jpeg_bytes(), content_type='image/jpeg'
        )
        return self.client.patch(self.URL, {'avatar': image_file}, format='multipart')

    # ── 1. DB field is set after upload ──────────────────────────────────────

    def test_db_field_is_set_after_upload(self):
        """
        After PATCH /api/accounts/avatar/ succeeds, re-fetching the user from DB
        must show a non-empty profile_picture value.
        """
        self.client.force_authenticate(user=self.user)
        res = self._upload_jpeg()
        self.assertEqual(res.status_code, 200, res.json())

        self.user.refresh_from_db()
        self.assertTrue(
            bool(self.user.profile_picture),
            'profile_picture DB field must be set after upload',
        )
        # The stored path must contain the expected prefix
        self.assertIn(
            'profile_pics', self.user.profile_picture.name,
            f'Expected path under profile_pics/, got: {self.user.profile_picture.name}',
        )

    # ── 2. /api/me/ returns absolute URL immediately after upload ────────────

    def test_me_returns_absolute_url_immediately(self):
        """
        GET /api/me/ right after upload must return an absolute URL.
        Tests that MeSerializer receives request context (the root-cause fix).
        """
        self.client.force_authenticate(user=self.user)
        upload_res = self._upload_jpeg()
        self.assertEqual(upload_res.status_code, 200, upload_res.json())

        me_res = self.client.get('/api/me/')
        self.assertEqual(me_res.status_code, 200)

        url = me_res.json().get('profile_picture_url')
        self.assertIsNotNone(url, 'profile_picture_url must not be null')
        self.assertTrue(
            url.startswith('http'),
            f'URL must be absolute (starts with http), got: {url!r}',
        )

    # ── 3. Fresh session still returns absolute URL (simulates page refresh) ─

    def test_me_returns_absolute_url_on_fresh_session(self):
        """
        On a new APIClient (simulating browser refresh / re-login), GET /api/me/
        must return an absolute, non-null profile_picture_url.
        """
        # First session: upload
        self.client.force_authenticate(user=self.user)
        res = self._upload_jpeg()
        self.assertEqual(res.status_code, 200, res.json())

        # New session (fresh client, same user — simulates page reload)
        from rest_framework.test import APIClient
        fresh = APIClient()
        fresh.force_authenticate(user=self.user)
        me_res = fresh.get('/api/me/')
        self.assertEqual(me_res.status_code, 200)

        url = me_res.json().get('profile_picture_url')
        self.assertIsNotNone(url, 'profile_picture_url must survive a fresh session')
        self.assertTrue(
            url.startswith('http'),
            f'URL on fresh session must be absolute, got: {url!r}',
        )

    # ── 4. Upload response itself also has absolute URL ──────────────────────

    def test_upload_response_url_is_absolute(self):
        """
        The PATCH /api/accounts/avatar/ response must contain an absolute URL
        so the frontend can update its preview without an extra /api/me/ call.
        """
        self.client.force_authenticate(user=self.user)
        res = self._upload_jpeg()
        self.assertEqual(res.status_code, 200, res.json())

        url = res.json().get('profile_picture_url')
        self.assertIsNotNone(url, 'Upload response must include profile_picture_url')
        self.assertTrue(
            url.startswith('http'),
            f'Upload response URL must be absolute, got: {url!r}',
        )


# ── Part 6: Timezone field + middleware tests ──────────────────────────────────

class UserTimezoneFieldTest(TestCase):
    """
    Tests for the User.timezone model field and its exposure via /api/me/.
    """

    def test_user_defaults_to_tashkent(self):
        """Newly created users must default to Asia/Tashkent."""
        user = User.objects.create(
            phone_number='+998901000080',
            full_name='TZ Default',
            role=User.Roles.STUDENT,
        )
        self.assertEqual(user.timezone, 'Asia/Tashkent')

    def test_me_endpoint_exposes_timezone(self):
        """GET /api/me/ must include the 'timezone' field."""
        from rest_framework.test import APIClient
        user = make_student('+998901000081', 'TZ API Student')
        client = APIClient()
        client.force_authenticate(user=user)
        res = client.get('/api/me/')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn('timezone', data, '/api/me/ must expose timezone field')
        self.assertEqual(data['timezone'], 'Asia/Tashkent')

    def test_patch_me_updates_valid_timezone(self):
        """PATCH /api/me/ with a valid IANA name must update user.timezone."""
        from rest_framework.test import APIClient
        user = make_student('+998901000082', 'TZ Patch Student')
        client = APIClient()
        client.force_authenticate(user=user)
        res = client.patch('/api/me/', {'timezone': 'Europe/London'}, format='json')
        self.assertEqual(res.status_code, 200)
        user.refresh_from_db()
        self.assertEqual(user.timezone, 'Europe/London')

    def test_patch_me_invalid_timezone_returns_400(self):
        """PATCH /api/me/ with an unknown tz name must return 400 and leave the stored value unchanged."""
        from rest_framework.test import APIClient
        user = make_student('+998901000083', 'TZ Bad Student')
        client = APIClient()
        client.force_authenticate(user=user)
        res = client.patch('/api/me/', {'timezone': 'Not/ATimezone'}, format='json')
        self.assertEqual(res.status_code, 400)
        data = res.json()
        self.assertIn('timezone', data, 'Error response must contain "timezone" key')
        self.assertIn('IANA', data['timezone'], 'Error message must mention IANA')
        # Stored value must be untouched
        user.refresh_from_db()
        self.assertEqual(user.timezone, 'Asia/Tashkent')

    def test_patch_me_timezone_strips_whitespace(self):
        """Leading/trailing whitespace in timezone input must be stripped before validation."""
        from rest_framework.test import APIClient
        user = make_student('+998901000084', 'TZ Whitespace Student')
        client = APIClient()
        client.force_authenticate(user=user)
        res = client.patch('/api/me/', {'timezone': '  Europe/Berlin  '}, format='json')
        self.assertEqual(res.status_code, 200)
        user.refresh_from_db()
        self.assertEqual(user.timezone, 'Europe/Berlin')


class UserTimezoneMiddlewareTest(TestCase):
    """
    Tests for accounts.middleware.UserTimezoneMiddleware.
    """

    def test_middleware_activates_user_timezone(self):
        """
        When an authenticated user with a non-default timezone makes a request,
        django.utils.timezone.get_current_timezone() inside that request must
        return the user's preferred timezone.
        The middleware must also deactivate after the response.
        """
        import zoneinfo
        from django.utils import timezone as tz
        from accounts.middleware import UserTimezoneMiddleware

        user = make_student('+998901000084', 'MW Student')
        user.timezone = 'Europe/Paris'
        user.save()

        activated = {}

        def fake_get_response(request):
            activated['tz'] = str(tz.get_current_timezone())
            from django.http import HttpResponse
            return HttpResponse('ok')

        mw = UserTimezoneMiddleware(fake_get_response)

        from django.test import RequestFactory
        rf = RequestFactory()
        request = rf.get('/')
        request.user = user

        mw(request)

        self.assertEqual(activated['tz'], 'Europe/Paris',
                         'Middleware must activate the user timezone during the request')

        # After the request the global timezone must be deactivated (no override)
        # timezone.get_current_timezone() returns the default when nothing is active
        self.assertEqual(
            str(tz.get_current_timezone()),
            'Asia/Tashkent',  # settings.TIME_ZONE — the fallback after deactivate()
            'Middleware must deactivate user timezone after response to avoid leaking it',
        )

    def test_middleware_falls_back_to_settings_for_anonymous(self):
        """Anonymous requests must activate settings.TIME_ZONE (Asia/Tashkent)."""
        import zoneinfo
        from django.utils import timezone as tz
        from accounts.middleware import UserTimezoneMiddleware
        from django.contrib.auth.models import AnonymousUser

        activated = {}

        def fake_get_response(request):
            activated['tz'] = str(tz.get_current_timezone())
            from django.http import HttpResponse
            return HttpResponse('ok')

        mw = UserTimezoneMiddleware(fake_get_response)

        from django.test import RequestFactory
        rf = RequestFactory()
        request = rf.get('/')
        request.user = AnonymousUser()

        mw(request)

        self.assertEqual(activated['tz'], 'Asia/Tashkent')


# ── Part 7: Lesson lifecycle regression tests ──────────────────────────────────

class LessonLifecycleTest(APITestCase):
    """
    Regression tests for the four lesson-lifecycle bugs:
      1. In-progress lesson stays visible in /api/my-lessons/
      2. Past lesson (end_time < now, not completed) appears in student profile history
      3. Admin can edit (full_clean) an existing past lesson without ValidationError
      4. Marking completed deducts credit exactly once and creates EarningsEvent once
    """

    def setUp(self):
        from scheduling.models import Lesson
        self.student = make_student('+998901000090', 'Lifecycle Student')
        self.teacher = make_teacher('+998902000090', 'Lifecycle Teacher', rate=100_000)
        # Give the student a credit so the signal can deduct one
        self.student.student_profile.lesson_credits = 5
        self.student.student_profile.save()

    # ── 1. In-progress lesson visible in dashboard ───────────────────────────

    def test_inprogress_lesson_visible_in_dashboard(self):
        """
        A lesson that started 30 min ago and ends 30 min from now must appear
        in GET /api/my-lessons/ (status=CONFIRMED, student view).
        """
        from scheduling.models import Lesson
        now = timezone.now()
        lesson = Lesson.objects.create(
            student=self.student,
            teacher=self.teacher,
            start_time=now - timezone.timedelta(minutes=30),
            end_time=now + timezone.timedelta(minutes=30),
            lesson_date=(now - timezone.timedelta(minutes=30)).date(),
            status='CONFIRMED',
        )

        self.client.force_authenticate(user=self.student)
        res = self.client.get('/api/my-lessons/')

        self.assertEqual(res.status_code, 200)
        lesson_ids = [l['id'] for l in res.json()]
        self.assertIn(
            lesson.id, lesson_ids,
            'In-progress lesson must appear in /api/my-lessons/ dashboard list'
        )

    # ── 2. Past pending lesson appears in student profile history ─────────────

    def test_past_pending_lesson_in_profile_history(self):
        """
        A lesson whose end_time has already passed (status=CONFIRMED, not completed)
        must appear in GET /api/student/profile/ lesson_history.
        """
        from scheduling.models import Lesson
        now = timezone.now()
        lesson = Lesson.objects.create(
            student=self.student,
            teacher=self.teacher,
            start_time=now - timezone.timedelta(hours=2),
            end_time=now - timezone.timedelta(hours=1),
            lesson_date=(now - timezone.timedelta(hours=2)).date(),
            status='CONFIRMED',    # still pending, not completed
        )

        self.client.force_authenticate(user=self.student)
        res = self.client.get('/api/student/profile/')

        self.assertEqual(res.status_code, 200)
        lesson_ids = [l['lesson_id'] for l in res.json()['lesson_history']]
        self.assertIn(
            lesson.id, lesson_ids,
            'Past (ended) lesson must appear in student profile lesson_history even if not COMPLETED'
        )

    # ── 3. Admin can edit past lesson without ValidationError ─────────────────

    def test_admin_can_edit_past_lesson_without_error(self):
        """
        Calling full_clean() on an existing lesson whose start_time is in the past
        must NOT raise ValidationError. Only *new* lessons are blocked.
        """
        from scheduling.models import Lesson
        from django.core.exceptions import ValidationError
        now = timezone.now()
        lesson = Lesson.objects.create(
            student=self.student,
            teacher=self.teacher,
            start_time=now - timezone.timedelta(hours=2),
            end_time=now - timezone.timedelta(hours=1),
            lesson_date=(now - timezone.timedelta(hours=2)).date(),
            status='PENDING',
        )

        # Simulate an admin saving additional notes without changing start_time.
        # Django admin excludes nullable FK fields from clean_fields, so we mirror that here.
        lesson.notes = 'Admin edited note'
        try:
            # Exclude the nullable FK that has no blank=True (mirrors admin form behaviour)
            lesson.clean_fields(exclude=['availability_slot'])
            # This is the key method we're testing — must NOT raise ValidationError
            lesson.clean()
        except ValidationError as e:
            self.fail(
                f'clean() raised ValidationError on existing past lesson: {e}'
            )

    # ── 4. Credit deducted exactly once; earnings created exactly once ─────────

    def test_credit_and_earnings_idempotent_on_completion(self):
        """
        Marking a lesson COMPLETED twice must:
          - create exactly 1 CreditTransaction
          - create exactly 1 EarningsEvent
          - set credits_consumed=True
        """
        from scheduling.models import Lesson
        from accounts.models import CreditTransaction, EarningsEvent

        now = timezone.now()
        lesson = Lesson.objects.create(
            student=self.student,
            teacher=self.teacher,
            start_time=now - timezone.timedelta(hours=2),
            end_time=now - timezone.timedelta(hours=1),
            lesson_date=(now - timezone.timedelta(hours=2)).date(),
            status='CONFIRMED',
        )

        # First completion
        lesson.status = 'COMPLETED'
        lesson.save(update_fields=['status'])

        # Second save (simulates admin re-saving or double-click)
        lesson.status = 'COMPLETED'
        lesson.save(update_fields=['status'])

        ct_count = CreditTransaction.objects.filter(
            lesson=lesson, reason_code=CreditTransaction.Reason.LESSON
        ).count()
        ee_count = EarningsEvent.objects.filter(
            lesson=lesson, event_type='lesson_credit'
        ).count()

        self.assertEqual(ct_count, 1,
            f'Expected exactly 1 CreditTransaction for lesson, got {ct_count}')
        self.assertEqual(ee_count, 1,
            f'Expected exactly 1 EarningsEvent for lesson, got {ee_count}')

        # Verify the lesson is flagged
        lesson.refresh_from_db()
        self.assertTrue(lesson.credits_consumed,
            'credits_consumed must be True after completion')


# ── Part 8: Teacher Lesson History API tests ───────────────────────────────────

class TeacherLessonHistoryTest(APITestCase):
    """
    Tests for:
      GET  /api/teacher/lesson-history/
      PATCH /api/teacher/lesson-history/<id>/
    """
    URL_LIST   = '/api/teacher/lesson-history/'

    @staticmethod
    def _url_detail(lesson_id: int) -> str:
        return f'/api/teacher/lesson-history/{lesson_id}/'

    def setUp(self):
        from scheduling.models import Lesson
        self.teacher  = make_teacher('+998901000091', 'History Teacher', rate=100_000)
        self.teacher2 = make_teacher('+998902000091', 'Other Teacher',  rate=80_000)
        self.student  = make_student('+998903000091', 'History Student')
        self.student.student_profile.lesson_credits = 10
        self.student.student_profile.save()

        now = timezone.now()
        # past lesson owned by self.teacher
        self.past_lesson = Lesson.objects.create(
            teacher=self.teacher,
            student=self.student,
            start_time=now - timezone.timedelta(hours=2),
            end_time=now - timezone.timedelta(hours=1),
            lesson_date=(now - timezone.timedelta(hours=2)).date(),
            status='CONFIRMED',
        )
        # future lesson (must NOT be editable)
        self.future_lesson = Lesson.objects.create(
            teacher=self.teacher,
            student=self.student,
            start_time=now + timezone.timedelta(hours=1),
            end_time=now + timezone.timedelta(hours=2),
            lesson_date=(now + timezone.timedelta(hours=1)).date(),
            status='CONFIRMED',
        )
        # past lesson owned by teacher2
        self.other_lesson = Lesson.objects.create(
            teacher=self.teacher2,
            student=self.student,
            start_time=now - timezone.timedelta(hours=4),
            end_time=now - timezone.timedelta(hours=3),
            lesson_date=(now - timezone.timedelta(hours=4)).date(),
            status='CONFIRMED',
        )

    # ── 1. Teacher sees only own past lessons ─────────────────────────────────

    def test_teacher_sees_only_own_past_lessons(self):
        self.client.force_authenticate(user=self.teacher)
        res = self.client.get(self.URL_LIST)

        self.assertEqual(res.status_code, 200)
        ids = [l['lesson_id'] for l in res.json()]
        self.assertIn(self.past_lesson.id, ids,
            'Own past lesson must appear in history')
        self.assertNotIn(self.other_lesson.id, ids,
            'Another teacher\'s lesson must NOT appear')
        self.assertNotIn(self.future_lesson.id, ids,
            'Future lesson must NOT appear in history list')

    # ── 2. Cannot PATCH another teacher's lesson ──────────────────────────────

    def test_teacher_cannot_patch_another_teachers_lesson(self):
        self.client.force_authenticate(user=self.teacher)
        res = self.client.patch(
            self._url_detail(self.other_lesson.id),
            data={'status': 'COMPLETED'},
            format='json',
        )
        self.assertEqual(res.status_code, 403,
            'Should get 403 when PATCHing another teacher\'s lesson')

    # ── 3. Cannot PATCH a future lesson ──────────────────────────────────────

    def test_cannot_patch_future_lesson(self):
        self.client.force_authenticate(user=self.teacher)
        res = self.client.patch(
            self._url_detail(self.future_lesson.id),
            data={'status': 'COMPLETED'},
            format='json',
        )
        self.assertEqual(res.status_code, 400,
            'Should get 400 when PATCHing a lesson that has not ended')

    # ── 4. Marking COMPLETED is idempotent ────────────────────────────────────

    def test_completed_status_idempotent(self):
        from accounts.models import CreditTransaction, EarningsEvent
        self.client.force_authenticate(user=self.teacher)

        # First PATCH → COMPLETED
        res1 = self.client.patch(
            self._url_detail(self.past_lesson.id),
            data={'status': 'COMPLETED'},
            format='json',
        )
        self.assertEqual(res1.status_code, 200)

        # Second PATCH → COMPLETED (should fail: can't change from COMPLETED)
        res2 = self.client.patch(
            self._url_detail(self.past_lesson.id),
            data={'status': 'COMPLETED'},
            format='json',
        )
        self.assertEqual(res2.status_code, 400,
            'Second PATCH to COMPLETED must be rejected (already COMPLETED)')

        # Only 1 earnings event and 1 credit transaction
        ct = CreditTransaction.objects.filter(
            lesson=self.past_lesson, reason_code=CreditTransaction.Reason.LESSON
        ).count()
        ee = EarningsEvent.objects.filter(
            lesson=self.past_lesson, event_type='lesson_credit'
        ).count()
        self.assertEqual(ct, 1, f'Expected 1 CreditTransaction, got {ct}')
        self.assertEqual(ee, 1, f'Expected 1 EarningsEvent, got {ee}')

    # ── 5. Cannot revert from COMPLETED ──────────────────────────────────────

    def test_cannot_revert_from_completed(self):
        """Once COMPLETED, no transition is allowed — not even to CANCELLED."""
        from scheduling.models import Lesson
        self.client.force_authenticate(user=self.teacher)
        # Mark directly in DB (bypass API to avoid double-complete check)
        Lesson.objects.filter(pk=self.past_lesson.pk).update(status='COMPLETED', credits_consumed=True)

        res = self.client.patch(
            self._url_detail(self.past_lesson.id),
            data={'status': 'CANCELLED'},
            format='json',
        )
        self.assertEqual(res.status_code, 400,
            'Should get 400 when trying to revert a COMPLETED lesson')


class TeacherWrapUpTest(APITestCase):
    """Tests for PATCH /api/lessons/<pk>/wrap-up/"""

    URL = '/api/lessons/{}/wrap-up/'

    def setUp(self):
        from scheduling.models import Lesson
        now = timezone.now()

        self.teacher       = make_teacher(phone='+998909991001', rate=50_000)
        self.other_teacher = make_teacher(phone='+998909991002', name='Other Teacher')
        self.student       = make_student(phone='+998909991003')
        self.sp            = self.student.student_profile

        self.lesson = Lesson.objects.create(
            teacher=self.teacher,
            student=self.student,
            start_time=now - timezone.timedelta(hours=2),
            end_time=now - timezone.timedelta(hours=1),
            lesson_date=(now - timezone.timedelta(hours=2)).date(),
            status='CONFIRMED',
        )

    def test_teacher_can_wrap_up_own_lesson(self):
        self.client.force_authenticate(user=self.teacher)
        res = self.client.patch(self.URL.format(self.lesson.id), {
            'status': 'CANCELLED',
            'teacher_notes': 'Student did not show up.',
        }, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['status'], 'CANCELLED')
        self.assertEqual(res.data['wrap_up']['teacher_notes'], 'Student did not show up.')

    def test_student_cannot_wrap_up(self):
        self.client.force_authenticate(user=self.student)
        res = self.client.patch(self.URL.format(self.lesson.id), {
            'status': 'COMPLETED', 'teacher_notes': 'x',
        }, format='json')
        self.assertEqual(res.status_code, 403, res.data)

    def test_other_teacher_cannot_wrap_up(self):
        self.client.force_authenticate(user=self.other_teacher)
        res = self.client.patch(self.URL.format(self.lesson.id), {
            'status': 'COMPLETED', 'teacher_notes': 'x',
        }, format='json')
        self.assertEqual(res.status_code, 403, res.data)

    def test_completed_via_wrap_up_deducts_credit_once(self):
        from accounts.models import CreditTransaction, EarningsEvent
        credits_before = self.sp.lesson_credits
        self.client.force_authenticate(user=self.teacher)
        res = self.client.patch(self.URL.format(self.lesson.id), {
            'status': 'COMPLETED', 'teacher_notes': 'Great lesson.',
        }, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data['credits_consumed'])
        self.sp.refresh_from_db()
        self.assertEqual(self.sp.lesson_credits, credits_before - 1)
        self.assertEqual(CreditTransaction.objects.filter(lesson=self.lesson).count(), 1)
        self.assertEqual(
            EarningsEvent.objects.filter(lesson=self.lesson, event_type='lesson_credit').count(), 1
        )
        # Second call — idempotent
        res2 = self.client.patch(self.URL.format(self.lesson.id), {
            'status': 'COMPLETED', 'teacher_notes': 'Edited notes.',
        }, format='json')
        self.assertEqual(res2.status_code, 200, res2.data)
        self.sp.refresh_from_db()
        self.assertEqual(self.sp.lesson_credits, credits_before - 1)
        self.assertEqual(CreditTransaction.objects.filter(lesson=self.lesson).count(), 1)
        self.assertEqual(
            EarningsEvent.objects.filter(lesson=self.lesson, event_type='lesson_credit').count(), 1
        )

    def test_homework_upsert_no_duplicate(self):
        from scheduling.models import LessonWrapUp
        self.client.force_authenticate(user=self.teacher)
        payload = {'status': 'CANCELLED', 'teacher_notes': 'Ok',
                   'homework_text': 'Read chapter 3.', 'homework_due_date': '2026-03-01'}
        self.client.patch(self.URL.format(self.lesson.id), payload, format='json')
        self.client.patch(self.URL.format(self.lesson.id), {
            **payload, 'homework_text': 'Read chapter 4.',
        }, format='json')
        self.assertEqual(LessonWrapUp.objects.filter(lesson=self.lesson).count(), 1)
        wu = LessonWrapUp.objects.get(lesson=self.lesson)
        self.assertEqual(wu.homework_text, 'Read chapter 4.')


# ═══════════════════════════════════════════════════════════════════════════════
# Credit Reserve / Consume Architecture Tests
# ═══════════════════════════════════════════════════════════════════════════════

class CreditReserveTest(TestCase):
    """
    Tests for the reserve-at-booking / finalize-on-completion credit model.

    Flow:
        book  → credits_reserved++; lesson.credits_reserved=True
        COMPLETED / STUDENT_ABSENT → lesson_credits--, credits_reserved--,
                                     lesson.credits_consumed=True
        CANCELLED → credits_reserved-- only; lesson_credits unchanged
    """

    def setUp(self):
        from django.utils import timezone as tz
        self.student = make_student(phone='+998911000001')
        self.teacher = make_teacher(phone='+998912000001')

        sp = self.student.student_profile
        sp.lesson_credits = 5
        sp.credits_reserved = 0
        sp.save()

        # Base times: an hour in the future (no past-lesson validation error)
        self.now  = tz.now()
        self.start = self.now + timezone.timedelta(hours=1)
        self.end   = self.start + timezone.timedelta(hours=1)

    def _make_lesson(self, reserved=True, consumed=False, status='CONFIRMED'):
        from scheduling.models import Lesson
        return Lesson.objects.create(
            teacher=self.teacher,
            student=self.student,
            start_time=self.start,
            end_time=self.end,
            status=status,
            credits_reserved=reserved,
            credits_consumed=consumed,
        )

    def _refresh_student(self):
        self.student.student_profile.refresh_from_db()
        return self.student.student_profile

    # 1 ── booking creates reservation, NOT a deduction ───────────────────────
    def test_booking_creates_reservation_not_deduction(self):
        lesson = self._make_lesson(reserved=True, consumed=False)
        sp = self._refresh_student()
        # lesson_credits unchanged (reservation only)
        self.assertEqual(sp.lesson_credits, 5)
        # lesson flag set correctly
        self.assertTrue(lesson.credits_reserved)
        self.assertFalse(lesson.credits_consumed)

    # 2 ── available = total − reserved; blocked when zero ────────────────────
    def test_booking_blocks_if_available_zero(self):
        sp = self._refresh_student()
        sp.lesson_credits = 1
        sp.credits_reserved = 1   # already holds 1 → available = 0
        sp.save()
        # available_credits property
        self.assertEqual(sp.available_credits, 0)

    # 3 ── COMPLETED: consume once, idempotent on second save ─────────────────
    def test_completed_consumes_once_idempotent(self):
        from scheduling.models import Lesson
        from accounts.models import CreditTransaction
        lesson = self._make_lesson()

        # First transition to COMPLETED
        lesson.status = 'COMPLETED'
        lesson.save(update_fields=['status'])

        sp = self._refresh_student()
        self.assertEqual(sp.lesson_credits, 4)      # 5 - 1
        self.assertEqual(sp.credits_reserved, 0)     # hold released
        lesson.refresh_from_db()
        self.assertTrue(lesson.credits_consumed)
        self.assertFalse(lesson.credits_reserved)
        self.assertEqual(
            CreditTransaction.objects.filter(lesson=lesson).count(), 1
        )

        # Second save — nothing should change
        lesson.status = 'COMPLETED'
        lesson.save(update_fields=['status'])

        sp = self._refresh_student()
        self.assertEqual(sp.lesson_credits, 4)
        self.assertEqual(
            CreditTransaction.objects.filter(lesson=lesson).count(), 1
        )

    # 4 ── STUDENT_ABSENT also charges exactly 1 credit ───────────────────────
    def test_student_absent_also_charges(self):
        from scheduling.models import Lesson
        from accounts.models import CreditTransaction
        lesson = self._make_lesson()

        lesson.status = 'STUDENT_ABSENT'
        lesson.save(update_fields=['status'])

        sp = self._refresh_student()
        self.assertEqual(sp.lesson_credits, 4)
        self.assertEqual(sp.credits_reserved, 0)
        lesson.refresh_from_db()
        self.assertTrue(lesson.credits_consumed)

        tx = CreditTransaction.objects.get(lesson=lesson)
        self.assertEqual(tx.delta, -1)
        self.assertEqual(tx.reason_code, CreditTransaction.Reason.STUDENT_ABSENT)

    # 5 ── CANCELLED releases the hold, no deduction ──────────────────────────
    def test_cancel_releases_reservation_no_charge(self):
        from scheduling.models import Lesson
        from accounts.models import CreditTransaction
        # Simulate that a credit was reserved at booking time
        sp = self._refresh_student()
        sp.credits_reserved = 1
        sp.save()

        lesson = self._make_lesson(reserved=True, consumed=False)

        lesson.status = 'CANCELLED'
        lesson.save(update_fields=['status'])

        sp = self._refresh_student()
        self.assertEqual(sp.lesson_credits, 5)      # unchanged
        self.assertEqual(sp.credits_reserved, 0)     # hold released
        lesson.refresh_from_db()
        self.assertFalse(lesson.credits_reserved)
        self.assertFalse(lesson.credits_consumed)
        self.assertFalse(
            CreditTransaction.objects.filter(lesson=lesson).exists()
        )

    # 6 ── Regression: only 1 net credit drop total (no double deduction) ─────
    def test_no_double_deduction_regression(self):
        from scheduling.models import Lesson
        from accounts.models import CreditTransaction
        # Mirror what booking path does: reserve on profile
        sp = self._refresh_student()
        sp.credits_reserved = 1
        sp.save()

        lesson = self._make_lesson(reserved=True, consumed=False)

        # Mark COMPLETED
        lesson.status = 'COMPLETED'
        lesson.save(update_fields=['status'])

        sp = self._refresh_student()
        # Must be exactly 4, not 3 (no double deduction)
        self.assertEqual(sp.lesson_credits, 4)
        self.assertEqual(sp.credits_reserved, 0)
        self.assertEqual(
            CreditTransaction.objects.filter(lesson=lesson).count(), 1
        )
