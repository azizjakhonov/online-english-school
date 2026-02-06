from django.urls import path
from .api import MyLessonsView

urlpatterns = [
    path("my/lessons/", MyLessonsView.as_view(), name="my-lessons"),
]
