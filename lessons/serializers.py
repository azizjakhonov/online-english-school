# Add to imports if needed
from rest_framework import serializers
from .models import Lesson

# ... existing serializers ...

class LessonUpdateSerializer(serializers.ModelSerializer):
    """Admin serializer to update schedule or status"""
    class Meta:
        model = Lesson
        fields = ['start_datetime', 'status']