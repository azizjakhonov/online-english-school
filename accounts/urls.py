from django.urls import path
from .api import RegisterView, MeView
from .api import TeachersListView
from .api import RegisterStudentView, RegisterTeacherView, MeView, TeachersListView  # keep your existing imports

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("teachers/", TeachersListView.as_view(), name="teachers-list"),
    path("auth/register/student/", RegisterStudentView.as_view(), name="register-student"),
    path("auth/register/teacher/", RegisterTeacherView.as_view(), name="register-teacher"),
]
