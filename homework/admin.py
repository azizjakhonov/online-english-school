from django.contrib import admin
from .models import Homework, HomeworkSubmission


@admin.register(Homework)
class HomeworkAdmin(admin.ModelAdmin):
    list_display = ("lesson", "due_date", "created_at")
    search_fields = (
        "lesson__teacher__user__username",
        "lesson__student__user__username",
    )
    ordering = ("-created_at",)


@admin.register(HomeworkSubmission)
class HomeworkSubmissionAdmin(admin.ModelAdmin):
    list_display = ("homework", "is_checked", "submitted_at")
    list_filter = ("is_checked",)
    search_fields = (
        "homework__lesson__teacher__user__username",
        "homework__lesson__student__user__username",
    )
    ordering = ("-submitted_at",)
