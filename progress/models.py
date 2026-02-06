from django.db import models
from lessons.models import Lesson


class LessonProgress(models.Model):
    lesson = models.OneToOneField(
        Lesson,
        on_delete=models.CASCADE,
        related_name="progress",
    )

    class Score(models.IntegerChoices):
        VERY_BAD = 1, "Very bad"
        BAD = 2, "Bad"
        OK = 3, "OK"
        GOOD = 4, "Good"
        EXCELLENT = 5, "Excellent"

    speaking = models.IntegerField(choices=Score.choices)
    grammar = models.IntegerField(choices=Score.choices)
    vocabulary = models.IntegerField(choices=Score.choices)
    listening = models.IntegerField(choices=Score.choices)

    teacher_feedback = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def average_score(self):
        return (self.speaking + self.grammar + self.vocabulary + self.listening) / 4

    def __str__(self):
        return f"Progress for lesson {self.lesson_id}"
