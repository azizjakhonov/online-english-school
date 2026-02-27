from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import Case, Count, IntegerField, Sum, Value, When
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import generics, serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from lessons.models import Lesson
from .models import Homework, HomeworkAssignment, HomeworkActivity, StudentActivityResponse
from .serializers import (
    ActivitySerializer,
    HomeworkDetailSerializer,
    HomeworkLibrarySerializer,
    HomeworkSerializer,
    HomeworkSubmissionSerializer,
    StudentAssignmentDetailSerializer,
    StudentAssignmentListSerializer,
    TeacherAssignmentListSerializer,
)


def _resolve_user(maybe_user_or_profile):
    return getattr(maybe_user_or_profile, 'user', maybe_user_or_profile)


def _lesson_actor_lookup(actor_field):
    """
    Resolve HomeworkAssignment -> Lesson actor lookup for mixed schemas.

    Supports both:
    - lesson.<actor_field> -> User
    - lesson.<actor_field> -> Profile (with .user FK)
    """
    actor_model = Lesson._meta.get_field(actor_field).remote_field.model
    if actor_model is User:
        return f'lesson__{actor_field}'
    return f'lesson__{actor_field}__user'


class HomeworkAssignRequestSerializer(serializers.Serializer):
    homework_id = serializers.IntegerField()
    due_date = serializers.DateTimeField()


class HomeworkTemplateListCreateView(APIView):
    """
    Canonical homework template endpoint.

    GET  /api/homework/templates/
    POST /api/homework/templates/
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Homework.objects.all().order_by('-created_at')
        level = request.query_params.get('level')
        query = request.query_params.get('q')
        full = request.query_params.get('full') in {'1', 'true', 'True'}

        if level:
            queryset = queryset.filter(level__iexact=level)
        if query:
            queryset = queryset.filter(title__icontains=query)

        serializer_cls = HomeworkSerializer if full else HomeworkLibrarySerializer
        return Response(serializer_cls(queryset, many=True).data)

    def post(self, request):
        serializer = HomeworkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        template = serializer.save()
        return Response(HomeworkSerializer(template).data, status=status.HTTP_201_CREATED)


class HomeworkTemplateDetailView(APIView):
    """
    Canonical homework template detail endpoint.

    GET    /api/homework/templates/<id>/
    PATCH  /api/homework/templates/<id>/
    DELETE /api/homework/templates/<id>/
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        homework = get_object_or_404(Homework, pk=pk)
        return Response(HomeworkSerializer(homework).data)

    def patch(self, request, pk):
        homework = get_object_or_404(Homework, pk=pk)
        serializer = HomeworkSerializer(homework, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        return Response(HomeworkSerializer(updated).data)

    def delete(self, request, pk):
        homework = get_object_or_404(Homework, pk=pk)
        homework.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class HomeworkTemplateDuplicateView(APIView):
    """
    POST /api/homework/templates/<id>/duplicate/
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        source = get_object_or_404(Homework, pk=pk)
        clone = Homework.objects.create(
            title=f'{source.title} (Copy)',
            description=source.description,
            level=source.level,
        )

        activities = [
            HomeworkActivity(
                homework=clone,
                activity_type=activity.activity_type,
                order=activity.order,
                content=activity.content,
                points=activity.points,
            )
            for activity in source.activities.all().order_by('order')
        ]
        if activities:
            HomeworkActivity.objects.bulk_create(activities)

        return Response(HomeworkSerializer(clone).data, status=status.HTTP_201_CREATED)


class HomeworkTemplateReplaceActivitiesView(APIView):
    """
    PUT /api/homework/templates/<id>/activities/
    """

    permission_classes = [IsAuthenticated]

    def put(self, request, pk):
        homework = get_object_or_404(Homework, pk=pk)
        payload = request.data if isinstance(request.data, list) else request.data.get('activities')
        if payload is None:
            return Response(
                {'detail': 'Expected a list payload or an object with an "activities" field.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ActivitySerializer(data=payload, many=True)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            homework.activities.all().delete()
            rows = []
            for idx, activity_data in enumerate(serializer.validated_data, start=1):
                rows.append(
                    HomeworkActivity(
                        homework=homework,
                        activity_type=activity_data['activity_type'],
                        order=activity_data.get('order') or idx,
                        content=activity_data.get('content') or {},
                        points=activity_data.get('points', 10),
                    )
                )
            if rows:
                HomeworkActivity.objects.bulk_create(rows)

        homework.refresh_from_db()
        return Response(HomeworkSerializer(homework).data)


# ==========================================
# Legacy/compatibility teacher/admin endpoints
# ==========================================


class HomeworkLibraryView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = HomeworkLibrarySerializer

    def get_queryset(self):
        queryset = Homework.objects.all().order_by('-created_at')
        level = self.request.query_params.get('level')
        query = self.request.query_params.get('q')
        if level:
            queryset = queryset.filter(level__iexact=level)
        if query:
            queryset = queryset.filter(title__icontains=query)
        return queryset


class HomeworkCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = HomeworkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        homework = serializer.save()
        return Response({'message': 'Homework created', 'id': homework.id}, status=status.HTTP_201_CREATED)


class AdminActivityAddView(APIView):
    """
    Add a single activity to an existing homework template.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, homework_id):
        homework = get_object_or_404(Homework, id=homework_id)
        serializer = ActivitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(homework=homework)
        return Response({'message': 'Activity added'}, status=status.HTTP_201_CREATED)


class AdminHomeworkDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        homework = get_object_or_404(Homework, pk=pk)
        homework.delete()
        return Response({'message': 'Deleted successfully'}, status=status.HTTP_200_OK)


# ==========================================
# Assignment endpoints
# ==========================================


class TeacherAssignmentListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TeacherAssignmentListSerializer

    def get_queryset(self):
        user = self.request.user
        teacher_lookup = _lesson_actor_lookup('teacher')
        queryset = HomeworkAssignment.objects.filter(**{teacher_lookup: user})
        return queryset.order_by('-assigned_at')


class HomeworkAssignView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, lesson_id):
        lesson = get_object_or_404(Lesson, id=lesson_id)
        teacher_user = _resolve_user(lesson.teacher)

        if teacher_user != request.user and not request.user.is_staff:
            return Response({'error': 'Not your lesson'}, status=status.HTTP_403_FORBIDDEN)

        request_serializer = HomeworkAssignRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=True)

        homework = get_object_or_404(Homework, id=request_serializer.validated_data['homework_id'])

        try:
            assignment = HomeworkAssignment.objects.create(
                lesson=lesson,
                homework=homework,
                due_date=request_serializer.validated_data['due_date'],
            )
        except IntegrityError:
            return Response(
                {'error': 'This lesson already has an assigned homework.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({'message': 'Assigned successfully', 'id': assignment.id}, status=status.HTTP_201_CREATED)


class HomeworkAssignmentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        assignment = get_object_or_404(HomeworkAssignment, pk=pk)
        teacher_user = _resolve_user(assignment.lesson.teacher)
        if teacher_user != request.user and not request.user.is_staff:
            return Response({'detail': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = HomeworkDetailSerializer(assignment)
        return Response(serializer.data)


class StudentAssignmentListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = StudentAssignmentListSerializer

    def get_queryset(self):
        user = self.request.user
        student_lookup = _lesson_actor_lookup('student')
        queryset = HomeworkAssignment.objects.filter(**{student_lookup: user})
        return queryset.order_by('is_completed', 'due_date')


class StudentAssignmentDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = StudentAssignmentDetailSerializer

    def get_queryset(self):
        user = self.request.user
        student_lookup = _lesson_actor_lookup('student')
        queryset = HomeworkAssignment.objects.filter(**{student_lookup: user})
        return queryset


class HomeworkSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        assignment = get_object_or_404(HomeworkAssignment, pk=pk)
        student_user = _resolve_user(assignment.lesson.student)

        if student_user != request.user and not request.user.is_staff:
            return Response({'error': 'Not your assignment'}, status=status.HTTP_403_FORBIDDEN)

        if assignment.is_completed:
            return Response({'error': 'Already submitted'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = HomeworkSubmissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        activities_map = {activity.id: activity for activity in assignment.homework.activities.all()}

        for answer in serializer.validated_data['answers']:
            activity = activities_map.get(answer['activity_id'])
            if not activity:
                continue

            raw_answer = answer['answer_data']
            is_correct = activity.check_answer(raw_answer)

            StudentActivityResponse.objects.update_or_create(
                assignment=assignment,
                activity=activity,
                defaults={'answer_data': raw_answer, 'is_correct': is_correct},
            )

        assignment.is_completed = True
        assignment.calculate_score()
        assignment.save() # Full save including is_completed, score, percentage

        return Response(
            {
                'message': 'Homework submitted!',
                'score': assignment.score,
                'percentage': assignment.percentage,
            },
            status=status.HTTP_200_OK,
        )


class LeaderboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        period = request.query_params.get('period', 'all_time')
        now = timezone.now()
        start_date = None

        if period == 'weekly':
            start_date = now - timedelta(days=7)
        elif period == 'monthly':
            start_date = now - timedelta(days=30)

        students = User.objects.filter(role=User.Roles.STUDENT)
        student_lookup = _lesson_actor_lookup('student')
        leaderboard_data = []

        for student in students:
            assignments = HomeworkAssignment.objects.filter(
                **{student_lookup: student},
                is_completed=True,
            )

            if start_date:
                assignments = assignments.filter(assigned_at__gte=start_date)

            stats = assignments.aggregate(
                perf_xp=Coalesce(Sum('percentage'), 0.0),
                count=Count('id'),
                perfect_bonus=Sum(
                    Case(
                        When(percentage=100.0, then=Value(20)),
                        default=Value(0),
                        output_field=IntegerField(),
                    )
                ),
            )

            tasks_done = stats['count']
            total_xp = int(stats['perf_xp']) + (tasks_done * 50) + (stats['perfect_bonus'] or 0)

            leaderboard_data.append(
                {
                    'student_id': student.id,
                    'student_name': student.full_name or student.phone_number or 'Student',
                    'profile_picture': request.build_absolute_uri(student.profile_picture.url) if student.profile_picture else None,
                    'total_xp': total_xp,
                    'tasks_done': tasks_done,
                }
            )

        leaderboard_data.sort(key=lambda row: row['total_xp'], reverse=True)
        return Response(leaderboard_data)
