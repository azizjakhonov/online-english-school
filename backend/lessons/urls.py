from django.urls import path
from .views import AdminLessonUpdateView # Add import
from .views import ClassroomEntryView

from .api import (
    MyLessonsView, 
    TeacherLessonsView, 
    LessonDetailView, 
    LessonStatusView
)

urlpatterns = [
    # Student: Get their own lessons
    # URL: /api/lessons/my/
    path("my/", MyLessonsView.as_view(), name="my-lessons"),

    # Teacher: Get their own lessons
    # URL: /api/lessons/teacher/
    path("teacher/", TeacherLessonsView.as_view(), name="teacher-lessons"),
    path('enter/<int:pk>/', ClassroomEntryView.as_view(), name='classroom-enter'),    # Teacher: Update lesson details (Link, Notes)
    # URL: /api/lessons/<id>/
    path("<int:id>/", LessonDetailView.as_view(), name="lesson-detail"),
    path('<int:pk>/update/', AdminLessonUpdateView.as_view(), name='admin-lesson-update'),
    # Teacher: Update lesson status (Complete/Cancel)
    # URL: /api/lessons/<id>/status/
    path("<int:id>/status/", LessonStatusView.as_view(), name="lesson-status"),
]