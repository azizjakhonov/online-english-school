from django.db import transaction
from rest_framework import serializers

from .models import Course, Unit, Lesson, LessonActivity, PdfAsset, AudioAsset, VideoAsset


class PdfAssetSerializer(serializers.ModelSerializer):
    """
    Serializer for teacher-uploaded PDF assets.
    """

    download_url = serializers.SerializerMethodField()
    file = serializers.FileField(write_only=True)

    class Meta:
        model = PdfAsset
        fields = ['id', 'title', 'file', 'download_url', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_download_url(self, obj) -> str:
        return f'/api/curriculum/pdfs/{obj.id}/download/'


class AudioAssetSerializer(serializers.ModelSerializer):
    """
    Serializer for teacher-uploaded Audio assets.
    """

    download_url = serializers.SerializerMethodField()
    file = serializers.FileField(write_only=True)

    class Meta:
        model = AudioAsset
        fields = ['id', 'title', 'file', 'download_url', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_download_url(self, obj) -> str:
        return f'/api/curriculum/audio/{obj.id}/download/'


class VideoAssetSerializer(serializers.ModelSerializer):
    """
    Serializer for teacher-uploaded Video assets.
    """

    download_url = serializers.SerializerMethodField()
    file = serializers.FileField(write_only=True)

    class Meta:
        model = VideoAsset
        fields = ['id', 'title', 'file', 'download_url', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_download_url(self, obj) -> str:
        return f'/api/curriculum/videos/{obj.id}/download/'


class LessonActivitySerializer(serializers.ModelSerializer):
    lesson = serializers.PrimaryKeyRelatedField(queryset=Lesson.objects.all(), required=False)

    class Meta:
        model = LessonActivity
        fields = ['id', 'lesson', 'title', 'activity_type', 'order', 'content', 'created_at']
        read_only_fields = ['id', 'created_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')

        # Hide activity solutions from non-staff users.
        if request and request.user and not request.user.is_staff:
            if 'solution' in data.get('content', {}):
                data['content'].pop('solution')

        # For PDF activities, inject authenticated download metadata.
        if instance.activity_type == 'pdf':
            pdf_id = data.get('content', {}).get('pdf_id')
            if pdf_id:
                try:
                    pdf = PdfAsset.objects.get(pk=pdf_id)
                    data['content']['pdf_download_url'] = f'/api/curriculum/pdfs/{pdf_id}/download/'
                    data['content']['pdf_title'] = pdf.title or f'Document {pdf_id}'
                except PdfAsset.DoesNotExist:
                    pass

        # For Listening activities, inject authenticated download metadata.
        if instance.activity_type == 'listening':
            audio_id = data.get('content', {}).get('audio_id')
            if audio_id:
                try:
                    audio = AudioAsset.objects.get(pk=audio_id)
                    data['content']['audio_download_url'] = f'/api/curriculum/audio/{audio_id}/download/'
                    data['content']['audio_title'] = audio.title or f'Audio {audio_id}'
                except AudioAsset.DoesNotExist:
                    pass

        # For Video activities, inject authenticated download metadata.
        if instance.activity_type == 'video':
            video_id = data.get('content', {}).get('video_id')
            if video_id:
                try:
                    video = VideoAsset.objects.get(pk=video_id)
                    data['content']['video_download_url'] = f'/api/curriculum/videos/{video_id}/download/'
                    data['content']['video_title'] = video.title or f'Video {video_id}'
                except VideoAsset.DoesNotExist:
                    pass

        return data


class LessonSerializer(serializers.ModelSerializer):
    """
    Canonical lesson template serializer with transactional nested activities.
    """

    activities = LessonActivitySerializer(many=True, required=False)

    class Meta:
        model = Lesson
        fields = ['id', 'unit', 'title', 'order', 'description', 'created_at', 'activities']
        read_only_fields = ['id', 'created_at']

    def _replace_activities(self, lesson: Lesson, activities_data):
        lesson.activities.all().delete()
        new_activities = []
        for index, activity_data in enumerate(activities_data, start=1):
            new_activities.append(
                LessonActivity(
                    lesson=lesson,
                    title=activity_data.get('title') or 'New Activity',
                    activity_type=activity_data['activity_type'],
                    order=activity_data.get('order') or index,
                    content=activity_data.get('content') or {},
                )
            )
        if new_activities:
            LessonActivity.objects.bulk_create(new_activities)

    def create(self, validated_data):
        activities_data = validated_data.pop('activities', [])
        with transaction.atomic():
            lesson = Lesson.objects.create(**validated_data)
            self._replace_activities(lesson, activities_data)
            return lesson

    def update(self, instance, validated_data):
        activities_data = validated_data.pop('activities', None)
        with transaction.atomic():
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()
            if activities_data is not None:
                self._replace_activities(instance, activities_data)
            return instance


class UnitSerializer(serializers.ModelSerializer):
    lessons = LessonSerializer(many=True, read_only=True)

    class Meta:
        model = Unit
        fields = ['id', 'title', 'order', 'lessons']


class CourseSerializer(serializers.ModelSerializer):
    units = UnitSerializer(many=True, read_only=True)

    class Meta:
        model = Course
        fields = ['id', 'title', 'description', 'level', 'units']
