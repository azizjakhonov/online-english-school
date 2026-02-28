from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone
import uuid


class Availability(models.Model):
    """
    Stores the weekly recurring schedule for a teacher.
    Example: Teacher is available Mondays from 09:00 to 12:00.
    """
    DAYS = [
        (0, 'Monday'),
        (1, 'Tuesday'),
        (2, 'Wednesday'),
        (3, 'Thursday'),
        (4, 'Friday'),
        (5, 'Saturday'),
        (6, 'Sunday'),
    ]

    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='availabilities'
    )
    day_of_week = models.IntegerField(choices=DAYS)
    start_time = models.TimeField()
    end_time = models.TimeField()

    class Meta:
        ordering = ['day_of_week', 'start_time']
        verbose_name_plural = "Availabilities"

    def clean(self):
        if self.end_time <= self.start_time:
            raise ValidationError("End time must be after start time")

    def __str__(self):
        return f"{self.teacher} - {self.get_day_of_week_display()} ({self.start_time}-{self.end_time})"


class Lesson(models.Model):
    """
    Represents a specific booked lesson between a student and a teacher.
    """
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('CONFIRMED', 'Confirmed'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
        ('STUDENT_ABSENT', 'Student Absent'),
        ('TECHNICAL_ISSUES', 'Technical Issues'),
    ]

    room_sid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)

    availability_slot = models.ForeignKey(
        Availability,
        on_delete=models.SET_NULL,
        null=True,
        related_name='scheduled_lessons'
    )
    lesson_date = models.DateField(null=True, blank=True)
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='teaching_lessons'
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='learning_lessons'
    )

    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    meeting_link = models.URLField(blank=True, null=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # --- OPERATIONS TRACKING ---
    credits_consumed = models.BooleanField(
        default=False,
        help_text='True when a student credit was deducted for this lesson'
    )
    credits_reserved = models.BooleanField(
        default=False,
        help_text='True when a credit hold has been placed at booking time'
    )
    no_show_reason = models.CharField(
        max_length=255, blank=True,
        help_text='Reason recorded when student was absent or lesson cancelled'
    )

    # --- LIVE CLASSROOM PRESENCE TRACKING ---
    active_students_count = models.IntegerField(
        default=0,
        help_text='Number of students currently present in the live classroom session'
    )
    active_teacher = models.BooleanField(
        default=False,
        help_text='True while the assigned teacher is connected in the live classroom'
    )
    room_empty_since = models.DateTimeField(null=True, blank=True)
    session_ended_at = models.DateTimeField(null=True, blank=True)
    teacher_joined_at = models.DateTimeField(null=True, blank=True)
    teacher_left_at = models.DateTimeField(null=True, blank=True)
    class Meta:
        ordering = ['start_time']
        constraints = [
            models.UniqueConstraint(
                fields=['availability_slot', 'lesson_date'],
                name='unique_booking_per_slot_date',
                condition=~models.Q(status='CANCELLED')
            )
        ]

    def clean(self):
        if self.end_time <= self.start_time:
            raise ValidationError("End time must be after start time")

        # Only block NEW lesson creation in the past; allow editing existing records.
        if self.pk is None and self.start_time < timezone.now():
            raise ValidationError("Cannot book a lesson in the past")

        if self.availability_slot and self.lesson_date is not None:
            if self.lesson_date.weekday() != self.availability_slot.day_of_week:
                raise ValidationError(
                    "The chosen date does not match the day of the week for this availability slot."
                )

    def __str__(self):
        return f"Lesson: {self.student} with {self.teacher} on {self.lesson_date}"


class LessonWrapUp(models.Model):
    """
    Teacher-authored wrap-up saved when exiting the classroom.
    OneToOne so it can be safely upserted without duplication.
    """
    lesson = models.OneToOneField(
        Lesson,
        on_delete=models.CASCADE,
        related_name='wrap_up',
    )
    teacher_notes = models.TextField(blank=True, default='')
    homework_text = models.TextField(blank=True, default='')
    homework_due_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'WrapUp #{self.pk} for Lesson #{self.lesson_id}'


class LessonRating(models.Model):
    """
    Post-lesson rating submitted by the student. OneToOne with Lesson.
    Validated: lesson must be COMPLETED, student must be the lesson's student.
    """
    lesson = models.OneToOneField(
        Lesson,
        on_delete=models.CASCADE,
        related_name='rating',
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ratings_given',
    )
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ratings_received',
    )
    rating = models.PositiveSmallIntegerField(
        help_text='Rating from 1 to 5',
    )
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Lesson Rating'
        verbose_name_plural = 'Lesson Ratings'

    def clean(self):
        if not (1 <= self.rating <= 5):
            raise ValidationError('Rating must be between 1 and 5.')

    def __str__(self):
        return f"Rating #{self.pk}: {self.rating}★ for Lesson #{self.lesson_id}"


class LessonTemplate(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class Activity(models.Model):
    ACTIVITY_TYPES = [
        ('image', 'Image'),
        ('video', 'Video'),
        ('matching', 'Matching Game'),
        ('gap_fill', 'Gap Fill'),
        ('quiz', 'Quiz'),
    ]

    lesson_template = models.ForeignKey(LessonTemplate, on_delete=models.CASCADE, related_name='activities')
    title = models.CharField(max_length=200)
    activity_type = models.CharField(max_length=50, choices=ACTIVITY_TYPES)
    order = models.IntegerField(default=0)
    content = models.JSONField(default=dict)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.title} ({self.activity_type})"

