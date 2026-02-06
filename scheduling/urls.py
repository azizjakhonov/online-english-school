from django.urls import path
from .api import AvailableSlotsView, BookSlotView

urlpatterns = [
    path("teachers/<int:teacher_id>/slots/", AvailableSlotsView.as_view(), name="teacher-available-slots"),
    path("bookings/", BookSlotView.as_view(), name="book-slot"),
]
