from django.contrib import admin
from .models import LessonContent

@admin.register(LessonContent)
class LessonContentAdmin(admin.ModelAdmin):
    # Display the related lesson and when the content was created
    list_display = ('lesson', 'created_at')