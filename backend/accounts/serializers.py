from rest_framework import serializers
from .models import User, TeacherProfile, StudentProfile

# 1. MOVE THIS TO THE TOP
class UserSerializer(serializers.ModelSerializer):
    profile_picture = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = ['id', 'phone_number', 'full_name', 'role', 'profile_picture']

    def update(self, instance, validated_data):
        # Update User-level fields
        instance.full_name = validated_data.get('full_name', instance.full_name)
        
        if 'profile_picture' in validated_data:
            instance.profile_picture = validated_data.get('profile_picture')
        
        # Handle TeacherProfile nested update
        request_data = self.context['request'].data
        if instance.role == 'TEACHER' and hasattr(instance, 'teacher_profile'):
            profile = instance.teacher_profile
            profile.headline = request_data.get('headline', profile.headline)
            profile.bio = request_data.get('bio', profile.bio)
            profile.hourly_rate = request_data.get('hourly_rate', profile.hourly_rate)
            profile.youtube_intro_url = request_data.get('youtube_intro_url', profile.youtube_intro_url)
            profile.save()

        instance.save()
        return instance

# 2. NOW THIS CAN FIND "UserSerializer"
class StudentProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    available_credits = serializers.SerializerMethodField()

    class Meta:
        model = StudentProfile
        fields = ['id', 'user', 'level', 'lesson_credits', 'credits_reserved',
                  'available_credits', 'goals']
        read_only_fields = ['lesson_credits', 'credits_reserved', 'available_credits']

    def get_available_credits(self, obj) -> int:
        return obj.available_credits

class TeacherProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeacherProfile
        fields = ['headline', 'bio', 'hourly_rate', 'youtube_intro_url']