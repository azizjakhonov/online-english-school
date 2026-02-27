from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q

from rest_framework import serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import StudentProfile, TeacherProfile, User
from scheduling.models import Lesson  
from .models import LessonContent

# ============================
# Student: My lessons
# ============================

class MyLessonSerializer(serializers.ModelSerializer):
    teacher_username = serializers.CharField(source="teacher.full_name", read_only=True)

    class Meta:
        model = Lesson
        fields = [
            "id",
            "room_sid",      # ✅ Included for Student
            "status",
            "start_time",    
            "end_time",      
            "meeting_link",
            "teacher_username",
            "created_at",
        ]

class MyLessonsView(APIView):
    """
    GET /api/my/lessons/
    Student-only endpoint that returns lessons for request.user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'student': 
            raise ValidationError({"detail": "Only students can view their lessons."})

        qs = Lesson.objects.filter(student=request.user).select_related("teacher").order_by("-start_time")

        # Filters
        now = timezone.now()
        upcoming = request.query_params.get("upcoming")
        past = request.query_params.get("past")
        status_filter = request.query_params.get("status")

        if upcoming and upcoming.lower() in ("1", "true", "yes"):
            qs = qs.filter(start_time__gte=now)

        if past and past.lower() in ("1", "true", "yes"):
            qs = qs.filter(end_time__lt=now)

        if status_filter:
            allowed = {c[0] for c in Lesson.STATUS_CHOICES}
            if status_filter not in allowed:
                raise ValidationError({"status": f"Invalid status. Allowed: {sorted(list(allowed))}"})
            qs = qs.filter(status=status_filter)

        return Response(MyLessonSerializer(qs, many=True).data)


# ============================
# Teacher: list my lessons
# ============================

class TeacherLessonSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source="student.full_name", read_only=True)
    teacher_notes = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = [
            "id",
            "room_sid",        # ✅ FIXED: Added this so Teachers don't get 'undefined'
            "status",
            "start_time",
            "end_time",
            "meeting_link",
            "teacher_notes",
            "student_username",
            "created_at",
        ]

    def get_teacher_notes(self, obj):
        if hasattr(obj, 'content'):
            return obj.content.teacher_notes
        return ""

class TeacherLessonsView(APIView):
    """
    GET /api/teacher/lessons/
    Teacher-only endpoint that returns lessons for request.user (teacher).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'teacher':
            raise ValidationError({"detail": "Only teachers can view their lessons."})

        qs = (
            Lesson.objects
            .filter(teacher=request.user)
            .select_related("student", "teacher")
            .order_by("-start_time")
        )

        now = timezone.now()
        upcoming = request.query_params.get("upcoming")
        past = request.query_params.get("past")
        status_filter = request.query_params.get("status")

        if upcoming and upcoming.lower() in ("1", "true", "yes"):
            qs = qs.filter(start_time__gte=now)

        if past and past.lower() in ("1", "true", "yes"):
            qs = qs.filter(end_time__lt=now)

        if status_filter:
            allowed = {c[0] for c in Lesson.STATUS_CHOICES}
            if status_filter not in allowed:
                raise ValidationError({"status": f"Invalid status. Allowed: {sorted(list(allowed))}"})
            qs = qs.filter(status=status_filter)

        return Response(TeacherLessonSerializer(qs, many=True).data)


# ============================
# Teacher: update a lesson
# ============================

class UpdateLessonSerializer(serializers.Serializer):
    meeting_link = serializers.URLField(required=False, allow_blank=True)
    teacher_notes = serializers.CharField(required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=Lesson.STATUS_CHOICES, required=False)


class LessonDetailView(APIView):
    """
    PATCH /api/lessons/<id>/
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, id): 
        if request.user.role != 'teacher':
            raise ValidationError({"detail": "Only teachers can update lessons."})

        lesson = get_object_or_404(
            Lesson.objects.select_related("teacher", "student"),
            id=id,
            teacher=request.user,
        )

        serializer = UpdateLessonSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if 'meeting_link' in data:
            lesson.meeting_link = data['meeting_link']
            lesson.save(update_fields=['meeting_link'])
        
        if 'status' in data:
            lesson.status = data['status']
            lesson.save(update_fields=['status'])

        if 'teacher_notes' in data:
            content, _ = LessonContent.objects.get_or_create(lesson=lesson)
            content.teacher_notes = data['teacher_notes']
            content.save()

        return Response(
            {
                "detail": "Lesson updated.",
                "lesson": TeacherLessonSerializer(lesson).data,
            },
            status=status.HTTP_200_OK,
        )


# ============================
# Teacher: lesson status
# ============================

class UpdateLessonStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[
            'COMPLETED',
            'CANCELLED',
        ]
    )

class LessonStatusView(APIView):
    """
    PATCH /api/lessons/<id>/status/
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, id): 
        if request.user.role != 'teacher':
            raise ValidationError({"detail": "Only teachers can update lesson status."})

        lesson = get_object_or_404(
            Lesson,
            id=id,
            teacher=request.user,
        )

        if lesson.status in ('COMPLETED', 'CANCELLED'):
            raise ValidationError({"detail": f"Lesson is already {lesson.status} and cannot be changed."})

        serializer = UpdateLessonStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data["status"]

        if new_status == 'COMPLETED' and lesson.end_time > timezone.now():
            raise ValidationError({"detail": "Cannot mark lesson COMPLETED before it ends."})

        lesson.status = new_status
        lesson.save(update_fields=["status"])

        return Response(
            {
                "detail": "Lesson status updated.",
                "lesson_id": lesson.id,
                "status": lesson.status,
            },
            status=status.HTTP_200_OK,
        )