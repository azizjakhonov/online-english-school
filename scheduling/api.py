from django.db import IntegrityError
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError as DjangoValidationError

from rest_framework import serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import StudentProfile, TeacherProfile, User
from scheduling.models import AvailabilityRule, LessonSlot, LessonBooking

from datetime import datetime, timedelta
from django.utils import timezone

# ============================
# Slots (existing)
# ============================

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


# ============================
# Teacher Availability Rules (Step 1)
# ============================

class AvailabilityRuleSerializer(serializers.ModelSerializer):
    """
    AvailabilityRule serializer.
    Teacher is not writable via API; we attach it from request.user.teacherprofile.
    """

    class Meta:
        model = AvailabilityRule
        fields = ["id", "weekday", "start_time", "end_time", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        """
        Extra validation (DRF-friendly) besides model.clean().
        """
        start = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end = attrs.get("end_time", getattr(self.instance, "end_time", None))

        if start is not None and end is not None and end <= start:
            raise ValidationError({"end_time": "end_time must be after start_time."})

        return attrs


def _raise_drf_validation_from_django(e: DjangoValidationError) -> None:
    """
    Converts Django's ValidationError into DRF ValidationError (HTTP 400).
    Prevents server 500 when model.full_clean() fails.
    """
    if hasattr(e, "message_dict"):
        raise ValidationError(e.message_dict)
    raise ValidationError({"detail": e.messages})


class AvailabilityRulesView(APIView):
    """
    GET /api/availability-rules/
        List the authenticated teacher's availability rules.

    POST /api/availability-rules/
        Create a new availability rule for the authenticated teacher.
    """

    permission_classes = [IsAuthenticated]

    def get_teacher_profile(self, request) -> TeacherProfile:
        """
        Returns TeacherProfile for request.user (teacher only).
        """
        if request.user.role != User.Roles.TEACHER:
            raise ValidationError({"detail": "Only teachers can manage availability rules."})

        return get_object_or_404(
            TeacherProfile.objects.select_related("user"),
            user=request.user,
        )

    def get(self, request):
        teacher_profile = self.get_teacher_profile(request)
        qs = AvailabilityRule.objects.filter(teacher=teacher_profile).order_by("weekday", "start_time")
        return Response(AvailabilityRuleSerializer(qs, many=True).data)

    def post(self, request):
        teacher_profile = self.get_teacher_profile(request)

        serializer = AvailabilityRuleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Create the rule for this teacher only
        rule = AvailabilityRule(
            teacher=teacher_profile,
            **serializer.validated_data,
        )

        # IMPORTANT: full_clean() triggers model.clean() (overlap + time checks)
        try:
            rule.full_clean()
        except DjangoValidationError as e:
            _raise_drf_validation_from_django(e)

        rule.save()

        return Response(AvailabilityRuleSerializer(rule).data, status=status.HTTP_201_CREATED)


class AvailabilityRuleDetailView(APIView):
    """
    GET /api/availability-rules/<rule_id>/
        Retrieve a specific rule (must belong to the authenticated teacher)

    PATCH /api/availability-rules/<rule_id>/
        Update a specific rule (must belong to the authenticated teacher)

    DELETE /api/availability-rules/<rule_id>/
        Delete a specific rule (must belong to the authenticated teacher)
    """

    permission_classes = [IsAuthenticated]

    def get_object(self, request, rule_id: int) -> AvailabilityRule:
        """
        Ownership guard: teacher can only access their own rules.
        """
        if request.user.role != User.Roles.TEACHER:
            raise ValidationError({"detail": "Only teachers can manage availability rules."})

        teacher_profile = get_object_or_404(
            TeacherProfile.objects.select_related("user"),
            user=request.user,
        )

        return get_object_or_404(
            AvailabilityRule.objects.select_related("teacher__user"),
            id=rule_id,
            teacher=teacher_profile,
        )

    def get(self, request, rule_id: int):
        rule = self.get_object(request, rule_id)
        return Response(AvailabilityRuleSerializer(rule).data)

    def patch(self, request, rule_id: int):
        rule = self.get_object(request, rule_id)

        serializer = AvailabilityRuleSerializer(rule, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        # Apply updates
        for attr, value in serializer.validated_data.items():
            setattr(rule, attr, value)

        # Validate with model.clean() to prevent overlaps + invalid times
        try:
            rule.full_clean()
        except DjangoValidationError as e:
            _raise_drf_validation_from_django(e)

        rule.save()

        return Response(AvailabilityRuleSerializer(rule).data)

    def delete(self, request, rule_id: int):
        rule = self.get_object(request, rule_id)
        rule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

# ============================
# Slot regeneration (Step 2)
# ============================

class RegenerateSlotsSerializer(serializers.Serializer):
    """
    Optional inputs:
    - days: how many days ahead to generate slots (default 14)
    - slot_minutes: lesson slot length in minutes (default 60)
    """
    days = serializers.IntegerField(required=False, default=14, min_value=1, max_value=90)
    slot_minutes = serializers.IntegerField(required=False, default=60, min_value=15, max_value=240)


class RegenerateMySlotsView(APIView):
    """
    POST /api/slots/regenerate/
    Body (optional): { "days": 14, "slot_minutes": 60 }

    Generates LessonSlot rows from active AvailabilityRule for the authenticated teacher only.

    Safety guarantees:
    - Does NOT delete or modify existing slots
    - Does NOT touch booked slots
    - Uses get_or_create to avoid duplicates
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Teacher only
        if request.user.role != User.Roles.TEACHER:
            raise ValidationError({"detail": "Only teachers can regenerate slots."})

        teacher = get_object_or_404(
            TeacherProfile.objects.select_related("user"),
            user=request.user,
        )

        payload = RegenerateSlotsSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        days = payload.validated_data["days"]
        slot_minutes = payload.validated_data["slot_minutes"]

        now = timezone.now()
        start_date = now.date()
        end_date = start_date + timedelta(days=days)

        rules = AvailabilityRule.objects.filter(teacher=teacher, is_active=True)
        rules_count = rules.count()

        if rules_count == 0:
            return Response(
                {
                    "detail": "No active availability rules found. Nothing to generate.",
                    "created": 0,
                    "skipped_existing": 0,
                    "rules_used": 0,
                    "start_date": str(start_date),
                    "end_date": str(end_date),
                    "slot_minutes": slot_minutes,
                }
            )

        created_count = 0
        skipped_existing = 0

        current = start_date
        while current <= end_date:
            weekday = current.weekday()  # Monday=0

            day_rules = rules.filter(weekday=weekday)
            for rule in day_rules:
                start_dt = timezone.make_aware(datetime.combine(current, rule.start_time))
                end_dt = timezone.make_aware(datetime.combine(current, rule.end_time))

                # Skip if the whole window is in the past
                if end_dt <= now:
                    continue

                slot_start = start_dt
                while slot_start + timedelta(minutes=slot_minutes) <= end_dt:
                    slot_end = slot_start + timedelta(minutes=slot_minutes)

                    # Do not create past slots
                    if slot_end <= now:
                        slot_start = slot_end
                        continue

                    obj, created = LessonSlot.objects.get_or_create(
                        teacher=teacher,
                        start_datetime=slot_start,
                        defaults={"end_datetime": slot_end},
                    )

                    if created:
                        created_count += 1
                    else:
                        skipped_existing += 1

                    slot_start = slot_end

            current += timedelta(days=1)

        return Response(
            {
                "detail": "Slot regeneration completed.",
                "created": created_count,
                "skipped_existing": skipped_existing,
                "rules_used": rules_count,
                "start_date": str(start_date),
                "end_date": str(end_date),
                "slot_minutes": slot_minutes,
                "teacher": teacher.user.username,
            },
            status=status.HTTP_200_OK,
        )
