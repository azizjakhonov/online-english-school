from rest_framework import generics, permissions, serializers, status, views
from rest_framework.response import Response
from django.db.models import Q
from django.utils import timezone
from django.db import transaction  # <--- Needed for safe subtraction
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from .models import Availability, Lesson
from accounts.models import TeacherProfile
from .utils import generate_lesson_token, AGORA_APP_ID
from rest_framework.views import APIView
User = get_user_model()

# ==========================================
# 1. SERIALIZERS
# ==========================================

class AvailabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Availability
        fields = ['id', 'day_of_week', 'start_time', 'end_time']

class LessonSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    teacher_name = serializers.CharField(source='teacher.full_name', read_only=True)
    student_profile_picture_url = serializers.SerializerMethodField()
    teacher_profile_picture_url = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        # ✅ FIXED: Added 'room_sid' here. This ensures Dashboard buttons
        # get the UUID required to join the classroom.
        fields = [
            'id',
            'room_sid',
            'student_name',
            'teacher_name',
            'student_profile_picture_url',
            'teacher_profile_picture_url',
            'start_time',
            'end_time',
            'ended_at',
            'status',
            'meeting_link',
        ]

    def get_student_profile_picture_url(self, obj):
        if not obj.student or not obj.student.profile_picture:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.student.profile_picture.url)
        return obj.student.profile_picture.url

    def get_teacher_profile_picture_url(self, obj):
        if not obj.teacher or not obj.teacher.profile_picture:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.teacher.profile_picture.url)
        return obj.teacher.profile_picture.url

# ==========================================
# 2. AVAILABILITY VIEWS
# ==========================================

class MyAvailabilityView(generics.ListCreateAPIView):
    serializer_class = AvailabilitySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Availability.objects.filter(teacher=self.request.user).order_by('day_of_week', 'start_time')

    def perform_create(self, serializer):
        serializer.save(teacher=self.request.user)

class AvailabilityDeleteView(generics.DestroyAPIView):
    serializer_class = AvailabilitySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Availability.objects.filter(teacher=self.request.user)

class TeacherAvailabilityView(generics.ListAPIView):
    serializer_class = AvailabilitySerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        profile_id = self.kwargs['teacher_id']
        teacher_profile = get_object_or_404(TeacherProfile, id=profile_id)
        return Availability.objects.filter(teacher=teacher_profile.user).order_by('day_of_week', 'start_time')

# ==========================================
# 3. BOOKING VIEWS
# ==========================================

