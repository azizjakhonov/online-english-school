from django.conf import settings
from django.db import models

class Course(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    level = models.CharField(max_length=50, default='Beginner')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class Unit(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='units')
    title = models.CharField(max_length=200)
    order = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.course.title} - {self.title}"

class Lesson(models.Model):
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name='lessons')
    title = models.CharField(max_length=200)
    order = models.PositiveIntegerField(default=1)
    
    # Optional: General content
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    slides_pdf = models.FileField(upload_to='lessons/pdfs/', blank=True, null=True)
    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.unit.title} - {self.title}"

# --- PDF ASSET (uploaded by teacher, referenced in pdf activities) ─────────────
class PdfAsset(models.Model):
    """
    Stores teacher-uploaded PDF files.
    Referenced by LessonActivity (activity_type='pdf') via content['pdf_id'].
    Download is gated behind JWT auth via /api/curriculum/pdfs/<id>/download/.
    """
    owner      = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='pdf_assets',
    )
    title      = models.CharField(max_length=255, blank=True)
    file       = models.FileField(upload_to='pdfs/')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title or f"PDF #{self.id}"


# --- AUDIO ASSET (uploaded by teacher, referenced in listening activities) ──────
class AudioAsset(models.Model):
    """
    Stores teacher-uploaded Audio files.
    Referenced by LessonActivity (activity_type='listening') via content['audio_id'].
    """
    owner      = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='audio_assets',
    )
    title      = models.CharField(max_length=255, blank=True)
    file       = models.FileField(upload_to='audio/')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title or f"Audio #{self.id}"


# --- VIDEO ASSET (uploaded by teacher, referenced in video activities) ──────
class VideoAsset(models.Model):
    """
    Stores teacher-uploaded Video files.
    Referenced by LessonActivity (activity_type='video') via content['video_id'].
    """
    owner      = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='video_assets',
    )
    title      = models.CharField(max_length=255, blank=True)
    file       = models.FileField(upload_to='videos/')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title or f"Video #{self.id}"


# --- INTERACTIVE ACTIVITIES ---
class LessonActivity(models.Model):
    TYPE_CHOICES = (
        ('image',    'Image Presentation'),
        ('video',    'Video Embed'),
        ('matching', 'Matching Game'),
        ('gap_fill', 'Fill in the Blanks'),
        ('quiz',     'Multiple Choice Quiz'),
        ('pdf',      'PDF Viewer'),
        ('listening','Listening Task'),
    )

    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='activities')
    title = models.CharField(max_length=200, default="New Activity")
    activity_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='image')
    order = models.PositiveIntegerField(default=1)
    
    # Stores the specific data for the game (e.g., pairs for matching, url for video)
    content = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']
        verbose_name_plural = "Lesson Activities"

    def __str__(self):
        return f"{self.activity_type.title()}: {self.title}"


# --- ENROLLMENT SYSTEM ---
class Enrollment(models.Model):
    """
    Tracks which students are enrolled in which courses.
    One enrollment record per (student, course) pair.
    """
    class Status(models.TextChoices):
        ACTIVE    = 'ACTIVE',    'Active'
        COMPLETED = 'COMPLETED', 'Completed'
        DROPPED   = 'DROPPED',   'Dropped'

    student      = models.ForeignKey(
        'accounts.StudentProfile',
        on_delete=models.CASCADE,
        related_name='enrollments',
        db_index=True,
    )
    course       = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='enrollments',
        db_index=True,
    )
    status       = models.CharField(
        max_length=10, choices=Status.choices, default=Status.ACTIVE,
    )
    started_at   = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('student', 'course')]
        verbose_name = 'Enrollment'
        verbose_name_plural = 'Enrollments'
        ordering = ['-created_at']

    def __str__(self):
        return f"Enrollment: {self.student} → {self.course} [{self.status}]"