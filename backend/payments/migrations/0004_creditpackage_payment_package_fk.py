from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0003_package_studentpackage'),
    ]

    operations = [
        migrations.CreateModel(
            name='CreditPackage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('credits', models.PositiveIntegerField(help_text='Lesson credits the student receives')),
                ('price_uzs', models.DecimalField(decimal_places=0, help_text='Price in UZS', max_digits=14)),
                ('is_active', models.BooleanField(default=True, help_text='Hidden from students when False')),
                ('is_popular', models.BooleanField(default=False, help_text='Show "Popular" badge')),
                ('sort_order', models.PositiveIntegerField(default=0, help_text='Lower = shown first')),
                ('features', models.JSONField(default=list, help_text='List of feature strings shown on card')),
                ('validity_label', models.CharField(blank=True, help_text='Display text only, e.g. "Valid 90 days"', max_length=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Credit Package',
                'verbose_name_plural': 'Credit Packages',
                'ordering': ['sort_order', 'price_uzs'],
            },
        ),
        migrations.AddField(
            model_name='payment',
            name='package',
            field=models.ForeignKey(
                blank=True,
                help_text='Credit package purchased (null for legacy/manual payments)',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='payments',
                to='payments.creditpackage',
            ),
        ),
    ]
