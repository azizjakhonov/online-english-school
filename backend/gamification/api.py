"""
gamification/api.py
REST endpoints for the Coin / Gamification system.

Endpoints:
  GET  /api/gamification/coins/           — student's coin balance + transaction history
  GET  /api/gamification/rewards/         — active rewards catalogue
  GET  /api/gamification/my-rewards/      — student's claimed rewards
  POST /api/gamification/my-rewards/      — claim a reward
"""

from rest_framework import serializers, generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum
from django.shortcuts import get_object_or_404

from .models import CoinTransaction, Reward, StudentReward


# ─── Serializers ─────────────────────────────────────────────────────────────

class CoinTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CoinTransaction
        fields = ['id', 'amount', 'reason', 'created_at']
        read_only_fields = fields


class RewardSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Reward
        fields = ['id', 'title', 'description', 'cost_in_coins', 'is_active', 'created_at']
        read_only_fields = fields


class StudentRewardSerializer(serializers.ModelSerializer):
    reward = RewardSerializer(read_only=True)
    reward_id = serializers.PrimaryKeyRelatedField(
        queryset=Reward.objects.filter(is_active=True),
        source='reward',
        write_only=True,
    )
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model  = StudentReward
        fields = ['id', 'reward', 'reward_id', 'status', 'status_display', 'created_at']
        read_only_fields = ['id', 'status', 'status_display', 'created_at']


# ─── Views ────────────────────────────────────────────────────────────────────

class CoinBalanceView(APIView):
    """
    GET /api/gamification/coins/
    Returns the student's current coin balance and full transaction history.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not hasattr(user, 'student_profile'):
            return Response({'error': 'Only students can access coins.'}, status=403)

        profile = user.student_profile
        transactions = CoinTransaction.objects.filter(student=profile).order_by('-created_at')
        balance = transactions.aggregate(total=Sum('amount'))['total'] or 0

        return Response({
            'balance': balance,
            'transactions': CoinTransactionSerializer(transactions, many=True).data,
        })


class RewardListView(generics.ListAPIView):
    """
    GET /api/gamification/rewards/
    Lists all active rewards in the catalogue.
    """
    serializer_class   = RewardSerializer
    permission_classes = [IsAuthenticated]
    queryset = Reward.objects.filter(is_active=True).order_by('cost_in_coins')


class StudentRewardView(APIView):
    """
    GET  /api/gamification/my-rewards/  — list current student's claimed rewards
    POST /api/gamification/my-rewards/  — claim a reward (body: { "reward_id": <id> })
    """
    permission_classes = [IsAuthenticated]

    def _get_profile(self, user):
        if not hasattr(user, 'student_profile'):
            return None, Response({'error': 'Only students can claim rewards.'}, status=403)
        return user.student_profile, None

    def get(self, request):
        profile, err = self._get_profile(request.user)
        if err:
            return err
        claims = StudentReward.objects.filter(student=profile).select_related('reward').order_by('-created_at')
        return Response(StudentRewardSerializer(claims, many=True).data)

    def post(self, request):
        profile, err = self._get_profile(request.user)
        if err:
            return err

        serializer = StudentRewardSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reward = serializer.validated_data['reward']

        # Check coin balance
        balance = CoinTransaction.objects.filter(student=profile).aggregate(
            total=Sum('amount')
        )['total'] or 0

        if balance < reward.cost_in_coins:
            return Response(
                {'error': f'Not enough coins. You have {balance}, need {reward.cost_in_coins}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Deduct coins + create claim
        from django.db import transaction as db_tx
        with db_tx.atomic():
            CoinTransaction.objects.create(
                student=profile,
                amount=-reward.cost_in_coins,
                reason=f'Claimed reward: {reward.title}',
            )
            claim = StudentReward.objects.create(student=profile, reward=reward)

        return Response(StudentRewardSerializer(claim).data, status=status.HTTP_201_CREATED)
