from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.conf import settings

from accounts.models import TeacherProfile, StudentProfile


class AvailabilityRule(models.Model):
    class Weekdays(models.IntegerChoices):
        MONDAY = 0, "Monday"
        TUESDAY = 1, "Tuesday"
        WEDNESDAY = 2, "Wednesday"
        THURSDAY = 3, "Thursday"
        FRIDAY = 4, "Friday"
        SATURDAY = 5, "Saturday"
        SUNDAY = 6, "Sunday"

    teacher = models.ForeignKey(
        TeacherProfile,
        on_delete=models.CASCADE,
        related_name="availability_rules",
    )

    weekday = models.IntegerField(choices=Weekdays.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["teacher", "weekday", "start_time"]
        unique_together = ("teacher", "weekday", "start_time", "end_time")

    def clean(self):
        if self.end_time <= self.start_time:
            raise ValidationError("end_time must be after start_time")

    def __str__(self):
        return (
            f"{self.teacher.user.username} "
            f"{self.get_weekday_display()} {self.start_time}-{self.end_time}"
        )


class LessonSlot(models.Model):
    teacher = models.ForeignKey(
        TeacherProfile,
        on_delete=models.CASCADE,
        related_name="lesson_slots",
    )

    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField()

    is_booked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["start_datetime"]
        unique_together = ("teacher", "start_datetime")

    def clean(self):
        if self.end_datetime <= self.start_datetime:
            raise ValidationError("end_datetime must be after start_datetime")

        if self.start_datetime < timezone.now():
            raise ValidationError("Cannot create slot in the past")

    def __str__(self):
        return f"{self.teacher.user.username} {self.start_datetime}"


class LessonBooking(models.Model):
    slot = models.OneToOneField(
        LessonSlot,
        on_delete=models.PROTECT,
        related_name="booking",
    )

    student = models.ForeignKey(
        StudentProfile,
        on_delete=models.CASCADE,
        related_name="bookings",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def clean(self):
        # Extra guard (DB also protects via OneToOne on slot)
        if self.slot.is_booked:
            raise ValidationError("This slot is already booked.")

    def save(self, *args, **kwargs):
        creating = self.pk is None
        super().save(*args, **kwargs)

        # Mark slot booked after booking is created
        if creating and not self.slot.is_booked:
            self.slot.is_booked = True
            self.slot.save(update_fields=["is_booked"])

        # Auto-create Lesson once per booking
        if creating:
            from lessons.models import Lesson  # local import avoids circular imports

            Lesson.objects.get_or_create(
                booking=self,
                defaults={
                    "teacher": self.slot.teacher,
                    "student": self.student,
                    "start_datetime": self.slot.start_datetime,
                    "end_datetime": self.slot.end_datetime,
                },
            )

    def __str__(self):
        return (
            f"Booking<{self.student.user.username} -> "
            f"{self.slot.teacher.user.username} @ {self.slot.start_datetime}>"
        )
