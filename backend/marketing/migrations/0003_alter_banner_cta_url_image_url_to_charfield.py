from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('marketing', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='banner',
            name='cta_url',
            field=models.CharField(blank=True, max_length=500),
        ),
        migrations.AlterField(
            model_name='banner',
            name='image_url',
            field=models.CharField(blank=True, max_length=500),
        ),
    ]
