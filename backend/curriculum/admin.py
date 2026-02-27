from django.contrib import admin
from .models import Course, Unit, Lesson, LessonActivity, PdfAsset, AudioAsset, VideoAsset

@admin.register(PdfAsset)
class PdfAssetAdmin(admin.ModelAdmin):
    list_display = ('title', 'owner', 'created_at')

@admin.register(AudioAsset)
class AudioAssetAdmin(admin.ModelAdmin):
    list_display = ('title', 'owner', 'created_at')

@admin.register(VideoAsset)
class VideoAssetAdmin(admin.ModelAdmin):
    list_display = ('title', 'owner', 'created_at')

# Inline allows you to add activities directly inside the Lesson page
class LessonActivityInline(admin.StackedInline):
    model = LessonActivity
    extra = 1

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('title', 'level', 'created_at')

@admin.register(Unit)
class UnitAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'order')
    list_filter = ('course',)

@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ('title', 'unit', 'order')
    list_filter = ('unit__course', 'unit')
    inlines = [LessonActivityInline]

@admin.register(LessonActivity)
class LessonActivityAdmin(admin.ModelAdmin):
    list_display = ('title', 'activity_type', 'lesson', 'order')
    list_filter = ('activity_type', 'lesson__unit__course')