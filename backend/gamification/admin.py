from django.contrib import admin
from .models import CoinTransaction, Reward, StudentReward


@admin.register(CoinTransaction)
class CoinTransactionAdmin(admin.ModelAdmin):
    list_display  = ('student', 'amount', 'reason', 'created_at')
    list_filter   = ('created_at',)
    search_fields = ('student__user__phone_number', 'student__user__full_name', 'reason')
    readonly_fields = ('created_at',)
    ordering      = ('-created_at',)


@admin.register(Reward)
class RewardAdmin(admin.ModelAdmin):
    list_display  = ('title', 'cost_in_coins', 'is_active')
    list_filter   = ('is_active',)
    search_fields = ('title',)


@admin.register(StudentReward)
class StudentRewardAdmin(admin.ModelAdmin):
    list_display  = ('student', 'reward', 'status', 'claimed_at')
    list_filter   = ('status', 'claimed_at')
    search_fields = ('student__user__phone_number', 'student__user__full_name', 'reward__title')
    readonly_fields = ('claimed_at',)
    ordering      = ('-claimed_at',)
