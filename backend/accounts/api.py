import logging
from rest_framework import generics, serializers, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.db import models
from django.utils import timezone
from django.core import signing

# Local imports
from .models import TeacherProfile, StudentProfile, UserIdentity

logger = logging.getLogger(__name__)
User = get_user_model()

# ==========================================
# 1. SERIALIZERS
# ==========================================


class UserSerializer(serializers.ModelSerializer):
    profile_picture_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'phone_number', 'full_name', 'role', 'date_joined',
                  'profile_picture_url']

    def get_profile_picture_url(self, obj):
        if obj.profile_picture:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_picture.url)
            return obj.profile_picture.url
        return None

class TeacherProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = TeacherProfile
        fields = ['id', 'user', 'bio', 'headline', 'youtube_intro_url', 
                  'hourly_rate', 'rating', 'lessons_taught', 
                  'is_accepting_students']

class StudentProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = StudentProfile
        fields = ['id', 'user', 'level', 'lesson_credits', 'credits_reserved', 'available_credits', 'goals']
        read_only_fields = ['lesson_credits', 'credits_reserved', 'available_credits']

class MeSerializer(serializers.ModelSerializer):
    """
    Serializer for the current user (combines User + Profile data)
    """
    teacher_profile = TeacherProfileSerializer(read_only=True)
    student_profile = StudentProfileSerializer(read_only=True)
    profile_picture_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "phone_number", "email", "role", "full_name",
            "profile_picture_url",
            "teacher_profile", "student_profile", "date_joined",
            "timezone",   # IANA name; frontend uses this to localise displayed times
        ]

    def get_profile_picture_url(self, obj):
        if obj.profile_picture:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_picture.url)
            return obj.profile_picture.url
        return None



class GoogleAuthView(APIView):
    """
    POST /api/auth/google/
    Body: { "id_token": "<Google ID token>" }

    Login Matrix:
    1. Verify id_token with Google.
    2. If UserIdentity(provider='google', provider_id=sub) exists → login that user.
    3. Elif a User with the same email exists → link identity → login.
    4. Else → return 202 with a signed social_token (client must complete OTP flow).
    """
    permission_classes = [AllowAny]

    def post(self, request):
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
        from django.conf import settings

        raw_token = request.data.get('id_token')
        if not raw_token:
            return Response({'error': 'id_token is required'}, status=400)

        client_id = settings.GOOGLE_OAUTH_CLIENT_ID
        if not client_id:
            logger.error('GOOGLE_OAUTH_CLIENT_ID is not configured')
            return Response({'error': 'Google auth is not configured on this server'}, status=500)

        # 1. Verify token
        try:
            idinfo = google_id_token.verify_oauth2_token(
                raw_token,
                google_requests.Request(),
                client_id,
            )
        except ValueError as exc:
            return Response({'error': f'Invalid id_token: {exc}'}, status=400)

        sub = idinfo['sub']          # Google's unique user ID
        email = idinfo.get('email')
        first_name = idinfo.get('given_name', '')
        last_name = idinfo.get('family_name', '')

        # 2. Check for existing Google identity
        try:
            identity = UserIdentity.objects.select_related('user').get(
                provider='google', provider_id=sub
            )
            return Response(_jwt_response(identity.user))
        except UserIdentity.DoesNotExist:
            pass

        # 3. Check for matching email → link and login
        if email:
            try:
                existing_user = User.objects.get(email=email)
                UserIdentity.objects.get_or_create(
                    provider='google',
                    provider_id=sub,
                    defaults={'user': existing_user},
                )
                return Response(_jwt_response(existing_user))
            except User.DoesNotExist:
                pass

        # 4. New Google user — client must verify phone OTP first
        social_token = signing.dumps({
            'provider': 'google',
            'provider_id': sub,
            'email': email or '',
            'first_name': first_name,
            'last_name': last_name,
        })
        return Response(
            {
                'detail': 'Phone verification required',
                'social_token': social_token,
            },
            status=status.HTTP_202_ACCEPTED,
        )


def _jwt_response(user):
    """Return standard JWT login payload."""
    refresh = RefreshToken.for_user(user)
    is_new = user.role == 'NEW' or not user.full_name
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
        'role': user.role,
        'is_new_user': is_new,
    }


class SelectRoleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        role = request.data.get('role')
        full_name = request.data.get('full_name')

        if role not in ['student', 'teacher']:
            return Response({'error': 'Invalid role'}, status=400)

        user = request.user
        user.full_name = full_name
        
        if role == 'student':
            user.role = User.Roles.STUDENT
            StudentProfile.objects.get_or_create(user=user)
        elif role == 'teacher':
            user.role = User.Roles.TEACHER
            TeacherProfile.objects.get_or_create(user=user)
        
        user.save()
        return Response({'message': 'Setup complete'})


# ==========================================
# 3. DATA VIEWS
# ==========================================

