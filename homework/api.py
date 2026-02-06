from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import StudentProfile, TeacherProfile, User
from homework.models import Homework, HomeworkSubmission
from lessons.models import Lesson


# ----------------------------
# Serializers
# ----------------------------

class CreateHomeworkSerializer(serializers.Serializer):
    task_text = serializers.CharField()
    due_date = serializers.DateTimeField()
    attachment = serializers.FileField(required=False, allow_null=True)

    def validate_due_date(self, value):
        # Optional rule: due date shouldn't be in the past
        if value <= timezone.now():
            raise ValidationError("due_date must be in the future.")
        return value


class HomeworkListSerializer(serializers.ModelSerializer):
    teacher_username = serializers.CharField(source="lesson.teacher.user.username", read_only=True)
    lesson_id = serializers.IntegerField(source="lesson.id", read_only=True)
    start_datetime = serializers.DateTimeField(source="lesson.start_datetime", read_only=True)
    status = serializers.CharField(source="lesson.status", read_only=True)

    # Submission info (if exists)
    submitted = serializers.SerializerMethodField()
    is_checked = serializers.SerializerMethodField()
    teacher_comment = serializers.SerializerMethodField()
    submitted_at = serializers.SerializerMethodField()

    class Meta:
        model = Homework
        fields = [
            "id",
            "lesson_id",
            "teacher_username",
            "status",
            "start_datetime",
            "task_text",
            "due_date",
            "attachment",
            "created_at",
            "submitted",
            "is_checked",
            "teacher_comment",
            "submitted_at",
        ]

    def get_submitted(self, obj):
        return hasattr(obj, "submission")

    def get_is_checked(self, obj):
        return obj.submission.is_checked if hasattr(obj, "submission") else False

    def get_teacher_comment(self, obj):
        return obj.submission.teacher_comment if hasattr(obj, "submission") else ""

    def get_submitted_at(self, obj):
        return obj.submission.submitted_at if hasattr(obj, "submission") else None


class SubmitHomeworkSerializer(serializers.Serializer):
    answer_text = serializers.CharField(required=False, allow_blank=True, default="")
    file = serializers.FileField(required=False, allow_null=True)


class ReviewSubmissionSerializer(serializers.Serializer):
    is_checked = serializers.BooleanField(required=False)
    teacher_comment = serializers.CharField(required=False, allow_blank=True, default="")


# ----------------------------
# Views
# ----------------------------

class AssignHomeworkToLessonView(APIView):
    """
    POST /api/lessons/<lesson_id>/homework/
    Teacher assigns homework to a specific lesson.

    Only the teacher of that lesson is allowed.
    Homework is OneToOne with Lesson -> cannot be assigned twice.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, lesson_id: int):
        if request.user.role != User.Roles.TEACHER:
            raise ValidationError({"detail": "Only teachers can assign homework."})

        teacher = get_object_or_404(
            TeacherProfile.objects.select_related("user"),
            user=request.user,
        )

        lesson = get_object_or_404(
            Lesson.objects.select_related("teacher__user", "student__user"),
            id=lesson_id,
            teacher=teacher,
        )

        if hasattr(lesson, "homework"):
            raise ValidationError({"detail": "Homework already exists for this lesson."})

        serializer = CreateHomeworkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        hw = Homework.objects.create(
            lesson=lesson,
            task_text=serializer.validated_data["task_text"],
            due_date=serializer.validated_data["due_date"],
            attachment=serializer.validated_data.get("attachment"),
        )

        return Response(
            {
                "detail": "Homework assigned.",
                "homework_id": hw.id,
                "lesson_id": lesson.id,
                "due_date": hw.due_date,
            },
            status=status.HTTP_201_CREATED,
        )


class MyHomeworkView(APIView):
    """
    GET /api/my/homework/
    Student-only: list all homework assigned to the authenticated student.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Roles.STUDENT:
            raise ValidationError({"detail": "Only students can view homework."})

        student = get_object_or_404(
            StudentProfile.objects.select_related("user"),
            user=request.user,
        )

        qs = (
            Homework.objects.filter(lesson__student=student)
            .select_related("lesson__teacher__user", "lesson")
            .order_by("-due_date")
        )

        return Response(HomeworkListSerializer(qs, many=True).data)


class SubmitHomeworkView(APIView):
    """
    POST /api/homework/<homework_id>/submit/
    Student submits a homework (OneToOne submission).

    Only the student of that lesson is allowed.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, homework_id: int):
        if request.user.role != User.Roles.STUDENT:
            raise ValidationError({"detail": "Only students can submit homework."})

        student = get_object_or_404(
            StudentProfile.objects.select_related("user"),
            user=request.user,
        )

        hw = get_object_or_404(
            Homework.objects.select_related("lesson__student__user", "lesson__teacher__user"),
            id=homework_id,
        )

        # Ownership check: homework must belong to this student
        if hw.lesson.student_id != student.id:
            raise ValidationError({"detail": "You can only submit your own homework."})

        if hasattr(hw, "submission"):
            raise ValidationError({"detail": "Homework already submitted."})

        serializer = SubmitHomeworkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        submission = HomeworkSubmission.objects.create(
            homework=hw,
            answer_text=serializer.validated_data.get("answer_text", ""),
            file=serializer.validated_data.get("file"),
        )

        return Response(
            {
                "detail": "Homework submitted.",
                "homework_id": hw.id,
                "submission_id": submission.id,
                "submitted_at": submission.submitted_at,
            },
            status=status.HTTP_201_CREATED,
        )


class ReviewHomeworkSubmissionView(APIView):
    """
    PATCH /api/homework/<homework_id>/review/
    Teacher reviews a student's submission (mark checked + comment).

    Only the teacher of that lesson is allowed.
    """

    permission_classes = [IsAuthenticated]

    def patch(self, request, homework_id: int):
        if request.user.role != User.Roles.TEACHER:
            raise ValidationError({"detail": "Only teachers can review homework."})

        teacher = get_object_or_404(
            TeacherProfile.objects.select_related("user"),
            user=request.user,
        )

        hw = get_object_or_404(
            Homework.objects.select_related("lesson__teacher__user", "lesson__student__user"),
            id=homework_id,
        )

        if hw.lesson.teacher_id != teacher.id:
            raise ValidationError({"detail": "You can only review homework for your own lessons."})

        if not hasattr(hw, "submission"):
            raise ValidationError({"detail": "No submission found for this homework yet."})

        serializer = ReviewSubmissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        submission = hw.submission

        if "is_checked" in serializer.validated_data:
            submission.is_checked = serializer.validated_data["is_checked"]
        else:
            # sensible default: reviewing means checked
            submission.is_checked = True

        if "teacher_comment" in serializer.validated_data:
            submission.teacher_comment = serializer.validated_data["teacher_comment"]

        submission.save(update_fields=["is_checked", "teacher_comment"])

        return Response(
            {
                "detail": "Submission reviewed.",
                "homework_id": hw.id,
                "submission_id": submission.id,
                "is_checked": submission.is_checked,
                "teacher_comment": submission.teacher_comment,
            }
        )
