from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from scheduling.models import Lesson

class LessonProgress(models.Model):
    """
    Stores detailed feedback/scores for a completed lesson.
    Linked OneToOne with the Lesson model.
    """
    lesson = models.OneToOneField(Lesson, on_delete=models.CASCADE, related_name='progress')
    
    # Scores from 1 to 5
    speaking = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    grammar = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    vocabulary = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    listening = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    
    teacher_feedback = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def average_score(self):
        return (self.speaking + self.grammar + self.vocabulary + self.listening) / 4.0

    def __str__(self):
        return f"Progress for Lesson #{self.lesson.id}"