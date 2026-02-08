from rest_framework import serializers
from .models import Homework, Question, QuestionOption, HomeworkAssignment, StudentAnswer

# --- LIBRARY (Admin/Teacher View) ---
class HomeworkLibrarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Homework
        fields = ['id', 'title', 'description', 'level', 'created_at']

# --- STUDENT QUIZ VIEW ---
class StudentOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionOption
        fields = ['id', 'text'] 

class StudentQuestionSerializer(serializers.ModelSerializer):
    options = StudentOptionSerializer(many=True, read_only=True)
    class Meta:
        model = Question
        fields = ['id', 'text', 'question_type', 'points', 'options']

class StudentAssignmentDetailSerializer(serializers.ModelSerializer):
    title = serializers.CharField(source='homework.title', read_only=True)
    description = serializers.CharField(source='homework.description', read_only=True)
    questions = StudentQuestionSerializer(source='homework.questions', many=True, read_only=True)

    class Meta:
        model = HomeworkAssignment
        fields = ['id', 'title', 'description', 'due_date', 'is_completed', 'score', 'questions']

# --- SUBMISSION ---
class AnswerInputSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    option_id = serializers.IntegerField()

class HomeworkSubmissionSerializer(serializers.Serializer):
    answers = AnswerInputSerializer(many=True)

# --- TRACKING LISTS (Teacher & Student) ---
class TeacherAssignmentListSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    homework_title = serializers.CharField(source='homework.title', read_only=True)
    
    class Meta:
        model = HomeworkAssignment
        fields = ['id', 'student_name', 'homework_title', 'due_date', 'is_completed', 'score', 'total_points']

    def get_student_name(self, obj):
        # Fail-safe name getter
        try:
            student = obj.lesson.student
            # If student is a Profile, it has .user. If it's already a User, it doesn't.
            user = getattr(student, 'user', student)
            return user.full_name
        except:
            return "Unknown Student"

class StudentAssignmentListSerializer(serializers.ModelSerializer):
    title = serializers.CharField(source='homework.title', read_only=True)
    teacher_name = serializers.SerializerMethodField()
    
    class Meta:
        model = HomeworkAssignment
        fields = ['id', 'title', 'teacher_name', 'due_date', 'is_completed', 'score', 'total_points']

    def get_teacher_name(self, obj):
        # Fail-safe name getter
        try:
            teacher = obj.lesson.teacher
            user = getattr(teacher, 'user', teacher)
            return user.full_name
        except:
            return "Unknown Teacher"


# ... existing imports ...

# ==========================================
# 5. ADMIN CREATION SERIALIZERS
# ==========================================

class OptionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionOption
        fields = ['text', 'is_correct']

class QuestionCreateSerializer(serializers.ModelSerializer):
    options = OptionCreateSerializer(many=True)

    class Meta:
        model = Question
        fields = ['text', 'question_type', 'points', 'options']

class HomeworkCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Homework
        fields = ['title', 'description', 'level']