from django.urls import path

from .api import (
    AssignHomeworkToLessonView,
    MyHomeworkView,
    SubmitHomeworkView,
    ReviewHomeworkSubmissionView,
)

urlpatterns = [
    # Teacher assigns homework to a lesson
    path("lessons/<int:lesson_id>/homework/", AssignHomeworkToLessonView.as_view(), name="assign-homework"),

    # Student views all their homework
    path("my/homework/", MyHomeworkView.as_view(), name="my-homework"),

    # Student submits homework
    path("homework/<int:homework_id>/submit/", SubmitHomeworkView.as_view(), name="submit-homework"),

    # Teacher reviews submission
    path("homework/<int:homework_id>/review/", ReviewHomeworkSubmissionView.as_view(), name="review-homework"),
]
