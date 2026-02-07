from django.urls import path
from .api import MyLessonsView, TeacherLessonsView, LessonDetailView
from .api import MyLessonsView, TeacherLessonsView, LessonDetailView, LessonStatusView

urlpatterns = [
    path("my/lessons/", MyLessonsView.as_view(), name="my-lessons"),

    # Teacher endpoints
    path("teacher/lessons/", TeacherLessonsView.as_view(), name="teacher-lessons"),
    path("lessons/<int:lesson_id>/status/", LessonStatusView.as_view(), name="lesson-status"),

    path("lessons/<int:lesson_id>/", LessonDetailView.as_view(), name="lesson-detail"),
]
