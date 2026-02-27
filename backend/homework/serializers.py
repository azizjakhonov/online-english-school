from django.db import transaction
from rest_framework import serializers

from .models import Homework, HomeworkActivity, HomeworkAssignment, StudentActivityResponse


# ==========================================
# 1. TEMPLATE LIBRARY + CREATION
# ==========================================


class HomeworkLibrarySerializer(serializers.ModelSerializer):
    total_max_score = serializers.IntegerField(read_only=True)

    class Meta:
        model = Homework
        fields = ['id', 'title', 'description', 'level', 'created_at', 'total_max_score']


class ActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = HomeworkActivity
        fields = ['id', 'activity_type', 'order', 'content', 'points']
        read_only_fields = ['id']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Injected metadata for media activities
        if instance.activity_type == 'listening':
            from curriculum.models import AudioAsset
            audio_id = data.get('content', {}).get('audio_id')
            if audio_id:
                try:
                    audio = AudioAsset.objects.get(pk=audio_id)
                    data['content']['audio_download_url'] = f'/api/curriculum/audio/{audio_id}/download/'
                    data['content']['audio_title'] = audio.title or f'Audio {audio_id}'
                except AudioAsset.DoesNotExist:
                    pass
        elif instance.activity_type == 'pdf':
            from curriculum.models import PdfAsset
            pdf_id = data.get('content', {}).get('pdf_id')
            if pdf_id:
                try:
                    pdf = PdfAsset.objects.get(pk=pdf_id)
                    data['content']['pdf_download_url'] = f'/api/curriculum/pdfs/{pdf_id}/download/'
                    data['content']['pdf_title'] = pdf.title or f'PDF {pdf_id}'
                except PdfAsset.DoesNotExist:
                    pass
        return data


class HomeworkSerializer(serializers.ModelSerializer):
    activities = ActivitySerializer(many=True, required=False)

    class Meta:
        model = Homework
        fields = ['id', 'title', 'description', 'level', 'created_at', 'activities']
        read_only_fields = ['id', 'created_at']

    def _replace_activities(self, homework: Homework, activities_data):
        homework.activities.all().delete()
        rows = []
        for idx, activity_data in enumerate(activities_data, start=1):
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

    def create(self, validated_data):
        activities_data = validated_data.pop('activities', [])
        with transaction.atomic():
            homework = Homework.objects.create(**validated_data)
            self._replace_activities(homework, activities_data)
            return homework

    def update(self, instance, validated_data):
        activities_data = validated_data.pop('activities', None)
        with transaction.atomic():
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()
            if activities_data is not None:
                self._replace_activities(instance, activities_data)
            return instance


# Compatibility alias
class HomeworkCreateSerializer(HomeworkSerializer):
    pass


# ==========================================
# 2. ASSIGNMENT TRACKING
# ==========================================


class TeacherAssignmentListSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    homework_title = serializers.CharField(source='homework.title', read_only=True)

    class Meta:
        model = HomeworkAssignment
        fields = ['id', 'student_name', 'homework_title', 'due_date', 'is_completed', 'score', 'percentage']

    def get_student_name(self, obj):
        try:
            student = obj.lesson.student
            user = getattr(student, 'user', student)
            return user.full_name or user.phone_number
        except Exception:
            return 'Unknown Student'


class StudentAssignmentListSerializer(serializers.ModelSerializer):
    title = serializers.CharField(source='homework.title', read_only=True)
    teacher_name = serializers.SerializerMethodField()

    class Meta:
        model = HomeworkAssignment
        fields = ['id', 'title', 'teacher_name', 'due_date', 'is_completed', 'score', 'percentage']

    def get_teacher_name(self, obj):
        try:
            teacher = obj.lesson.teacher
            user = getattr(teacher, 'user', teacher)
            return user.full_name or user.phone_number
        except Exception:
            return 'Unknown Teacher'


# ==========================================
# 3. STUDENT DETAIL VIEW
# ==========================================