class BookLessonView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        teacher_profile_id = request.query_params.get('teacher_id')
        if not teacher_profile_id:
            return Response({"error": "Missing teacher_id"}, status=400)
        
        teacher_profile = get_object_or_404(TeacherProfile, id=teacher_profile_id)
        lessons = Lesson.objects.filter(
            teacher=teacher_profile.user,
            status__in=['CONFIRMED', 'PENDING']
        )
        
        serializer = LessonSerializer(lessons, many=True)
        return Response(serializer.data)

    def post(self, request):
        user = request.user

        # 1. Role check
        if not user.is_student:
            return Response({'error': 'Only students can book lessons'}, status=400)

        # 2. Validate input
        profile_id = request.data.get('teacher_id')
        start_time = request.data.get('start_time')
        end_time   = request.data.get('end_time')

        if not all([profile_id, start_time, end_time]):
            return Response({'error': 'Missing required fields'}, status=400)

        try:
            with transaction.atomic():
                # A. Lock student profile (prevent race conditions)
                from accounts.models import StudentProfile
                student_profile = StudentProfile.objects.select_for_update().get(user=user)

                # B. Check AVAILABLE credits (total − reserved)
                available = student_profile.lesson_credits - student_profile.credits_reserved
                if available < 1:
                    return Response(
                        {'error': 'Insufficient credits. Please recharge your wallet.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # C. Find teacher
                teacher_profile = get_object_or_404(TeacherProfile, id=profile_id)
                teacher_user    = teacher_profile.user

                if teacher_user == user:
                    return Response({'error': 'You cannot book a lesson with yourself'}, status=400)

                # D. Idempotency: return existing active booking for same slot
                existing = Lesson.objects.filter(
                    student=user,
                    teacher=teacher_user,
                    start_time=start_time,
                    status__in=['CONFIRMED', 'PENDING']
                ).first()
                if existing:
                    return Response(LessonSerializer(existing).data, status=200)

                # E. Check teacher overlap
                overlap = Lesson.objects.filter(
                    teacher=teacher_user,
                    start_time__lt=end_time,
                    end_time__gt=start_time,
                    status__in=['CONFIRMED', 'PENDING']
                ).exists()
                if overlap:
                    return Response({'error': 'This slot is already booked'}, status=400)

                # F. Reserve 1 credit on the profile (use F() for race safety)
                from django.db.models import F as DbF
                StudentProfile.objects.filter(pk=student_profile.pk).update(
                    credits_reserved=DbF('credits_reserved') + 1
                )

                # G. Create lesson with reservation flag
                lesson = Lesson.objects.create(
                    teacher=teacher_user,
                    student=user,
                    start_time=start_time,
                    end_time=end_time,
                    status='CONFIRMED',
                    credits_reserved=True,
                    credits_consumed=False,
                )

                return Response(LessonSerializer(lesson).data, status=201)

        except Exception as e:
            return Response({'error': str(e)}, status=400)

        

class MyLessonsView(generics.ListAPIView):
    serializer_class = LessonSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        now = timezone.now()
        # Grace period: keep a lesson visible for 10 minutes after its scheduled end_time
        # so users can still join while the lesson is running.
        grace = timezone.timedelta(minutes=10)
        return Lesson.objects.filter(
            Q(student=user) | Q(teacher=user),
            end_time__gte=now - grace,           # includes in-progress + upcoming
            status__in=['PENDING', 'CONFIRMED'],  # exclude completed / cancelled
        ).select_related('student', 'teacher').order_by('start_time')

# ==========================================
# 4. STATS VIEW
# ==========================================

class TeacherStatsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if str(user.role).upper() != 'TEACHER':
            return Response({"error": "Not authorized"}, status=403)

        total_students = Lesson.objects.filter(teacher=user).values('student').distinct().count()
        lessons_taught = Lesson.objects.filter(teacher=user, end_time__lt=timezone.now()).count()
        upcoming = Lesson.objects.filter(teacher=user, start_time__gte=timezone.now()).count()
        
        hourly_rate = 15
        if hasattr(user, 'teacher_profile'):
             hourly_rate = getattr(user.teacher_profile, 'hourly_rate', 15)
        
        earnings = lessons_taught * float(hourly_rate)

        return Response({
            "total_students": total_students,
            "lessons_taught": lessons_taught,
            "upcoming_lessons": upcoming,
            "earnings": earnings
        })

# ==========================================
# 5. CLASSROOM ENTRY (THE BOUNCER)
# ==========================================

class EnterClassroomView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, room_sid):
        """
        Securely verifies user access and provides an Agora RTC Token.
        """
        user = request.user
        lesson = get_object_or_404(Lesson, room_sid=room_sid)

        is_teacher = lesson.teacher == user
        is_student = lesson.student == user

        if not (is_teacher or is_student or user.is_superuser):
            return Response(
                {"error": "You are not authorized to enter this classroom."}, 
                status=403
            )

        # Generate Agora Token using the secure UID
        token = generate_lesson_token(str(room_sid), user.id)

        teacher_name = lesson.teacher.full_name or "Teacher"
        teacher_avatar = None
        if lesson.teacher.profile_picture:
            teacher_avatar = request.build_absolute_uri(lesson.teacher.profile_picture.url)

        return Response({
            "token": token,
            "appId": AGORA_APP_ID,
            "channel": str(room_sid),
            "uid": user.id,
            "role": "teacher" if is_teacher else "student",
            "lesson_id": lesson.id,
            "teacher_name": teacher_name,
            "teacher_profile_picture_url": teacher_avatar
        })


# ==========================================
# 7. TEACHER LESSON HISTORY
# ==========================================

class IsTeacher(permissions.BasePermission):
    """Allow only authenticated users whose role is TEACHER."""
    message = "Only teachers can access this endpoint."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'role', None) == 'TEACHER'
        )


