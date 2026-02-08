from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone

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
    ]

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
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    meeting_link = models.URLField(blank=True, null=True)
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['start_time']

    def clean(self):
        if self.end_time <= self.start_time:
            raise ValidationError("End time must be after start time")
        
        # Prevent booking in the past
        if self.start_time < timezone.now():
            raise ValidationError("Cannot book a lesson in the past")

    def __str__(self):
        return f"Lesson: {self.student} with {self.teacher} on {self.start_time.strftime('%Y-%m-%d %H:%M')}"