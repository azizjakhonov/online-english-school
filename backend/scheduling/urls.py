from django.urls import path
from rest_framework.routers import DefaultRouter
from .api import (
    MyAvailabilityView, 
    AvailabilityDeleteView, 
    TeacherAvailabilityView,
    BookLessonView,
    MyLessonsView,
    TeacherStatsView,
    EnterClassroomView,
    TeacherLessonHistoryListView,
    TeacherLessonHistoryUpdateView,
    TeacherWrapUpView,
)
from . import views
# Create a router and register our viewsets with it.
router = DefaultRouter()
router.register(r'lessons', views.LessonViewSet, basename='lesson')
router.register(r'availability', views.AvailabilityViewSet, basename='availability')


urlpatterns = [
    # --- Availability (Setting Hours) ---
    path('my-availability/', MyAvailabilityView.as_view(), name='my-availability'),
    path('my-availability/<int:pk>/', AvailabilityDeleteView.as_view(), name='delete-availability'),
    path('availability/<int:teacher_id>/', TeacherAvailabilityView.as_view(), name='teacher-availability'),

    # --- Booking & Lessons ---
    path('bookings/', BookLessonView.as_view(), name='book-lesson'),
    path('my-lessons/', MyLessonsView.as_view(), name='my-lessons'),

    path('classroom/enter/<uuid:room_sid>/', EnterClassroomView.as_view(), name='enter-classroom'),
    path('classroom/<uuid:pk>/update_status/', views.update_lesson_status, name='update-lesson-status'),
    # --- Stats (Teacher Dashboard) ---
    path('teacher-stats/', TeacherStatsView.as_view(), name='teacher-stats'),

    # --- Teacher Lesson History ---
    path('teacher/lesson-history/', TeacherLessonHistoryListView.as_view(), name='teacher-lesson-history-list'),
    path('teacher/lesson-history/<int:lesson_id>/', TeacherLessonHistoryUpdateView.as_view(), name='teacher-lesson-history-update'),

    # --- Teacher Wrap-Up ---
    path('lessons/<int:pk>/wrap-up/', TeacherWrapUpView.as_view(), name='lesson-wrap-up'),
]