class StudentAssignmentDetailSerializer(serializers.ModelSerializer):
    title = serializers.CharField(source='homework.title', read_only=True)
    description = serializers.CharField(source='homework.description', read_only=True)
    activities = ActivitySerializer(source='homework.activities', many=True, read_only=True)

    class Meta:
        model = HomeworkAssignment
        fields = ['id', 'title', 'description', 'due_date', 'is_completed', 'score', 'percentage', 'activities']


# ==========================================
# 4. SUBMISSION PAYLOADS
# ==========================================


class ActivitySubmissionSerializer(serializers.Serializer):
    activity_id = serializers.IntegerField()
    answer_data = serializers.JSONField()


class HomeworkSubmissionSerializer(serializers.Serializer):
    answers = ActivitySubmissionSerializer(many=True)


# ==========================================
# 5. RESULTS DETAIL (TEACHER)
# ==========================================


class HomeworkDetailSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    homework_title = serializers.CharField(source='homework.title', read_only=True)
    answers = serializers.SerializerMethodField()

    class Meta:
        model = HomeworkAssignment
        fields = ['id', 'student_name', 'homework_title', 'score', 'percentage', 'answers']

    def get_student_name(self, obj):
        try:
            student = obj.lesson.student
            user = getattr(student, 'user', student)
            return user.full_name or user.phone_number
        except Exception:
            return 'Student'

    def get_answers(self, assignment):
        results = []
        responses = assignment.student_answers.select_related('activity').all()

        for response in responses:
            activity = response.activity
            content = activity.content
            ans_data = response.answer_data

            question_text = ''
            student_ans_str = ''
            correct_ans_str = ''

            if activity.activity_type == 'quiz':
                question_text = content.get('question', 'Quiz Question')
                options = content.get('options', [])

                s_idx = ans_data.get('selected_index')
                if s_idx is not None and isinstance(options, list) and 0 <= s_idx < len(options):
                    student_ans_str = str(options[s_idx])
                else:
                    student_ans_str = '(No Answer)'

                c_idx = content.get('correct_index')
                if c_idx is not None and isinstance(options, list) and 0 <= c_idx < len(options):
                    correct_ans_str = str(options[c_idx])
                else:
                    correct_ans_str = 'Unknown'

            elif activity.activity_type == 'gap_fill':
                question_text = content.get('text', 'Fill in the blanks')

                gaps_dict = ans_data.get('gaps', {})
                try:
                    sorted_gaps = [str(v) for _, v in sorted(gaps_dict.items(), key=lambda item: int(item[0]))]
                    student_ans_str = ', '.join(sorted_gaps) if sorted_gaps else '(Empty)'
                except Exception:
                    student_ans_str = str(gaps_dict)

                import re

                matches = re.findall(r'\{([^}]+)\}', question_text)
                correct_ans_str = ', '.join(matches)

            elif activity.activity_type == 'matching':
                question_text = 'Matching Pairs'

                pairs_dict = ans_data.get('pairs', {})
                s_parts = []
                if isinstance(pairs_dict, dict):
                    s_parts = [f'{k} -> {v}' for k, v in pairs_dict.items()]
                student_ans_str = '; '.join(s_parts)

                c_pairs = content.get('pairs', [])
                c_parts = [f"{p['left']} -> {p['right']}" for p in c_pairs]
                correct_ans_str = '; '.join(c_parts)

            results.append(
                {
                    'question_text': question_text,
                    'student_answer': student_ans_str,
                    'correct_answer': correct_ans_str,
                    'is_correct': response.is_correct,
                    'points_earned': activity.points if response.is_correct else 0,
                    'max_points': activity.points,
                    'type': activity.activity_type,
                }
            )

        return results


# ==========================================
# DEPRECATED / COMPATIBILITY
# ==========================================


class StudentQuestionSerializer(ActivitySerializer):
    pass


class StudentOptionSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    text = serializers.CharField(read_only=True)


class QuestionCreateSerializer(serializers.Serializer):
    pass
