from django.contrib import admin
from .models import Course, Unit, Lesson, LessonActivity, PdfAsset, AudioAsset, VideoAsset, Enrollment

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


# ════════════════════════════════════════════════════════════════════
#  ENROLLMENT ADMIN
# ════════════════════════════════════════════════════════════════════
@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display  = ('student', 'course', 'status', 'started_at', 'completed_at')
    list_filter   = ('status', 'course')
    search_fields = ('student__user__phone_number', 'student__user__full_name', 'course__title')
    ordering      = ('-created_at',)
    readonly_fields = ('started_at', 'created_at', 'updated_at')
