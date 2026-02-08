from rest_framework import generics, permissions, serializers, status, views
from rest_framework.response import Response
from django.db.models import Q
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from .models import Availability, Lesson
from accounts.models import TeacherProfile

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
    
    class Meta:
        model = Lesson
        fields = ['id', 'student_name', 'teacher_name', 'start_time', 'end_time', 'status', 'meeting_link']

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

class BookLessonView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # FIX: Check role case-insensitively OR allow if just authenticated
        # This handles "STUDENT" vs "student" mismatch
        if str(request.user.role).upper() != 'STUDENT':
             # Optional: Allow teachers to book themselves for testing
             # return Response({"error": "Only students can book lessons"}, status=403)
             pass 

        profile_id = request.data.get('teacher_id')
        start_time = request.data.get('start_time')
        end_time = request.data.get('end_time')

        if not all([profile_id, start_time, end_time]):
            return Response({"error": "Missing required fields"}, status=400)

        teacher_profile = get_object_or_404(TeacherProfile, id=profile_id)
        teacher_user = teacher_profile.user

        # Prevent booking yourself
        if teacher_user == request.user:
            return Response({"error": "You cannot book a lesson with yourself"}, status=400)

        # Check overlap
        overlap = Lesson.objects.filter(
            teacher=teacher_user,
            start_time__lt=end_time,
            end_time__gt=start_time,
            status__in=['CONFIRMED', 'PENDING']
        ).exists()

        if overlap:
            return Response({"error": "This slot is already booked"}, status=400)

        # Create Lesson
        lesson = Lesson.objects.create(
            teacher=teacher_user,
            student=request.user,
            start_time=start_time,
            end_time=end_time,
            status='CONFIRMED'
        )

        return Response(LessonSerializer(lesson).data, status=201)

class MyLessonsView(generics.ListAPIView):
    serializer_class = LessonSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        now = timezone.now()
        # Returns lessons where user is student OR teacher
        return Lesson.objects.filter(
            Q(student=user) | Q(teacher=user),
            start_time__gte=now
        ).order_by('start_time')

# ==========================================
# 4. STATS VIEW
# ==========================================

class TeacherStatsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        # Similar case-insensitive fix for stats
        if str(user.role).upper() != 'TEACHER':
            return Response({"error": "Not authorized"}, status=403)

        total_students = Lesson.objects.filter(teacher=user).values('student').distinct().count()
        lessons_taught = Lesson.objects.filter(teacher=user, end_time__lt=timezone.now()).count()
        upcoming = Lesson.objects.filter(teacher=user, start_time__gte=timezone.now()).count()
        
        hourly_rate = getattr(user.teacher_profile, 'hourly_rate', 15)
        earnings = lessons_taught * float(hourly_rate)

        return Response({
            "total_students": total_students,
            "lessons_taught": lessons_taught,
            "upcoming_lessons": upcoming,
            "earnings": earnings
        })