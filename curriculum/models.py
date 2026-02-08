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
    
    # Content
    video_url = models.URLField(blank=True, null=True)
    slides_pdf = models.FileField(upload_to='lessons/pdfs/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.unit.title} - {self.title}"

# --- NEW MODEL ---
class Slide(models.Model):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='slides')
    image = models.ImageField(upload_to='lessons/slides/')
    order = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"Slide {self.order} for {self.lesson.title}"