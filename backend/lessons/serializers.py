# Add to imports if needed
from rest_framework import serializers
from .models import Lesson

# ... existing serializers ...

class LessonUpdateSerializer(serializers.ModelSerializer):
    """Admin serializer to update schedule or status"""
    class Meta:
        model = Lesson
        fields = ['start_datetime', 'status']




class LessonSerializer(serializers.ModelSerializer):
    """The main serializer used to show lessons on the Dashboard"""
    # These fields provide names instead of just IDs
    teacher_name = serializers.ReadOnlyField(source='teacher.full_name')
    student_name = serializers.ReadOnlyField(source='student.full_name')

    class Meta:
        model = Lesson
        fields = [
            'id', 
            'room_sid',    # 👈 REQUIRED: This fixes the "undefined" error!
            'teacher_name', 
            'student_name', 
            'start_time', 
            'end_time', 
            'status'
        ]
    