class TeacherLessonHistorySerializer(serializers.ModelSerializer):
    """
    Read-only serializer for the teacher-facing lesson history.
    Includes payout / credit financial data derived from related models.
    """
    lesson_id                 = serializers.IntegerField(source='id', read_only=True)
    student_name              = serializers.CharField(source='student.full_name', read_only=True)
    student_phone             = serializers.CharField(source='student.phone_number', read_only=True)
    student_profile_picture_url = serializers.SerializerMethodField()
    teacher_rate_uzs          = serializers.SerializerMethodField()
    payout_amount_uzs         = serializers.SerializerMethodField()
    payout_status             = serializers.SerializerMethodField()
    earnings_event_id         = serializers.SerializerMethodField()
    credit_transaction_id     = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = [
            'lesson_id',
            'student_name',
            'student_phone',
            'student_profile_picture_url',
            'start_time',
            'end_time',
            'status',
            'credits_consumed',
            'teacher_rate_uzs',
            'payout_amount_uzs',
            'payout_status',
            'earnings_event_id',
            'credit_transaction_id',
        ]

    def _lesson_earning(self, obj):
        """Return the first lesson_credit EarningsEvent for this lesson (or None)."""
        return (
            obj.earnings_events
            .filter(event_type='lesson_credit')
            .order_by('created_at')
            .first()
        )

    def get_student_profile_picture_url(self, obj):
        if not obj.student or not getattr(obj.student, 'profile_picture', None):
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.student.profile_picture.url)
        return obj.student.profile_picture.url

    def get_teacher_rate_uzs(self, obj):
        try:
            return int(obj.teacher.teacher_profile.rate_per_lesson_uzs)
        except Exception:
            return 0

    def get_payout_amount_uzs(self, obj):
        ev = self._lesson_earning(obj)
        return int(ev.amount_uzs) if ev else 0

    def get_payout_status(self, obj):
        ev = self._lesson_earning(obj)
        if ev is None:
            return 'PENDING'
        # Check if a payout event covers this teacher after this earning
        from accounts.models import EarningsEvent
        paid = EarningsEvent.objects.filter(
            teacher=obj.teacher,
            event_type='payout',
            created_at__gte=ev.created_at,
        ).exists()
        return 'PAID' if paid else 'PENDING'

    def get_earnings_event_id(self, obj):
        ev = self._lesson_earning(obj)
        return ev.id if ev else None

    def get_credit_transaction_id(self, obj):
        from accounts.models import CreditTransaction
        ct = (
            CreditTransaction.objects
            .filter(lesson=obj, reason_code=CreditTransaction.Reason.LESSON)
            .order_by('created_at')
            .first()
        )
        return ct.id if ct else None


class TeacherLessonHistoryListView(APIView):
    """
    GET /api/teacher/lesson-history/
    Returns all past lessons (end_time < now) for the authenticated teacher,
    newest first. Only the teacher's own lessons.
    """
    permission_classes = [permissions.IsAuthenticated, IsTeacher]

    def get(self, request):
        from accounts.models import EarningsEvent, CreditTransaction
        now = timezone.now()
        lessons = (
            Lesson.objects
            .filter(teacher=request.user, end_time__lt=now)
            .select_related('student', 'teacher__teacher_profile')
            .prefetch_related('earnings_events')
            .order_by('-start_time')
        )
        serializer = TeacherLessonHistorySerializer(
            lessons, many=True, context={'request': request}
        )
        return Response(serializer.data)


