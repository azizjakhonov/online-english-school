from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('marketing', '0003_alter_banner_cta_url_image_url_to_charfield'),
    ]

    operations = [
        migrations.AddField(
            model_name='banner',
            name='is_archived',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='announcement',
            name='is_archived',
            field=models.BooleanField(default=False),
        ),
    ]
