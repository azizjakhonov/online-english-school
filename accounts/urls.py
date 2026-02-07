from django.urls import path
from .api import RegisterView, MeView
from .api import TeachersListView

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("me/", MeView.as_view(), name="me"),
    path("teachers/", TeachersListView.as_view(), name="teachers-list"),

]