class TeacherLessonHistoryUpdateView(APIView):
    """
    PATCH /api/teacher/lesson-history/<lesson_id>/
    Allows the assigned teacher to update the status of a past lesson.
    Enforces valid status transitions and prevents editing future lessons.
    """
    permission_classes = [permissions.IsAuthenticated, IsTeacher]

    # Map: current_status → set of allowed next statuses
    ALLOWED_TRANSITIONS = {
        'PENDING':   {'COMPLETED', 'STUDENT_ABSENT', 'CANCELLED'},
        'CONFIRMED': {'COMPLETED', 'STUDENT_ABSENT', 'CANCELLED'},
    }

    def patch(self, request, lesson_id):
        lesson = get_object_or_404(Lesson, pk=lesson_id)

        # --- authorization ---
        if lesson.teacher_id != request.user.pk:
            return Response(
                {'error': 'You are not the assigned teacher for this lesson.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # --- must be in the past ---
        if lesson.end_time >= timezone.now():
            return Response(
                {'error': 'Cannot update status of a lesson that has not ended yet.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        new_status = request.data.get('status')
        if not new_status:
            return Response(
                {'error': 'status field is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --- guard current status ---
        allowed = self.ALLOWED_TRANSITIONS.get(lesson.status)
        if allowed is None:
            return Response(
                {'error': f'Cannot change status from {lesson.status}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_status not in allowed:
            return Response(
                {'error': f'Transition {lesson.status} → {new_status} is not allowed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --- apply change (signal fires on COMPLETED automatically) ---
        lesson.status = new_status
        lesson.save(update_fields=['status'])

        # Re-fetch with related data for response
        lesson.refresh_from_db()
        serializer = TeacherLessonHistorySerializer(
            lesson, context={'request': request}
        )
        return Response(serializer.data)


# ─────────────────────────────────────────────────────────────────────────────
# TEACHER WRAP-UP  (PATCH /api/lessons/<pk>/wrap-up/)
# ─────────────────────────────────────────────────────────────────────────────

from .models import LessonWrapUp   # local, safe late import to stay additive


class LessonWrapUpSerializer(serializers.ModelSerializer):
    class Meta:
        model  = LessonWrapUp
        fields = ['teacher_notes', 'homework_text', 'homework_due_date',
                  'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class TeacherWrapUpView(APIView):
    """
    PATCH /api/lessons/<pk>/wrap-up/

    Payload:
        {
            "status": "COMPLETED" | "STUDENT_ABSENT" | "CANCELLED",
            "teacher_notes": "...",           # optional str
            "homework_text": "...",           # optional str
            "homework_due_date": "YYYY-MM-DD" # optional / null
        }

    Behaviour:
    - Only the owning teacher (or staff) may call this.
    - Validates status transition (same rules as TeacherLessonHistoryUpdateView).
    - Updates Lesson.status with update_fields=['status'] so the completion
      signal fires exactly once and stays idempotent.
    - Upserts LessonWrapUp (OneToOne) — safe to call many times.
    - Does NOT touch credits directly; that is handled by the post_save signal.
    """
    permission_classes = [permissions.IsAuthenticated]

    ALLOWED_WRAP_UP_STATUSES = {'COMPLETED', 'STUDENT_ABSENT', 'CANCELLED'}

    def patch(self, request, pk):
        lesson = get_object_or_404(Lesson, pk=pk)

        # ── Permission: must be the lesson's teacher or staff ────────────────
        if not (request.user.is_staff or lesson.teacher_id == request.user.pk):
            return Response(
                {'error': 'You are not the teacher for this lesson.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # ── Validate status ───────────────────────────────────────────────────
        new_status = request.data.get('status', '').strip().upper()
        if new_status not in self.ALLOWED_WRAP_UP_STATUSES:
            return Response(
                {'error': f'status must be one of: {", ".join(sorted(self.ALLOWED_WRAP_UP_STATUSES))}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        teacher_notes     = request.data.get('teacher_notes', '').strip()
        homework_text     = request.data.get('homework_text', '').strip()
        homework_due_date = request.data.get('homework_due_date') or None

        # ── Update lesson status (triggers credit signal on COMPLETED) ────────
        lesson.status = new_status
        lesson.save(update_fields=['status'])

        # ── Upsert wrap-up record ─────────────────────────────────────────────
        wrap_up, _ = LessonWrapUp.objects.get_or_create(lesson=lesson)
        wrap_up.teacher_notes     = teacher_notes
        wrap_up.homework_text     = homework_text
        wrap_up.homework_due_date = homework_due_date
        wrap_up.save(update_fields=['teacher_notes', 'homework_text',
                                    'homework_due_date', 'updated_at'])

        lesson.refresh_from_db()
        return Response({
            'detail': 'Wrap-up saved.',
            'lesson_id': lesson.pk,
            'status': lesson.status,
            'credits_consumed': lesson.credits_consumed,
            'wrap_up': LessonWrapUpSerializer(wrap_up).data,
        })
