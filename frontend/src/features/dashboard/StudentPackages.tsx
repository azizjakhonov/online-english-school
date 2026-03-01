import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Package, CheckCircle, Clock, Zap } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface LessonPackage {
    id: number;
    title: string;
    lessons_count: number;
    price: string;
    currency: string;
    validity_days: number | null;
}

interface StudentPackage {
    id: number;
    package_id: number;
    package_title: string;
    lessons_count: number;
    remaining_lessons: number;
    expires_at: string | null;
    status: 'ACTIVE' | 'EXPIRED' | 'USED';
    status_label: string;
    created_at: string;
}

// ── API helpers ────────────────────────────────────────────────────────────

const fetchPackages = (): Promise<LessonPackage[]> =>
    api.get('/api/payments/lesson-packages/').then(r => r.data);

const fetchMyPackages = (): Promise<StudentPackage[]> =>
    api.get('/api/payments/my-packages/').then(r => r.data);

const buyPackage = (package_id: number) =>
    api.post('/api/payments/my-packages/', { package_id }).then(r => r.data);

// ── Status styles ──────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
    ACTIVE: 'bg-emerald-100 text-emerald-700',
    EXPIRED: 'bg-orange-100 text-orange-700',
    USED: 'bg-gray-100 text-gray-500',
};

export default function StudentPackages() {
    const qc = useQueryClient();
    const [tab, setTab] = useState<'store' | 'mine'>('store');
    const [buyingId, setBuyingId] = useState<number | null>(null);

    const { data: packages = [], isLoading: pkgsLoading } = useQuery({
        queryKey: ['lesson-packages'],
        queryFn: fetchPackages,
    });

    const { data: myPackages = [], isLoading: myLoading } = useQuery({
        queryKey: ['my-packages'],
        queryFn: fetchMyPackages,
    });

    const buyMutation = useMutation({
        mutationFn: (id: number) => buyPackage(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['my-packages'] });
            setBuyingId(null);
            setTab('mine');
        },
        onSettled: () => setBuyingId(null),
    });

    const handleBuy = (id: number) => {
        setBuyingId(id);
        buyMutation.mutate(id);
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-violet-100 rounded-xl">
                    <Package className="w-6 h-6 text-violet-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Lesson Packages</h1>
                    <p className="text-sm text-gray-500">Buy a bundle and save on individual lessons</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
                {(['store', 'mine'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        {t === 'store' ? 'Package Store' : 'My Packages'}
                    </button>
                ))}
            </div>

            {/* Package Store */}
            {tab === 'store' && (
                <>
                    {pkgsLoading ? (
                        <div className="flex justify-center py-16">
                            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : packages.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">No packages available right now.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {packages.map(pkg => (
                                <div key={pkg.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
                                    <div>
                                        <h3 className="font-bold text-gray-900 text-lg">{pkg.title}</h3>
                                        <p className="text-sm text-gray-500 mt-0.5">
                                            {pkg.lessons_count} lessons
                                            {pkg.validity_days ? ` · valid ${pkg.validity_days} days` : ''}
                                        </p>
                                    </div>
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <span className="text-2xl font-extrabold text-violet-600">
                                                {Number(pkg.price).toLocaleString()}
                                            </span>
                                            <span className="text-sm text-gray-400 ml-1">{pkg.currency}</span>
                                        </div>
                                        <button
                                            onClick={() => handleBuy(pkg.id)}
                                            disabled={buyingId === pkg.id}
                                            className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                                        >
                                            <Zap className="w-3.5 h-3.5" />
                                            {buyingId === pkg.id ? 'Buying…' : 'Buy'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {buyMutation.isError && (
                        <p className="mt-4 text-sm text-red-600 text-center">
                            {(buyMutation.error as any)?.response?.data?.error ?? 'Purchase failed.'}
                        </p>
                    )}
                </>
            )}

            {/* My Packages */}
            {tab === 'mine' && (
                <>
                    {myLoading ? (
                        <div className="flex justify-center py-16">
                            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : myPackages.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">You haven't purchased any packages yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {myPackages.map(sp => (
                                <div key={sp.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-gray-900">{sp.package_title}</p>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                                            <span className="flex items-center gap-1">
                                                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                                {sp.remaining_lessons} / {sp.lessons_count} lessons left
                                            </span>
                                            {sp.expires_at && (
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    Expires {new Date(sp.expires_at).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[sp.status]}`}>
                                        {sp.status_label}
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
