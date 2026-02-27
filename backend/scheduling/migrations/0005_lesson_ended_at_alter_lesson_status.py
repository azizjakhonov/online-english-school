# Generated manually on 2026-02-19

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('scheduling', '0004_lessontemplate_alter_lesson_status_activity'),
    ]

    operations = [
        migrations.AddField(
            model_name='lesson',
            name='ended_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='lesson',
            name='status',
            field=models.CharField(
                choices=[
                    ('PENDING', 'Pending'),
                    ('CONFIRMED', 'Confirmed'),
                    ('COMPLETED', 'Completed'),
                    ('CANCELLED', 'Cancelled'),
                    ('STUDENT_ABSENT', 'Student Absent'),
                    ('TECHNICAL_ISSUES', 'Technical Issues'),
                ],
                default='PENDING',
                max_length=20,
            ),
        ),
    ]
