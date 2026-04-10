import logging
from rest_framework import generics, serializers, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.db import models
from django.utils import timezone
from django.shortcuts import get_object_or_404

# Local imports
from .models import TeacherProfile, StudentProfile

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
    average_rating = serializers.SerializerMethodField()
    total_ratings = serializers.SerializerMethodField()
    subjects = serializers.SerializerMethodField()

    class Meta:
        model = TeacherProfile
        fields = [
            'id', 'user', 'bio', 'headline', 'youtube_intro_url',
            'status', 'languages', 'language_certificates',
            'rating', 'lessons_taught', 'is_accepting_students',
            'average_rating', 'total_ratings', 'subjects',
        ]

    def get_average_rating(self, obj):
        from scheduling.models import LessonRating
        from django.db.models import Avg
        result = LessonRating.objects.filter(teacher=obj.user).aggregate(avg=Avg('rating'))
        avg = result['avg']
        return round(avg, 2) if avg is not None else None

    def get_total_ratings(self, obj):
        from scheduling.models import LessonRating
        return LessonRating.objects.filter(teacher=obj.user).count()

    def get_subjects(self, obj):
        """Return list of {id, name} for this teacher's subjects."""
        return [
            {'id': ts.subject.id, 'name': ts.subject.name}
            for ts in obj.teacher_subjects.select_related('subject').all()
        ]

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
            if "youtube_intro_url" in data: profile.youtube_intro_url = data["youtube_intro_url"]
            if "languages" in data: profile.languages = data["languages"]
            if "language_certificates" in data: profile.language_certificates = data["language_certificates"]
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
        queryset = (
            TeacherProfile.objects
            .filter(status='active')
            .prefetch_related('teacher_subjects__subject')
            .order_by('-rating')
        )

        # Search Filter: name, headline, or subject name
        q = self.request.query_params.get('q')
        if q:
            queryset = queryset.filter(
                models.Q(user__full_name__icontains=q) |
                models.Q(headline__icontains=q) |
                models.Q(teacher_subjects__subject__name__icontains=q)
            ).distinct()

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
    'bio', 'headline', 'youtube_intro_url', 'is_accepting_students',
    'languages', 'language_certificates',
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
                'youtube_intro_url':     profile.youtube_intro_url,
                'is_accepting_students': profile.is_accepting_students,
                'languages':             profile.languages,
                'language_certificates': profile.language_certificates,
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
        if 'youtube_intro_url'     in data: profile.youtube_intro_url     = data['youtube_intro_url']
        if 'is_accepting_students' in data: profile.is_accepting_students = data['is_accepting_students']
        if 'languages'             in data: profile.languages             = data['languages']
        if 'language_certificates' in data: profile.language_certificates = data['language_certificates']

        profile.save()
        return Response({'detail': 'Profile updated.'})


# ============================================================================
# 8. ADMIN TEACHER MANAGEMENT
# ============================================================================

class IsAdminRole(permissions.BasePermission):
    """Allow only authenticated users with role ADMIN."""
    message = 'Only admins can access this endpoint.'

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'role', None) == 'ADMIN'
        )


class AdminTeacherListView(generics.ListAPIView):
    """
    GET /api/admin/teachers/?status=pending|active|inactive
    Lists all teacher profiles, optionally filtered by status. Admin only.
    """
    serializer_class = TeacherProfileSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get_queryset(self):
        status_filter = self.request.query_params.get('status')
        qs = TeacherProfile.objects.all().select_related('user').order_by('-user__date_joined')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs


class AdminTeacherApproveView(APIView):
    """
    PATCH /api/admin/teachers/<teacher_id>/approve/
    Sets a teacher's status to 'active'. Admin only.
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    def patch(self, request, teacher_id):
        profile = get_object_or_404(TeacherProfile, pk=teacher_id)
        profile.status = TeacherProfile.Status.ACTIVE
        profile.save(update_fields=['status'])
        return Response({
            'detail': f"Teacher approved.",
            'status': profile.status,
        })


class AdminTeacherDeactivateView(APIView):
    """
    PATCH /api/admin/teachers/<teacher_id>/deactivate/
    Sets a teacher's status to 'inactive'. Admin only.
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    def patch(self, request, teacher_id):
        profile = get_object_or_404(TeacherProfile, pk=teacher_id)
        profile.status = TeacherProfile.Status.INACTIVE
        profile.save(update_fields=['status'])
        return Response({
            'detail': f"Teacher deactivated.",
            'status': profile.status,
        })


# ============================================================================
# 9. TEACHER RATINGS (PUBLIC)
# ============================================================================

