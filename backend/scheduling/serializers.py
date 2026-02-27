from rest_framework import serializers
from .models import Lesson, Availability, Activity, LessonTemplate

class AvailabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Availability
        fields = '__all__'


class LessonSerializer(serializers.ModelSerializer):
    teacher = serializers.StringRelatedField(read_only=True)
    student = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Lesson
        fields = ['id', 'room_sid', 'teacher', 'student', 'start_time', 'end_time', 'status', 'meeting_link', 'lesson_date']

class ActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Activity
        fields = ['id', 'title', 'activity_type', 'order', 'content']


class LessonTemplateSerializer(serializers.ModelSerializer):
    # FIX: Changed 'read_all' to 'read_only'
    activities = ActivitySerializer(many=True, read_only=True)

    class Meta:
        model = LessonTemplate
        fields = ['id', 'title', 'description', 'activities', 'created_at']