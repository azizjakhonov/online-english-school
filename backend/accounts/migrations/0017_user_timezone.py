"""
Migration: add timezone field to accounts.User.

Existing rows default to 'Asia/Tashkent' (the business timezone).
No data migration required — the column default handles everything.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0016_add_activityevent'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='timezone',
            field=models.CharField(
                blank=True,
                default='Asia/Tashkent',
                help_text='IANA timezone name, e.g. Asia/Tashkent',
                max_length=64,
            ),
        ),
    ]
