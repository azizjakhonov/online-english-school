from django.urls import path
from .views import (
    HomeworkLibraryListView, 
    AssignHomeworkView, 
    StudentHomeworkDetailView, 
    SubmitHomeworkView,
    TeacherAssignmentsListView,
    StudentAssignmentsListView,
    AdminHomeworkCreateView,
    AdminHomeworkDeleteView,
    AdminQuestionCreateView

)

urlpatterns = [
    # Teacher URLs
    path('library/', HomeworkLibraryListView.as_view(), name='homework-library'),
    path('assign/<int:lesson_id>/', AssignHomeworkView.as_view(), name='assign-homework'),
    path('teacher-assignments/', TeacherAssignmentsListView.as_view(), name='teacher-assignments'),
    # Student URLs
    path('assignment/<int:assignment_id>/', StudentHomeworkDetailView.as_view(), name='student-homework-detail'),
    path('create/', AdminHomeworkCreateView.as_view(), name='admin-homework-create'),
    path('<int:homework_id>/add_question/', AdminQuestionCreateView.as_view(), name='admin-question-add'),
    path('<int:pk>/delete/', AdminHomeworkDeleteView.as_view(), name='admin-homework-delete'),
    path('my-assignments/', StudentAssignmentsListView.as_view(), name='my-assignments'),
    path('assignment/<int:assignment_id>/submit/', SubmitHomeworkView.as_view(), name='submit-homework'),
]