from django.contrib import admin
from .models import AvailabilityRule, LessonSlot, LessonBooking


@admin.register(AvailabilityRule)
class AvailabilityRuleAdmin(admin.ModelAdmin):
    list_display = ("teacher", "weekday", "start_time", "end_time", "is_active", "created_at")
    list_filter = ("weekday", "is_active")
    search_fields = ("teacher__user__username", "teacher__user__email")
    ordering = ("teacher", "weekday", "start_time")


@admin.register(LessonSlot)
class LessonSlotAdmin(admin.ModelAdmin):
    list_display = ("teacher", "start_datetime", "end_datetime", "is_booked", "created_at")
    list_filter = ("is_booked",)
    search_fields = ("teacher__user__username", "teacher__user__email")
    ordering = ("start_datetime",)


@admin.register(LessonBooking)
class LessonBookingAdmin(admin.ModelAdmin):
    list_display = ("slot", "student", "created_at")
    search_fields = (
        "student__user__username",
        "student__user__email",
        "slot__teacher__user__username",
        "slot__teacher__user__email",
    )
    ordering = ("-created_at",)
