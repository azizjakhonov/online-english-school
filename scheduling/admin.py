from django.contrib import admin
from .models import Availability, Lesson

@admin.register(Availability)
class AvailabilityAdmin(admin.ModelAdmin):
    list_display = ('teacher', 'day_of_week', 'start_time', 'end_time')
    list_filter = ('day_of_week', 'teacher')

@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ('id', 'teacher', 'student', 'start_time', 'status')
    list_filter = ('status', 'start_time')
    search_fields = ('teacher__full_name', 'student__full_name')