class MeView(APIView):
    """
    GET: Returns current user data.
    PATCH: Updates user profile (bio, photo, etc).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = MeSerializer(request.user, context={'request': request})
        return Response(serializer.data)

    def patch(self, request):
        user = request.user
        data = request.data
        
        # 1. Update Basic Info
        if "full_name" in data:
            user.full_name = data["full_name"]
        if "email" in data:
            user.email = data["email"]
        if "timezone" in data:
            import zoneinfo
            tz_input = str(data["timezone"]).strip()
            try:
                zoneinfo.ZoneInfo(tz_input)
                user.timezone = tz_input
            except Exception:
                return Response(
                    {"timezone": "Invalid timezone name. Use IANA name e.g. Asia/Tashkent"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        user.save()

        # 2. Update Teacher Profile
        if user.role == User.Roles.TEACHER:
            profile, _ = TeacherProfile.objects.get_or_create(user=user)
            if "bio" in data: profile.bio = data["bio"]
            if "headline" in data: profile.headline = data["headline"]
            if "hourly_rate" in data: profile.hourly_rate = data["hourly_rate"]
            if "youtube_intro_url" in data: profile.youtube_intro_url = data["youtube_intro_url"]
            profile.save()

        # 3. Update Student Profile
        if user.role == User.Roles.STUDENT:
            profile, _ = StudentProfile.objects.get_or_create(user=user)
            if "goals" in data: profile.goals = data["goals"]
            if "level" in data: profile.level = data["level"]
            profile.save()

        serializer = MeSerializer(user, context={'request': request})
        return Response(serializer.data)
class TeacherDetailView(generics.RetrieveAPIView):
    queryset = TeacherProfile.objects.all()
    serializer_class = TeacherProfileSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'id'

class TeachersListView(generics.ListAPIView):
    """
    Public list of teachers with filtering.
    """
    serializer_class = TeacherProfileSerializer
    permission_classes = [AllowAny] # Changed to AllowAny so guests can see teachers

    def get_queryset(self):
        queryset = TeacherProfile.objects.all().order_by('-rating')
        
        # Search Filter
        q = self.request.query_params.get('q')
        if q:
            queryset = queryset.filter(
                models.Q(user__full_name__icontains=q) | 
                models.Q(headline__icontains=q)
            )
            
        return queryset


# ==========================================
# 4. TEACHER EARNINGS VIEWS
# ==========================================
from datetime import date
from django.db.models import Sum
from .models import EarningsEvent


class TeacherEarningsSummaryView(APIView):
    """
    GET /api/accounts/earnings/summary/
    Returns teacher earnings summary for the current payout period.
    Only accessible by teachers.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not hasattr(user, 'teacher_profile'):
            return Response({'error': 'Only teachers can access earnings.'}, status=403)

        from accounts.services.earnings import compute_teacher_financials
        data = compute_teacher_financials(user)
        # Preserve existing response shape (subset of compute_teacher_financials output)
        return Response({
            'rate_per_lesson_uzs':       data['rate_per_lesson_uzs'],
            'payout_day':                data['payout_day'],
            'current_period_earned_uzs': data['current_period_earned_uzs'],
            'pending_payout_uzs':        data['pending_payout_uzs'],
            # Explicit aggregate: total_earned - total_paid (never negative).
            # Frontend should prefer this field over any client-side recalculation.
            'awaiting_payout_uzs':       data['awaiting_payout_uzs'],
            'total_paid_uzs':            data['total_paid_uzs'],
            'next_payout_date':          data['next_payout_date'],
            'period_start':              data['period_start'],
        })


