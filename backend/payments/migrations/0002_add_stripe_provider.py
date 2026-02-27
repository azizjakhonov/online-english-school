from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='payment',
            name='provider',
            field=models.CharField(
                choices=[
                    ('click',   'Click'),
                    ('payme',   'Payme'),
                    ('apelsin', 'Apelsin'),
                    ('stripe',  'Stripe'),
                    ('manual',  'Manual'),
                    ('test',    'Test (Demo)'),
                ],
                default='test',
                max_length=20,
            ),
        ),
    ]
