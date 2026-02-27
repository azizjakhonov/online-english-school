"""
Migration 0006 — Additive changes for PDF activity support.
  1. New PdfAsset model (owner FK, title, file, created_at)
  2. Extends LessonActivity.activity_type choices with ('pdf', 'PDF Viewer')
"""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('curriculum', '0005_lesson_slides_pdf'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 1. New PdfAsset table
        migrations.CreateModel(
            name='PdfAsset',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True,
                                           serialize=False, verbose_name='ID')),
                ('title', models.CharField(blank=True, max_length=255)),
                ('file', models.FileField(upload_to='pdfs/')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('owner', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='pdf_assets',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
        ),
        # 2. Extend choices (CharField — no DB-level constraint, safe to alter)
        migrations.AlterField(
            model_name='lessonactivity',
            name='activity_type',
            field=models.CharField(
                choices=[
                    ('image',    'Image Presentation'),
                    ('video',    'Video Embed'),
                    ('matching', 'Matching Game'),
                    ('gap_fill', 'Fill in the Blanks'),
                    ('quiz',     'Multiple Choice Quiz'),
                    ('pdf',      'PDF Viewer'),
                ],
                default='image',
                max_length=20,
            ),
        ),
    ]
