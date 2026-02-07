from django.urls import path

from .api import MyProgressView, SubmitLessonProgressView

urlpatterns = [
    path("lessons/<int:lesson_id>/progress/", SubmitLessonProgressView.as_view(), name="submit-lesson-progress"),
    path("my/progress/", MyProgressView.as_view(), name="my-progress"),
]
