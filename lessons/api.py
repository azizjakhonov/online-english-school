from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q

from rest_framework import serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import StudentProfile, TeacherProfile, User
from scheduling.models import Lesson  # Imported from the correct location
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
            "status",
            "start_time",    # Changed from start_datetime to match new model
            "end_time",      # Changed from end_datetime to match new model
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
        # Only STUDENT users can view "my lessons"
        if request.user.role != 'student': # standardized role check
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
            # FIX: Use STATUS_CHOICES from the new model
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
    # notes are now stored in LessonContent, so we fetch them optionally
    teacher_notes = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = [
            "id",
            "status",
            "start_time",
            "end_time",
            "meeting_link",
            "teacher_notes",
            "student_username",
            "created_at",
        ]

    def get_teacher_notes(self, obj):
        # Safely get notes if the related content object exists
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
    """
    Teacher can update: meeting_link, teacher_notes, status
    """
    meeting_link = serializers.URLField(required=False, allow_blank=True)
    teacher_notes = serializers.CharField(required=False, allow_blank=True)
    # FIX: Use STATUS_CHOICES
    status = serializers.ChoiceField(choices=Lesson.STATUS_CHOICES, required=False)


class LessonDetailView(APIView):
    """
    PATCH /api/lessons/<lesson_id>/
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, id): # Changed lesson_id to id to match URL
        if request.user.role != 'teacher':
            raise ValidationError({"detail": "Only teachers can update lessons."})

        lesson = get_object_or_404(
            Lesson.objects.select_related("teacher", "student"),
            id=id,
            teacher=request.user,  # ownership guard
        )

        serializer = UpdateLessonSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Apply changes to Lesson model
        if 'meeting_link' in data:
            lesson.meeting_link = data['meeting_link']
            lesson.save(update_fields=['meeting_link'])
        
        if 'status' in data:
            lesson.status = data['status']
            lesson.save(update_fields=['status'])

        # Apply changes to LessonContent (Notes)
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
    PATCH /api/lessons/<lesson_id>/status/
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, id): # Changed lesson_id to id to match URL
        if request.user.role != 'teacher':
            raise ValidationError({"detail": "Only teachers can update lesson status."})

        lesson = get_object_or_404(
            Lesson,
            id=id,
            teacher=request.user,
        )

        # Lock finished lessons
        # FIX: Check against string values
        if lesson.status in ('COMPLETED', 'CANCELLED'):
            raise ValidationError({"detail": f"Lesson is already {lesson.status} and cannot be changed."})

        serializer = UpdateLessonStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data["status"]

        # Business rule: cannot mark completed before lesson ends
        # FIX: start_time/end_time are the field names in new model
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