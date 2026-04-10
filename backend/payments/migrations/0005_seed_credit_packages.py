"""
Data migration: seed the 3 initial credit packages (matching the old hardcoded PACKAGES dict).
After this runs, admins can freely edit/add packages via the marketing dashboard.
"""
from django.db import migrations


INITIAL_PACKAGES = [
    {
        'name': 'Starter',
        'credits': 5,
        'price_uzs': 500000,
        'is_active': True,
        'is_popular': False,
        'sort_order': 1,
        'features': ['Valid for 30 days', 'Basic Support'],
        'validity_label': 'Valid for 30 days',
    },
    {
        'name': 'Standard',
        'credits': 20,
        'price_uzs': 1800000,
        'is_active': True,
        'is_popular': True,
        'sort_order': 2,
        'features': ['Save 10%', 'Valid for 90 days', 'Priority Support'],
        'validity_label': 'Valid for 90 days',
    },
    {
        'name': 'Pro',
        'credits': 50,
        'price_uzs': 4000000,
        'is_active': True,
        'is_popular': False,
        'sort_order': 3,
        'features': ['Save 20%', 'Never Expires', 'VIP Support', 'Free Group Class'],
        'validity_label': '',
    },
]


def seed_packages(apps, schema_editor):
    CreditPackage = apps.get_model('payments', 'CreditPackage')
    if CreditPackage.objects.exists():
        return  # already seeded — skip
    for data in INITIAL_PACKAGES:
        CreditPackage.objects.create(**data)


def unseed_packages(apps, schema_editor):
    CreditPackage = apps.get_model('payments', 'CreditPackage')
    CreditPackage.objects.filter(name__in=['Starter', 'Standard', 'Pro']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0004_creditpackage_payment_package_fk'),
    ]

    operations = [
        migrations.RunPython(seed_packages, reverse_code=unseed_packages),
    ]
