from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import StudentProfile, TeacherProfile, User
from lessons.models import Lesson


# ============================
# Student: My lessons (existing)
# ============================

class MyLessonSerializer(serializers.ModelSerializer):
    teacher_username = serializers.CharField(source="teacher.user.username", read_only=True)

    class Meta:
        model = Lesson
        fields = [
            "id",
            "status",
            "start_datetime",
            "end_datetime",
            "meeting_link",
            "teacher_username",
            "created_at",
        ]


class MyLessonsView(APIView):
    """
    GET /api/my/lessons/

    Student-only endpoint that returns lessons for request.user.

    Filters (optional):
    - ?upcoming=true  -> start_datetime >= now
    - ?past=true      -> end_datetime < now
    - ?status=...     -> exact status match (SCHEDULED/COMPLETED/MISSED/CANCELLED)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Only STUDENT users can view "my lessons"
        if request.user.role != User.Roles.STUDENT:
            raise ValidationError({"detail": "Only students can view their lessons."})

        student = get_object_or_404(
            StudentProfile.objects.select_related("user"),
            user=request.user,
        )

        qs = Lesson.objects.filter(student=student).select_related("teacher__user").order_by("-start_datetime")

        # Filters
        now = timezone.now()
        upcoming = request.query_params.get("upcoming")
        past = request.query_params.get("past")
        status_filter = request.query_params.get("status")

        if upcoming and upcoming.lower() in ("1", "true", "yes"):
            qs = qs.filter(start_datetime__gte=now)

        if past and past.lower() in ("1", "true", "yes"):
            qs = qs.filter(end_datetime__lt=now)

        if status_filter:
            allowed = {c[0] for c in Lesson.Status.choices}
            if status_filter not in allowed:
                raise ValidationError({"status": f"Invalid status. Allowed: {sorted(list(allowed))}"})
            qs = qs.filter(status=status_filter)

        return Response(MyLessonSerializer(qs, many=True).data)


# ============================
# Teacher: list my lessons (NEW)
# ============================

class TeacherLessonSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source="student.user.username", read_only=True)

    class Meta:
        model = Lesson
        fields = [
            "id",
            "status",
            "start_datetime",
            "end_datetime",
            "meeting_link",
            "teacher_notes",
            "student_username",
            "created_at",
        ]


class TeacherLessonsView(APIView):
    """
    GET /api/teacher/lessons/

    Teacher-only endpoint that returns lessons for request.user (teacher).

    Filters (optional):
    - ?upcoming=true  -> start_datetime >= now
    - ?past=true      -> end_datetime < now
    - ?status=...     -> exact status match (SCHEDULED/COMPLETED/MISSED/CANCELLED)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Roles.TEACHER:
            raise ValidationError({"detail": "Only teachers can view their lessons."})

        teacher = get_object_or_404(
            TeacherProfile.objects.select_related("user"),
            user=request.user,
        )

        qs = (
            Lesson.objects
            .filter(teacher=teacher)
            .select_related("student__user", "teacher__user")
            .order_by("-start_datetime")
        )

        now = timezone.now()
        upcoming = request.query_params.get("upcoming")
        past = request.query_params.get("past")
        status_filter = request.query_params.get("status")

        if upcoming and upcoming.lower() in ("1", "true", "yes"):
            qs = qs.filter(start_datetime__gte=now)

        if past and past.lower() in ("1", "true", "yes"):
            qs = qs.filter(end_datetime__lt=now)

        if status_filter:
            allowed = {c[0] for c in Lesson.Status.choices}
            if status_filter not in allowed:
                raise ValidationError({"status": f"Invalid status. Allowed: {sorted(list(allowed))}"})
            qs = qs.filter(status=status_filter)

        return Response(TeacherLessonSerializer(qs, many=True).data)


# ============================
# Teacher: update a lesson (NEW)
# ============================

class UpdateLessonSerializer(serializers.Serializer):
    """
    Teacher can update:
    - meeting_link
    - teacher_notes
    - status (optional; must be valid)
    """
    meeting_link = serializers.URLField(required=False, allow_blank=True)
    teacher_notes = serializers.CharField(required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=Lesson.Status.choices, required=False)


class LessonDetailView(APIView):
    """
    PATCH /api/lessons/<lesson_id>/

    Teacher-only:
    - can update meeting_link, teacher_notes, status
    - only for lessons they own
    """

    permission_classes = [IsAuthenticated]

    def patch(self, request, lesson_id: int):
        if request.user.role != User.Roles.TEACHER:
            raise ValidationError({"detail": "Only teachers can update lessons."})

        teacher = get_object_or_404(
            TeacherProfile.objects.select_related("user"),
            user=request.user,
        )

        lesson = get_object_or_404(
            Lesson.objects.select_related("teacher__user", "student__user"),
            id=lesson_id,
            teacher=teacher,  # ownership guard
        )

        serializer = UpdateLessonSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data

        # Apply changes
        for field, value in data.items():
            setattr(lesson, field, value)

        lesson.save(update_fields=list(data.keys()))

        return Response(
            {
                "detail": "Lesson updated.",
                "lesson": TeacherLessonSerializer(lesson).data,
            },
            status=status.HTTP_200_OK,
        )
