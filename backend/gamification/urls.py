from django.urls import path
from .api import CoinBalanceView, RewardListView, StudentRewardView

urlpatterns = [
    path('coins/',       CoinBalanceView.as_view(),   name='coin-balance'),
    path('rewards/',     RewardListView.as_view(),     name='reward-list'),
    path('my-rewards/',  StudentRewardView.as_view(),  name='my-rewards'),
]
