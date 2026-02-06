from django.db import models
from accounts.models import TeacherProfile, StudentProfile
from scheduling.models import LessonBooking


class Lesson(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = "SCHEDULED", "Scheduled"
        COMPLETED = "COMPLETED", "Completed"
        MISSED = "MISSED", "Missed"
        CANCELLED = "CANCELLED", "Cancelled"

    booking = models.OneToOneField(
        LessonBooking,
        on_delete=models.PROTECT,
        related_name="lesson",
    )

    teacher = models.ForeignKey(
        TeacherProfile,
        on_delete=models.PROTECT,
        related_name="lessons",
    )

    student = models.ForeignKey(
        StudentProfile,
        on_delete=models.PROTECT,
        related_name="lessons",
    )

    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField()

    meeting_link = models.URLField(blank=True)
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.SCHEDULED,
    )

    teacher_notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Lesson<{self.student.user.username} with {self.teacher.user.username} @ {self.start_datetime}>"
