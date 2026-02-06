from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import StudentProfile, User
from lessons.models import Lesson


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
