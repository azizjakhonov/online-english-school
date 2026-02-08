from django.urls import path
from .api import (
    MyAvailabilityView, 
    AvailabilityDeleteView, 
    TeacherAvailabilityView,
    BookLessonView,
    MyLessonsView,
    TeacherStatsView
)

urlpatterns = [
    # --- Availability (Setting Hours) ---
    path('my-availability/', MyAvailabilityView.as_view(), name='my-availability'),
    path('my-availability/<int:pk>/', AvailabilityDeleteView.as_view(), name='delete-availability'),
    path('availability/<int:teacher_id>/', TeacherAvailabilityView.as_view(), name='teacher-availability'),

    # --- Booking & Lessons ---
    path('bookings/', BookLessonView.as_view(), name='book-lesson'),
    path('my-lessons/', MyLessonsView.as_view(), name='my-lessons'),

    # --- Stats (Teacher Dashboard) ---
    path('teacher-stats/', TeacherStatsView.as_view(), name='teacher-stats'),
]