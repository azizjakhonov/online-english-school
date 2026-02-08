from rest_framework import serializers
from .models import ClassSchedule

class ClassScheduleSerializer(serializers.ModelSerializer):
    # Make teacher read-only so the API doesn't require it in the POST body
    teacher = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = ClassSchedule
        fields = ['id', 'teacher', 'start_time', 'is_booked', 'meeting_link']