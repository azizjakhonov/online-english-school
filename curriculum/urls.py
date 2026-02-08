from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .api import CourseViewSet, UnitViewSet, LessonViewSet

# Create a router and register our viewsets with it.
router = DefaultRouter()
router.register(r'courses', CourseViewSet)
router.register(r'units', UnitViewSet)
router.register(r'lessons', LessonViewSet) # This will be at /api/curriculum/lessons/

urlpatterns = [
    path('', include(router.urls)),
]