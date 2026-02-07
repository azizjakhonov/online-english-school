from django.shortcuts import get_object_or_404

from rest_framework import serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import StudentProfile, TeacherProfile, User
from lessons.models import Lesson
from progress.models import LessonProgress


# ============================
# Serializers
# ============================

class LessonProgressSerializer(serializers.ModelSerializer):
    average_score = serializers.SerializerMethodField()

    class Meta:
        model = LessonProgress
        fields = [
            "id",
            "lesson",
            "speaking",
            "grammar",
            "vocabulary",
            "listening",
            "teacher_feedback",
            "average_score",
            "created_at",
        ]
        read_only_fields = ["id", "lesson", "average_score", "created_at"]

    def get_average_score(self, obj: LessonProgress) -> float:
        return obj.average_score()


class SubmitProgressSerializer(serializers.Serializer):
    speaking = serializers.IntegerField(min_value=1, max_value=5)
    grammar = serializers.IntegerField(min_value=1, max_value=5)
    vocabulary = serializers.IntegerField(min_value=1, max_value=5)
    listening = serializers.IntegerField(min_value=1, max_value=5)
    teacher_feedback = serializers.CharField(required=False, allow_blank=True)


# ============================
# Teacher submits progress
# ============================

class SubmitLessonProgressView(APIView):
    """
    POST /api/lessons/<lesson_id>/progress/

    Teacher creates or updates LessonProgress for the lesson.
    One progress per lesson (LessonProgress is OneToOne with Lesson).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, lesson_id: int):
        # Only TEACHER users can submit progress
        if request.user.role != User.Roles.TEACHER:
            raise ValidationError({"detail": "Only teachers can submit progress."})

        teacher_profile = get_object_or_404(
            TeacherProfile.objects.select_related("user"),
            user=request.user,
        )

        lesson = get_object_or_404(
            Lesson.objects.select_related("teacher__user", "student__user"),
            id=lesson_id,
        )

        # Ownership check: teacher can submit only for their own lessons
        if lesson.teacher_id != teacher_profile.id:
            raise ValidationError({"detail": "You can only submit progress for your own lessons."})

        serializer = SubmitProgressSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data

        progress, created = LessonProgress.objects.update_or_create(
            lesson=lesson,
            defaults={
                "speaking": data["speaking"],
                "grammar": data["grammar"],
                "vocabulary": data["vocabulary"],
                "listening": data["listening"],
                "teacher_feedback": data.get("teacher_feedback", ""),
            },
        )

        return Response(
            {
                "detail": "Progress created." if created else "Progress updated.",
                "progress": LessonProgressSerializer(progress).data,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


# ============================
# Student views progress history
# ============================

class MyProgressView(APIView):
    """
    GET /api/my/progress/
    Returns progress history for the authenticated student.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Roles.STUDENT:
            raise ValidationError({"detail": "Only students can view progress history."})

        student_profile = get_object_or_404(
            StudentProfile.objects.select_related("user"),
            user=request.user,
        )

        qs = (
            LessonProgress.objects
            .select_related("lesson", "lesson__teacher__user", "lesson__student__user")
            .filter(lesson__student=student_profile)
            .order_by("-created_at")
        )

        # A student-friendly response format
        results = []
        for p in qs:
            results.append(
                {
                    "progress_id": p.id,
                    "lesson_id": p.lesson_id,
                    "teacher_username": p.lesson.teacher.user.username,
                    "start_datetime": p.lesson.start_datetime,
                    "end_datetime": p.lesson.end_datetime,
                    "speaking": p.speaking,
                    "grammar": p.grammar,
                    "vocabulary": p.vocabulary,
                    "listening": p.listening,
                    "average_score": p.average_score(),
                    "teacher_feedback": p.teacher_feedback,
                    "created_at": p.created_at,
                }
            )

        return Response(results)
