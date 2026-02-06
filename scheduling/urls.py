from django.urls import path
from .api import AvailableSlotsView, BookSlotView, RegenerateMySlotsView

from .api import (
    AvailableSlotsView,
    BookSlotView,
    AvailabilityRulesView,
    AvailabilityRuleDetailView,
)

urlpatterns = [
    # Existing
    path("teachers/<int:teacher_id>/slots/", AvailableSlotsView.as_view(), name="teacher-available-slots"),
    path("bookings/", BookSlotView.as_view(), name="book-slot"),

    # NEW: Teacher availability rules CRUD (teacher manages own rules)
    path("availability-rules/", AvailabilityRulesView.as_view(), name="availability-rules"),
    path("availability-rules/<int:rule_id>/", AvailabilityRuleDetailView.as_view(), name="availability-rule-detail"),
    path("slots/regenerate/", RegenerateMySlotsView.as_view(), name="regenerate-my-slots"),

]
