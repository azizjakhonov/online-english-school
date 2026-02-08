from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
import traceback 

from rest_framework import generics # Use generics for standard CRUD is easier
from .serializers import HomeworkCreateSerializer, QuestionCreateSerializer

from .models import Homework, HomeworkAssignment, Question, QuestionOption, StudentAnswer
from .serializers import (
    HomeworkLibrarySerializer, 
    StudentAssignmentDetailSerializer, 
    HomeworkSubmissionSerializer,
    TeacherAssignmentListSerializer,
    StudentAssignmentListSerializer
)
from lessons.models import Lesson

# --- TEACHER ACTIONS ---

class HomeworkLibraryListView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        level = request.query_params.get('level')
        queryset = Homework.objects.all()
        if level:
            queryset = queryset.filter(level__iexact=level)
        serializer = HomeworkLibrarySerializer(queryset, many=True)
        return Response(serializer.data)

class AssignHomeworkView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, lesson_id):
        try:
            lesson = get_object_or_404(Lesson, id=lesson_id)
            
            # Fail-safe check: Is the requester the teacher of this lesson?
            teacher_obj = lesson.teacher
            teacher_user = getattr(teacher_obj, 'user', teacher_obj)

            if teacher_user != request.user:
                return Response({"error": "Not your lesson"}, status=403)
            
            homework_id = request.data.get('homework_id')
            due_date = request.data.get('due_date')

            if not homework_id or not due_date:
                return Response({"error": "Missing data"}, status=400)

            homework = get_object_or_404(Homework, id=homework_id)

            assignment = HomeworkAssignment.objects.create(
                lesson=lesson,
                homework=homework,
                due_date=due_date
            )
            return Response({"message": "Assigned", "id": assignment.id})
        except Exception as e:
            print("Error assigning:", e)
            return Response({"error": str(e)}, status=500)

class TeacherAssignmentsListView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        # Attempt to filter by Profile, fallback to User
        try:
            assignments = HomeworkAssignment.objects.filter(lesson__teacher__user=request.user)
            # Check if query works
            list(assignments)
        except:
            assignments = HomeworkAssignment.objects.filter(lesson__teacher=request.user)
        
        serializer = TeacherAssignmentListSerializer(assignments.order_by('-assigned_at'), many=True)
        return Response(serializer.data)

# --- STUDENT ACTIONS ---

class StudentAssignmentsListView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        # Attempt to filter by Profile, fallback to User
        try:
            assignments = HomeworkAssignment.objects.filter(lesson__student__user=request.user)
            list(assignments)
        except:
            assignments = HomeworkAssignment.objects.filter(lesson__student=request.user)

        serializer = StudentAssignmentListSerializer(assignments.order_by('is_completed', 'due_date'), many=True)
        return Response(serializer.data)

class StudentHomeworkDetailView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, assignment_id):
        assignment = get_object_or_404(HomeworkAssignment, id=assignment_id)
        
        # Verify ownership
        student_obj = assignment.lesson.student
        student_user = getattr(student_obj, 'user', student_obj)

        if student_user != request.user:
            return Response({"error": "Not your homework"}, status=403)

        serializer = StudentAssignmentDetailSerializer(assignment)
        return Response(serializer.data)

class SubmitHomeworkView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, assignment_id):
        assignment = get_object_or_404(HomeworkAssignment, id=assignment_id)
        if assignment.is_completed:
            return Response({"error": "Already submitted"}, status=400)

        serializer = HomeworkSubmissionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        total_score = 0
        total_possible = 0
        
        # Calculate totals
        all_questions = assignment.homework.questions.all()
        question_map = {q.id: q for q in all_questions}
        for q in all_questions: total_possible += q.points

        # Process answers
        for ans in serializer.validated_data['answers']:
            q_id = ans['question_id']
            opt_id = ans['option_id']
            question = question_map.get(q_id)
            
            if question:
                try:
                    selected_opt = QuestionOption.objects.get(id=opt_id, question=question)
                    is_correct = selected_opt.is_correct
                    StudentAnswer.objects.create(
                        assignment=assignment, question=question,
                        selected_option=selected_opt, is_correct=is_correct
                    )
                    if is_correct: total_score += question.points
                except: pass

        assignment.score = total_score
        assignment.total_points = total_possible
        assignment.is_completed = True
        assignment.save()

        return Response({"message": "Submitted", "score": total_score, "total": total_possible})



class AdminHomeworkCreateView(APIView):
    """POST /api/homework/create/"""
    permission_classes = [IsAuthenticated] # In real app, check if user.is_staff

    def post(self, request):
        serializer = HomeworkCreateSerializer(data=request.data)
        if serializer.is_valid():
            homework = serializer.save()
            return Response({"message": "Homework created", "id": homework.id}, status=201)
        return Response(serializer.errors, status=400)

class AdminQuestionCreateView(APIView):
    """POST /api/homework/<homework_id>/add_question/"""
    permission_classes = [IsAuthenticated]

    def post(self, request, homework_id):
        homework = get_object_or_404(Homework, id=homework_id)
        serializer = QuestionCreateSerializer(data=request.data)
        
        if serializer.is_valid():
            # 1. Create Question
            q_data = serializer.validated_data
            options_data = q_data.pop('options')
            
            question = Question.objects.create(homework=homework, **q_data)

            # 2. Create Options
            for opt in options_data:
                QuestionOption.objects.create(question=question, **opt)
                
            return Response({"message": "Question added"}, status=201)
        return Response(serializer.errors, status=400)

class AdminHomeworkDeleteView(APIView):
    """DELETE /api/homework/<id>/delete/"""
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        homework = get_object_or_404(Homework, pk=pk)
        homework.delete()
        return Response({"message": "Deleted successfully"}, status=200)