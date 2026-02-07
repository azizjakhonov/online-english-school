from django.urls import path

from .api import (
    AvailableSlotsView,
    BookSlotView,
    AvailabilityRulesView,
    AvailabilityRuleDetailView,
    RegenerateMySlotsView,
    TeacherSlotsView,
    TeacherSlotDetailView,
)

urlpatterns = [
    # Student-facing
    path("teachers/<int:teacher_id>/slots/", AvailableSlotsView.as_view(), name="teacher-available-slots"),
    path("bookings/", BookSlotView.as_view(), name="book-slot"),

    # Teacher availability rules CRUD
    path("availability-rules/", AvailabilityRulesView.as_view(), name="availability-rules"),
    path("availability-rules/<int:rule_id>/", AvailabilityRuleDetailView.as_view(), name="availability-rule-detail"),

    # Teacher slot generation
    path("slots/regenerate/", RegenerateMySlotsView.as_view(), name="regenerate-my-slots"),

    # NEW: Teacher slot management
    path("teacher/slots/", TeacherSlotsView.as_view(), name="teacher-slots"),
    path("teacher/slots/<int:slot_id>/", TeacherSlotDetailView.as_view(), name="teacher-slot-detail"),
]
