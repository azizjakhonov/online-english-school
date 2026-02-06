from django.contrib import admin
from .models import Lesson


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ("teacher", "student", "start_datetime", "end_datetime", "status", "created_at")
    list_filter = ("status",)
    search_fields = (
        "teacher__user__username",
        "teacher__user__email",
        "student__user__username",
        "student__user__email",
    )
    ordering = ("-start_datetime",)
