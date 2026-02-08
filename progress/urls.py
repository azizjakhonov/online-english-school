from django.urls import path
from .api import (
    SubmitLessonProgressView, 
    MyProgressView, 
    student_dashboard_stats  # Import the correct function name
)

urlpatterns = [
    # Teacher submits feedback
    path('submit/<int:lesson_id>/', SubmitLessonProgressView.as_view(), name='submit-progress'),
    
    # Student views history
    path('history/', MyProgressView.as_view(), name='progress-history'),
    
    # Dashboard Widgets
    path('stats/', student_dashboard_stats, name='dashboard-stats'),
]