class TeacherRatingsView(APIView):
    """
    GET /api/teachers/<teacher_id>/ratings/
    Public list of ratings received by a teacher.
    """
    permission_classes = [AllowAny]

    def get(self, request, teacher_id):
        from scheduling.models import LessonRating
        from django.db.models import Avg
        profile = get_object_or_404(TeacherProfile, pk=teacher_id)
        ratings = LessonRating.objects.filter(teacher=profile.user).order_by('-created_at')
        agg = ratings.aggregate(avg=Avg('rating'))
        data = [
            {
                'id':           r.id,
                'rating':       r.rating,
                'comment':      r.comment,
                'student_name': r.student.full_name or r.student.phone_number,
                'created_at':   r.created_at.isoformat(),
            }
            for r in ratings
        ]
        return Response({
            'teacher_id':     teacher_id,
            'average_rating': round(agg['avg'], 2) if agg['avg'] else None,
            'total_ratings':  ratings.count(),
            'ratings':        data,
        })


# ============================================================================
# 10. SUBJECT NORMALIZATION
# ============================================================================
from .models import Subject, TeacherSubject


class SubjectListView(generics.ListAPIView):
    """
    GET /api/subjects/
    Returns all normalized subjects for the teacher subject picker.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        subjects = Subject.objects.all().order_by('name')
        return Response([{'id': s.id, 'name': s.name} for s in subjects])


class TeacherSubjectView(APIView):
    """
    GET  /api/teacher-subjects/   — teacher's linked subjects
    POST /api/teacher-subjects/   — link a subject  { "subject_id": <id> }
    """
    permission_classes = [IsAuthenticated]

    def _check_teacher(self, user):
        if not hasattr(user, 'teacher_profile'):
            return None, Response({'error': 'Only teachers can manage subjects.'}, status=403)
        return user.teacher_profile, None

    def get(self, request):
        profile, err = self._check_teacher(request.user)
        if err:
            return err
        links = TeacherSubject.objects.filter(teacher=profile).select_related('subject')
        return Response([
            {'id': ts.id, 'subject_id': ts.subject.id, 'name': ts.subject.name}
            for ts in links
        ])

    def post(self, request):
        profile, err = self._check_teacher(request.user)
        if err:
            return err

        subject_id = request.data.get('subject_id')
        try:
            subject = Subject.objects.get(pk=subject_id)
        except Subject.DoesNotExist:
            return Response({'error': 'Subject not found.'}, status=404)

        ts, created = TeacherSubject.objects.get_or_create(teacher=profile, subject=subject)
        return Response(
            {'id': ts.id, 'subject_id': ts.subject.id, 'name': ts.subject.name},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class TeacherSubjectDeleteView(APIView):
    """
    DELETE /api/teacher-subjects/<id>/
    Removes the link between a teacher and a subject.
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        if not hasattr(request.user, 'teacher_profile'):
            return Response({'error': 'Only teachers can manage subjects.'}, status=403)
        profile = request.user.teacher_profile
        ts = get_object_or_404(TeacherSubject, pk=pk, teacher=profile)
        ts.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ============================================================================
# 11. TEACHER PAYOUT
# ============================================================================
from .models import TeacherPayout


class TeacherPayoutListCreateView(APIView):
    """
    GET  /api/payouts/   — teacher's payout history
    POST /api/payouts/   — request a new payout  { "amount": <decimal>, "notes": "..." }
    """
    permission_classes = [IsAuthenticated]

    def _check_teacher(self, user):
        if not hasattr(user, 'teacher_profile'):
            return None, Response({'error': 'Only teachers can access payouts.'}, status=403)
        return user.teacher_profile, None

    def get(self, request):
        profile, err = self._check_teacher(request.user)
        if err:
            return err
        payouts = TeacherPayout.objects.filter(teacher=profile).order_by('-requested_at')
        return Response([
            {
                'id':           p.id,
                'amount':       str(p.amount),
                'currency':     p.currency,
                'status':       p.status,
                'status_label': p.get_status_display(),
                'notes':        p.notes,
                'requested_at': p.requested_at.isoformat(),
                'processed_at': p.processed_at.isoformat() if p.processed_at else None,
            }
            for p in payouts
        ])

    def post(self, request):
        profile, err = self._check_teacher(request.user)
        if err:
            return err

        amount = request.data.get('amount')
        notes  = request.data.get('notes', '')

        if not amount:
            return Response({'error': 'amount is required.'}, status=400)
        try:
            from decimal import Decimal
            amount = Decimal(str(amount))
            if amount <= 0:
                raise ValueError
        except (ValueError, Exception):
            return Response({'error': 'amount must be a positive number.'}, status=400)

        payout = TeacherPayout.objects.create(
            teacher=profile,
            amount=amount,
            notes=notes,
        )
        return Response({
            'id':           payout.id,
            'amount':       str(payout.amount),
            'currency':     payout.currency,
            'status':       payout.status,
            'status_label': payout.get_status_display(),
            'requested_at': payout.requested_at.isoformat(),
        }, status=status.HTTP_201_CREATED)
