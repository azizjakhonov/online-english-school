from django.contrib import admin
from .models import LessonProgress


@admin.register(LessonProgress)
class LessonProgressAdmin(admin.ModelAdmin):
    list_display = ("lesson", "speaking", "grammar", "vocabulary", "listening", "created_at")
    search_fields = (
        "lesson__teacher__phone_number",
        "lesson__student__phone_number",
    )
    ordering = ("-created_at",)
