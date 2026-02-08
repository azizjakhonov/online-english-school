from django.db import models
from scheduling.models import Lesson  # Import the main Lesson model we created earlier

class LessonContent(models.Model):
    """
    Stores additional content for a lesson, like teacher notes or whiteboard data.
    Linked 1-to-1 with the main Lesson in the scheduling app.
    """
    lesson = models.OneToOneField(Lesson, on_delete=models.CASCADE, related_name='content')
    teacher_notes = models.TextField(blank=True, help_text="Private notes for the teacher")
    whiteboard_data = models.JSONField(default=dict, blank=True, help_text="Canvas data for the whiteboard")
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Content for Lesson #{self.lesson.id}"