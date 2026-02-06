from django.db import models
from lessons.models import Lesson


class Homework(models.Model):
    lesson = models.OneToOneField(
        Lesson,
        on_delete=models.CASCADE,
        related_name="homework",
    )

    task_text = models.TextField()
    attachment = models.FileField(upload_to="homework/tasks/", blank=True, null=True)

    due_date = models.DateTimeField()

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Homework for lesson {self.lesson_id}"
class HomeworkSubmission(models.Model):
    homework = models.OneToOneField(
        Homework,
        on_delete=models.CASCADE,
        related_name="submission",
    )

    answer_text = models.TextField(blank=True)
    file = models.FileField(upload_to="homework/submissions/", blank=True, null=True)

    is_checked = models.BooleanField(default=False)
    teacher_comment = models.TextField(blank=True)

    submitted_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Submission for homework {self.homework_id}"
