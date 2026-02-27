from django.contrib import admin
from .models import Homework, HomeworkActivity, HomeworkAssignment, StudentActivityResponse

class ActivityInline(admin.StackedInline):
    model = HomeworkActivity
    extra = 0

@admin.register(Homework)
class HomeworkAdmin(admin.ModelAdmin):
    list_display = ('title', 'level', 'created_at', 'total_max_score')
    inlines = [ActivityInline]

@admin.register(HomeworkAssignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = ('homework', 'lesson', 'score', 'is_completed')
    readonly_fields = ('score', 'percentage')

@admin.register(StudentActivityResponse)
class ResponseAdmin(admin.ModelAdmin):
    list_display = ('assignment', 'activity', 'is_correct')