from django.db import IntegrityError
from django.shortcuts import get_object_or_404

from rest_framework import serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import StudentProfile, User
from scheduling.models import LessonSlot, LessonBooking


class LessonSlotSerializer(serializers.ModelSerializer):
    teacher_username = serializers.CharField(source="teacher.user.username", read_only=True)

    class Meta:
        model = LessonSlot
        fields = ["id", "teacher", "teacher_username", "start_datetime", "end_datetime", "is_booked"]


class AvailableSlotsView(APIView):
    """
    GET /api/teachers/<teacher_id>/slots/
    Lists unbooked slots for a given teacher.
    """

    def get(self, request, teacher_id: int):
        qs = LessonSlot.objects.filter(teacher_id=teacher_id, is_booked=False).order_by("start_datetime")
        return Response(LessonSlotSerializer(qs, many=True).data)


class BookSlotSerializer(serializers.Serializer):
    slot_id = serializers.IntegerField()


class BookSlotView(APIView):
    """
    POST /api/bookings/
    Body: { "slot_id": 123 }
    Books slot for the currently authenticated user.
    """

    def post(self, request):
        serializer = BookSlotSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Only STUDENT users can book
        if request.user.role != User.Roles.STUDENT:
            raise ValidationError({"detail": "Only students can book lessons."})

        slot_id = serializer.validated_data["slot_id"]

        slot = get_object_or_404(
            LessonSlot.objects.select_related("teacher__user"),
            id=slot_id,
        )

        if slot.is_booked:
            raise ValidationError({"detail": "This slot is already booked."})

        # Book for the currently logged-in student
        student = get_object_or_404(
            StudentProfile.objects.select_related("user"),
            user=request.user,
        )

        try:
            booking = LessonBooking.objects.create(slot=slot, student=student)
        except IntegrityError:
            # DB safety net (race condition)
            raise ValidationError({"detail": "This slot is already booked."})

        return Response(
            {
                "booking_id": booking.id,
                "slot_id": slot.id,
                "teacher": slot.teacher.user.username,
                "start_datetime": slot.start_datetime,
                "end_datetime": slot.end_datetime,
                "lesson_created": True,
            },
            status=status.HTTP_201_CREATED,
        )
