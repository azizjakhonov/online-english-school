from django.db import models


class CoinTransaction(models.Model):
    """
    Immutable ledger of every coin balance change for a student.
    Positive amount = coins earned; negative = coins spent.
    Completely separate from the credit system in the accounts app.
    """
    student    = models.ForeignKey(
        'accounts.StudentProfile',
        on_delete=models.CASCADE,
        related_name='coin_transactions',
        db_index=True,
    )
    amount     = models.IntegerField(
        help_text='Positive = earned, negative = spent'
    )
    reason     = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Coin Transaction'
        verbose_name_plural = 'Coin Transactions'

    def __str__(self):
        sign = '+' if self.amount >= 0 else ''
        return f"{self.student} | {sign}{self.amount} coins | {self.reason[:40]}"


class Reward(models.Model):
    """
    A reward item that students can claim using their coins.
    """
    title         = models.CharField(max_length=200)
    description   = models.TextField(blank=True)
    cost_in_coins = models.PositiveIntegerField()
    is_active     = models.BooleanField(
        default=True,
        help_text='Only active rewards are visible to students',
    )

    class Meta:
        verbose_name = 'Reward'
        verbose_name_plural = 'Rewards'
        ordering = ['cost_in_coins']

    def __str__(self):
        return f"{self.title} ({self.cost_in_coins} coins)"


class StudentReward(models.Model):
    """
    Records a student's claim of a Reward.
    Tracks the admin approval / fulfilment workflow.
    """
    class Status(models.TextChoices):
        CLAIMED  = 'CLAIMED',  'Claimed'
        APPROVED = 'APPROVED', 'Approved'
        SHIPPED  = 'SHIPPED',  'Shipped'

    student    = models.ForeignKey(
        'accounts.StudentProfile',
        on_delete=models.CASCADE,
        related_name='student_rewards',
    )
    reward     = models.ForeignKey(
        Reward,
        on_delete=models.PROTECT,
        related_name='student_rewards',
    )
    status     = models.CharField(
        max_length=10, choices=Status.choices, default=Status.CLAIMED,
    )
    claimed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-claimed_at']
        verbose_name = 'Student Reward'
        verbose_name_plural = 'Student Rewards'

    def __str__(self):
        return f"{self.student} claimed '{self.reward.title}' [{self.status}]"
