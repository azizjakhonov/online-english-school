from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .api import (
    CourseViewSet,
    UnitViewSet,
    LessonViewSet,
    LessonActivityViewSet,
    PdfAssetViewSet,
    AudioAssetViewSet,
    VideoAssetViewSet,
    EnrollmentListCreateView,
    EnrollmentUpdateView,
)

router = DefaultRouter()
router.register(r'courses',    CourseViewSet)
router.register(r'units',      UnitViewSet)
router.register(r'lessons',    LessonViewSet)         # /api/curriculum/lessons/
router.register(r'activities', LessonActivityViewSet)
router.register(r'pdfs',       PdfAssetViewSet,       # /api/curriculum/pdfs/
                basename='pdfasset')
router.register(r'audio',      AudioAssetViewSet,     # /api/curriculum/audio/
                basename='audioasset')
router.register(r'videos',     VideoAssetViewSet,     # /api/curriculum/videos/
                basename='videoasset')

urlpatterns = [
    path('', include(router.urls)),
    path('enrollments/',          EnrollmentListCreateView.as_view(), name='enrollment-list'),
    path('enrollments/<int:pk>/', EnrollmentUpdateView.as_view(),    name='enrollment-update'),
]
