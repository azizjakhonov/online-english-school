import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Coins, Gift, ShoppingBag, CheckCircle, Truck, Clock } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface CoinTransaction {
    id: number;
    amount: number;
    reason: string;
    created_at: string;
}

interface CoinData {
    balance: number;
    transactions: CoinTransaction[];
}

interface Reward {
    id: number;
    title: string;
    description: string;
    cost_in_coins: number;
    is_active: boolean;
}

interface StudentReward {
    id: number;
    reward: Reward;
    status: 'CLAIMED' | 'APPROVED' | 'SHIPPED';
    status_label: string;
    created_at: string;
}

// ── API helpers ────────────────────────────────────────────────────────────

const fetchCoins = (): Promise<CoinData> =>
    api.get('/api/gamification/coins/').then(r => r.data);

const fetchRewards = (): Promise<Reward[]> =>
    api.get('/api/gamification/rewards/').then(r => r.data);

const fetchMyRewards = (): Promise<StudentReward[]> =>
    api.get('/api/gamification/my-rewards/').then(r => r.data);

const claimReward = (reward_id: number) =>
    api.post('/api/gamification/my-rewards/', { reward_id }).then(r => r.data);

// ── Sub-components ─────────────────────────────────────────────────────────

const CLAIM_STATUS_STYLES: Record<string, string> = {
    CLAIMED: 'bg-amber-100 text-amber-700',
    APPROVED: 'bg-blue-100 text-blue-700',
    SHIPPED: 'bg-emerald-100 text-emerald-700',
};

const CLAIM_STATUS_ICONS: Record<string, React.ReactNode> = {
    CLAIMED: <Clock className="w-3.5 h-3.5" />,
    APPROVED: <CheckCircle className="w-3.5 h-3.5" />,
    SHIPPED: <Truck className="w-3.5 h-3.5" />,
};

// ── Main Component ─────────────────────────────────────────────────────────

type Tab = 'balance' | 'store' | 'claims';

import { usePageTitle } from '../../lib/usePageTitle';

export default function StudentCoins() {
    usePageTitle('My Coins');
    const qc = useQueryClient();
    const [tab, setTab] = useState<Tab>('balance');
    const [claimingId, setClaimingId] = useState<number | null>(null);

    const { data: coinData, isLoading: coinsLoading } = useQuery({
        queryKey: ['coins'],
        queryFn: fetchCoins,
    });

    const { data: rewards = [], isLoading: rewardsLoading } = useQuery({
        queryKey: ['rewards'],
        queryFn: fetchRewards,
        enabled: tab === 'store',
    });

    const { data: myRewards = [], isLoading: myRewardsLoading } = useQuery({
        queryKey: ['my-rewards'],
        queryFn: fetchMyRewards,
        enabled: tab === 'claims',
    });

    const claimMutation = useMutation({
        mutationFn: (rewardId: number) => claimReward(rewardId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['coins'] });
            qc.invalidateQueries({ queryKey: ['my-rewards'] });
            setClaimingId(null);
            setTab('claims');
        },
        onSettled: () => setClaimingId(null),
    });

    const handleClaim = (rewardId: number) => {
        setClaimingId(rewardId);
        claimMutation.mutate(rewardId);
    };

    const balance = coinData?.balance ?? 0;
    const transactions = coinData?.transactions ?? [];

    const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
        { key: 'balance', label: 'My Coins', icon: <Coins className="w-4 h-4" /> },
        { key: 'store', label: 'Rewards Store', icon: <Gift className="w-4 h-4" /> },
        { key: 'claims', label: 'My Claims', icon: <ShoppingBag className="w-4 h-4" /> },
    ];

    return (
        <div className="max-w-3xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-amber-100 rounded-xl">
                    <Coins className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Coins & Rewards</h1>
                    <p className="text-sm text-gray-500">Earn coins and claim exclusive rewards</p>
                </div>
            </div>

            {/* Coin balance card */}
            <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl p-6 mb-6 text-white shadow-lg">
                <p className="text-sm font-medium opacity-80 mb-1">Your Balance</p>
                {coinsLoading ? (
                    <div className="h-10 w-24 bg-white/20 rounded animate-pulse" />
                ) : (
                    <div className="flex items-center gap-2">
                        <Coins className="w-8 h-8" />
                        <span className="text-4xl font-black">{balance.toLocaleString()}</span>
                        <span className="text-lg opacity-70">coins</span>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        {t.icon}
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Balance / Transaction history */}
            {tab === 'balance' && (
                <>
                    {coinsLoading ? (
                        <div className="flex justify-center py-16">
                            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <Coins className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">No coin transactions yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {transactions.map(tx => (
                                <div key={tx.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${tx.amount > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'
                                        }`}>
                                        {tx.amount > 0 ? '+' : '−'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-gray-700 truncate">{tx.reason}</p>
                                        <p className="text-xs text-gray-400">{new Date(tx.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <span className={`font-bold text-sm ${tx.amount > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Rewards Store */}
            {tab === 'store' && (
                <>
                    {rewardsLoading ? (
                        <div className="flex justify-center py-16">
                            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : rewards.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <Gift className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">No rewards available right now.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {rewards.map(r => {
                                const canAfford = balance >= r.cost_in_coins;
                                return (
                                    <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
                                        <div>
                                            <h3 className="font-bold text-gray-900">{r.title}</h3>
                                            <p className="text-xs text-gray-500 mt-1">{r.description}</p>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1 text-amber-600 font-bold">
                                                <Coins className="w-4 h-4" />
                                                {r.cost_in_coins.toLocaleString()}
                                            </div>
                                            <button
                                                onClick={() => handleClaim(r.id)}
                                                disabled={!canAfford || claimingId === r.id}
                                                title={!canAfford ? 'Not enough coins' : undefined}
                                                className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                            >
                                                {claimingId === r.id ? 'Claiming…' : 'Claim'}
                                            </button>
                                        </div>
                                        {!canAfford && (
                                            <p className="text-xs text-red-400">
                                                Need {(r.cost_in_coins - balance).toLocaleString()} more coins
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {claimMutation.isError && (
                        <p className="mt-4 text-sm text-red-600 text-center">
                            {(claimMutation.error as any)?.response?.data?.error ?? 'Claim failed.'}
                        </p>
                    )}
                </>
            )}

            {/* My Claims */}
            {tab === 'claims' && (
                <>
                    {myRewardsLoading ? (
                        <div className="flex justify-center py-16">
                            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : myRewards.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">You haven't claimed any rewards yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {myRewards.map(sr => (
                                <div key={sr.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-gray-900">{sr.reward.title}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            Claimed {new Date(sr.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${CLAIM_STATUS_STYLES[sr.status]}`}>
                                        {CLAIM_STATUS_ICONS[sr.status]}
                                        {sr.status_label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