class TeacherEarningsHistoryView(generics.ListAPIView):
    """
    GET /api/accounts/earnings/history/
    Paginated list of EarningsEvent for the authenticated teacher.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = None  # defined inline below

    def get(self, request, *args, **kwargs):
        user = request.user
        if not hasattr(user, 'teacher_profile'):
            return Response({'error': 'Only teachers can access earnings.'}, status=403)

        events = EarningsEvent.objects.filter(teacher=user).order_by('-created_at')

        data = []
        for e in events:
            data.append({
                'id':           e.id,
                'event_type':   e.event_type,
                'event_label':  e.get_event_type_display(),
                'amount_uzs':   int(e.amount_uzs),
                'reason':       e.reason,
                'lesson_id':    e.lesson_id,
                'payout_ref':   e.payout_ref,
                'created_at':   e.created_at.isoformat(),
            })

        return Response(data)


# ============================================================================
# 5. STUDENT PROFILE HISTORY
# ============================================================================

class StudentProfileView(APIView):
    """
    GET /api/student/profile/
    Returns full profile with lesson history and payment history for the
    authenticated student. Single endpoint — no N+1 queries.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not hasattr(user, 'student_profile'):
            return Response({'error': 'Only students can access this endpoint.'}, status=403)

        from scheduling.models import Lesson
        from payments.models import Payment

        profile = user.student_profile

        now = timezone.now()

        # ── Lesson history: only lessons whose end_time is in the past ──────────
        # A lesson is "history" once it has ended by clock time, regardless of status.
        lessons = (
            Lesson.objects
            .filter(student=user, end_time__lt=now)
            .select_related('teacher')
            .order_by('-start_time')
        )
        lesson_history = []
        for ls in lessons:
            duration_mins = None
            if ls.start_time and ls.end_time:
                delta = ls.end_time - ls.start_time
                duration_mins = int(delta.total_seconds() // 60)
            lesson_history.append({
                'lesson_id':    ls.id,
                'teacher_name': (
                    getattr(ls.teacher, 'full_name', None) or ls.teacher.phone_number
                ),
                'date':         ls.lesson_date.isoformat() if ls.lesson_date else None,
                'start_time':   ls.start_time.isoformat(),
                'end_time':     ls.end_time.isoformat(),
                'status':       ls.status,
                'duration_mins': duration_mins,
                'credits_used':  1 if ls.credits_consumed else 0,
            })

        total_lessons     = len(lesson_history)
        completed_lessons = sum(
            1 for ls in lessons if ls.status == 'COMPLETED'
        )
        total_credits_spent = sum(
            1 for ls in lessons if ls.credits_consumed
        )

        # ── Payment history (newest first) ──────────────────────────────────────
        payments = (
            Payment.objects
            .filter(student=user)
            .order_by('-created_at')
        )
        payment_history = [
            {
                'payment_id':   p.id,
                'date':         p.created_at.date().isoformat(),
                'amount_uzs':   int(p.amount_uzs),
                'credits_added': p.credits_amount,
                'method':       p.method,
                'provider':     p.provider,
                'status':       p.status,
            }
            for p in payments
        ]

        return Response({
            'profile': {
                'id':             profile.id,
                'full_name':      user.full_name,
                'phone_number':   user.phone_number,
                'level':          profile.level,
                'goals':          profile.goals,
                'credits_balance': profile.lesson_credits,
                'crm_status':     profile.crm_status,
            },
            'stats': {
                'total_lessons':      total_lessons,
                'completed_lessons':  completed_lessons,
                'total_credits_spent': total_credits_spent,
            },
            'lesson_history':  lesson_history,
            'payment_history': payment_history,
        })


# ============================================================================
# 6. TEACHER SETTINGS (GET + PATCH)
# ============================================================================

# Fields the teacher is allowed to update via PATCH
_TEACHER_EDITABLE_FIELDS = {
    'bio', 'headline', 'hourly_rate', 'youtube_intro_url', 'is_accepting_students'
}
# Financial keys are NEVER writable (silently stripped)
_TEACHER_FINANCIAL_KEYS = {
    'rate_per_lesson_uzs', 'payout_day', 'total_earned_uzs',
    'current_period_earned_uzs', 'pending_payout_uzs', 'completed_lessons_count',
}


class TeacherSettingsView(APIView):
    """
    GET  /api/teacher/settings/  — full profile + financial summary
    PATCH /api/teacher/settings/  — update allowed profile fields only

    rate_per_lesson_uzs is ADMIN-ONLY and silently ignored in PATCH.
    """
    permission_classes = [IsAuthenticated]

    def _check_teacher(self, user):
        if not hasattr(user, 'teacher_profile'):
            return Response({'error': 'Only teachers can access this endpoint.'}, status=403)
        return None

    def get(self, request):
        err = self._check_teacher(request.user)
        if err:
            return err

        user    = request.user
        profile = user.teacher_profile

        from accounts.services.earnings import compute_teacher_financials
        financials = compute_teacher_financials(user)

        return Response({
            'profile': {
                'bio':                   profile.bio,
                'headline':              profile.headline,
                'hourly_rate':           str(profile.hourly_rate),
                'youtube_intro_url':     profile.youtube_intro_url,
                'is_accepting_students': profile.is_accepting_students,
                'rating':                str(profile.rating),
                'lessons_taught':        profile.lessons_taught,
            },
            'financial': financials,
        })

    def patch(self, request):
        err = self._check_teacher(request.user)
        if err:
            return err

        user    = request.user
        profile = user.teacher_profile
        data    = {k: v for k, v in request.data.items()
                   if k in _TEACHER_EDITABLE_FIELDS}  # silently strip everything else

        if 'bio'                   in data: profile.bio                   = data['bio']
        if 'headline'              in data: profile.headline              = data['headline']
        if 'hourly_rate'           in data: profile.hourly_rate           = data['hourly_rate']
        if 'youtube_intro_url'     in data: profile.youtube_intro_url     = data['youtube_intro_url']
        if 'is_accepting_students' in data: profile.is_accepting_students = data['is_accepting_students']

        profile.save()
        return Response({'detail': 'Profile updated.'})
