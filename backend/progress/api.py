from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status, views, permissions
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError

from scheduling.models import Lesson
from .models import LessonProgress

# ============================
# SERIALIZERS
# ============================

class LessonProgressSerializer(serializers.ModelSerializer):
    average_score = serializers.FloatField(source='average_score', read_only=True)
    teacher_name = serializers.CharField(source='lesson.teacher.full_name', read_only=True)
    lesson_date = serializers.DateTimeField(source='lesson.start_time', read_only=True)

    class Meta:
        model = LessonProgress
        fields = [
            "id", "lesson", "teacher_name", "lesson_date",
            "speaking", "grammar", "vocabulary", "listening",
            "teacher_feedback", "average_score", "created_at"
        ]
        read_only_fields = ["id", "lesson", "created_at"]

class SubmitProgressSerializer(serializers.Serializer):
    speaking = serializers.IntegerField(min_value=1, max_value=5)
    grammar = serializers.IntegerField(min_value=1, max_value=5)
    vocabulary = serializers.IntegerField(min_value=1, max_value=5)
    listening = serializers.IntegerField(min_value=1, max_value=5)
    teacher_feedback = serializers.CharField(required=False, allow_blank=True)

# ============================
# VIEWS
# ============================

class SubmitLessonProgressView(views.APIView):
    """
    POST /api/progress/submit/<lesson_id>/
    Teacher submits scores and feedback for a lesson.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, lesson_id):
        if request.user.role != 'teacher':
            raise ValidationError({"detail": "Only teachers can submit progress."})

        # Get the lesson and ensure the requester is the teacher
        lesson = get_object_or_404(Lesson, id=lesson_id, teacher=request.user)

        serializer = SubmitProgressSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Create or Update Progress
        progress, created = LessonProgress.objects.update_or_create(
            lesson=lesson,
            defaults={
                "speaking": data["speaking"],
                "grammar": data["grammar"],
                "vocabulary": data["vocabulary"],
                "listening": data["listening"],
                "teacher_feedback": data.get("teacher_feedback", ""),
            }
        )

        return Response(
            LessonProgressSerializer(progress).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )

class MyProgressView(views.APIView):
    """
    GET /api/progress/history/
    Student views their past feedback/scores.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != 'student':
            raise ValidationError({"detail": "Only students can view progress history."})

        # Get progress for lessons where the user is the student
        progress_history = LessonProgress.objects.filter(
            lesson__student=request.user
        ).order_by('-created_at')

        return Response(LessonProgressSerializer(progress_history, many=True).data)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_dashboard_stats(request):
    """
    GET /api/progress/stats/
    Returns aggregated stats for the student dashboard.
    """
    user = request.user
    if user.role != 'student':
        return Response({"error": "Only students have stats"}, status=403)
    
    # 1. Calculate Completed Lessons (Status is 'COMPLETED')
    completed_count = Lesson.objects.filter(student=user, status='COMPLETED').count()
    
    # 2. Find Next Upcoming Class
    next_class = Lesson.objects.filter(
        student=user, 
        start_time__gte=timezone.now(),
        status='CONFIRMED' # Only show confirmed bookings
    ).order_by('start_time').first()
    
    next_class_data = None
    if next_class:
        next_class_data = {
            "time": next_class.start_time.strftime("%Y-%m-%d %H:%M"),
            "teacher": next_class.teacher.full_name or "Teacher"
        }

    # 3. Determine Level/Title based on progress
    current_lesson_title = "Start Your Journey"
    if completed_count > 0:
        current_lesson_title = "Keep it up! 🚀"
    
    # Simple level calculation
    level = "Beginner"
    if completed_count > 10: level = "Elementary"
    if completed_count > 30: level = "Intermediate"

    return Response({
        "completed_lessons": completed_count,
        "next_class": next_class_data,
        "current_lesson_title": current_lesson_title,
        "level": level
    })