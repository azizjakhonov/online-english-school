from django.urls import path

from .views import (
    AdminActivityAddView,
    AdminHomeworkDeleteView,
    HomeworkAssignView,
    HomeworkAssignmentDetailView,
    HomeworkCreateView,
    HomeworkLibraryView,
    HomeworkSubmitView,
    HomeworkTemplateDetailView,
    HomeworkTemplateDuplicateView,
    HomeworkTemplateListCreateView,
    HomeworkTemplateReplaceActivitiesView,
    LeaderboardView,
    StudentAssignmentDetailView,
    StudentAssignmentListView,
    TeacherAssignmentListView,
)


urlpatterns = [
    # Canonical template CRUD
    path('templates/', HomeworkTemplateListCreateView.as_view(), name='homework-template-list-create'),
    path('templates/<int:pk>/', HomeworkTemplateDetailView.as_view(), name='homework-template-detail'),
    path('templates/<int:pk>/duplicate/', HomeworkTemplateDuplicateView.as_view(), name='homework-template-duplicate'),
    path('templates/<int:pk>/activities/', HomeworkTemplateReplaceActivitiesView.as_view(), name='homework-template-activities'),

    # Legacy / compatibility template endpoints
    path('library/', HomeworkLibraryView.as_view(), name='homework-library'),
    path('admin/create/', HomeworkCreateView.as_view(), name='homework-create-admin'),
    path('create/', HomeworkCreateView.as_view(), name='homework-create-legacy'),
    path('admin/activity/<int:homework_id>/add/', AdminActivityAddView.as_view(), name='admin-activity-add'),
    path('<int:homework_id>/add_question/', AdminActivityAddView.as_view(), name='homework-add-question-legacy'),
    path('admin/delete/<int:pk>/', AdminHomeworkDeleteView.as_view(), name='admin-homework-delete'),
    path('<int:pk>/delete/', AdminHomeworkDeleteView.as_view(), name='homework-delete-legacy'),

    # Assignment flows
    path('teacher-assignments/', TeacherAssignmentListView.as_view(), name='teacher-assignments'),
    path('assign/<int:lesson_id>/', HomeworkAssignView.as_view(), name='homework-assign'),
    path('assignment/<int:pk>/details/', HomeworkAssignmentDetailView.as_view(), name='homework-results-detail'),

    # Student assignment flows
    path('student-assignments/', StudentAssignmentListView.as_view(), name='student-assignments'),
    path('my-assignments/', StudentAssignmentListView.as_view(), name='student-assignments-legacy'),
    path('assignment/<int:pk>/', StudentAssignmentDetailView.as_view(), name='student-assignment-detail'),
    path('assignment/<int:pk>/submit/', HomeworkSubmitView.as_view(), name='homework-submit'),

    # Leaderboard
    path('leaderboard/', LeaderboardView.as_view(), name='leaderboard'),
]
