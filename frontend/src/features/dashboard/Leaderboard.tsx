import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Globe, Loader2, Trophy, User, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';

interface LeaderboardEntry {
    student_id: number;
    student_name: string;
    total_xp: number;
    tasks_done: number;
}

type Period = 'weekly' | 'monthly' | 'all_time';

import { usePageTitle } from '../../lib/usePageTitle';

export default function Leaderboard() {
    usePageTitle('Leaderboard');
    const navigate = useNavigate();
    const [data, setData] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<Period>('weekly');

    const currentUserId = useMemo(() => {
        const stored = localStorage.getItem('user');
        if (!stored) return null;
        try {
            return JSON.parse(stored).id as number;
        } catch {
            return null;
        }
    }, []);

    const fetchLeaderboard = useCallback(async (selectedPeriod: Period) => {
        setLoading(true);
        try {
            const res = await api.get(`/api/homework/leaderboard/?period=${selectedPeriod}`);
            setData(res.data as LeaderboardEntry[]);
        } catch (error) {
            console.error('Leaderboard error:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchLeaderboard(period);
    }, [period, fetchLeaderboard]);

    const topThree = data.slice(0, 3);
    const rest = data.slice(3);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
                <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="rounded-xl bg-slate-100 p-2 text-slate-600 transition-colors hover:bg-slate-200"
                            title="Back to dashboard"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div className="rounded-xl bg-blue-100 p-2.5 text-blue-600">
                            <Trophy size={20} />
                        </div>
                        <div>
                            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Student Leaderboard</h1>
                            <p className="text-xs font-medium text-slate-500">Compete, complete tasks, and earn XP rewards</p>
                        </div>
                    </div>

                    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                        {(['weekly', 'monthly', 'all_time'] as Period[]).map((item) => (
                            <button
                                key={item}
                                onClick={() => setPeriod(item)}
                                className={`rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${period === item ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                                    }`}
                            >
                                {item.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                    </div>
                ) : (
                    <>
                        <section className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3">
                            {topThree.map((entry, index) => {
                                const isMe = entry.student_id === currentUserId;
                                const isFirst = index === 0;
                                return (
                                    <article
                                        key={entry.student_id}
                                        className={`relative rounded-2xl border p-6 text-center shadow-sm ${isFirst ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white'
                                            } ${isMe ? 'ring-2 ring-blue-600/40' : ''}`}
                                    >
                                        <span
                                            className={`absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${isFirst
                                                    ? 'bg-amber-300 text-slate-900'
                                                    : index === 1
                                                        ? 'bg-slate-200 text-slate-600'
                                                        : 'bg-orange-100 text-orange-700'
                                                }`}
                                        >
                                            {index + 1} place
                                        </span>

                                        <div
                                            className={`mx-auto mb-4 mt-3 inline-flex h-16 w-16 items-center justify-center rounded-full border-2 ${isFirst ? 'border-amber-300/40 bg-slate-800 text-amber-300' : 'border-slate-200 bg-slate-50 text-slate-400'
                                                }`}
                                        >
                                            <User size={28} />
                                        </div>

                                        <h3 className="line-clamp-1 text-base font-extrabold">
                                            {entry.student_name} {isMe ? '(You)' : ''}
                                        </h3>

                                        <div
                                            className={`mt-2 inline-flex items-center gap-1 text-2xl font-extrabold ${isFirst ? 'text-amber-300' : 'text-blue-600'
                                                }`}
                                        >
                                            <Zap size={20} fill="currentColor" />
                                            {entry.total_xp}
                                        </div>

                                        <p className={`mt-1 text-xs font-semibold uppercase tracking-wide ${isFirst ? 'text-slate-300' : 'text-slate-500'}`}>
                                            {entry.tasks_done} tasks
                                        </p>
                                    </article>
                                );
                            })}
                        </section>

                        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="border-b border-slate-100 px-6 py-4">
                                <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">Full Rankings</h2>
                                <p className="mt-0.5 text-xs font-medium text-slate-500">All active learners in your selected period.</p>
                            </div>

                            {rest.length === 0 ? (
                                <div className="p-14 text-center">
                                    <Globe size={42} className="mx-auto mb-3 text-slate-300" />
                                    <h3 className="text-base font-bold text-slate-900">Not enough entries yet</h3>
                                    <p className="mt-1 text-sm text-slate-500">Complete more homework to populate rankings.</p>
                                </div>
                            ) : (
                                <div className="space-y-2 p-4">
                                    {rest.map((entry, index) => {
                                        const isMe = entry.student_id === currentUserId;
                                        return (
                                            <article
                                                key={entry.student_id}
                                                className={`flex items-center justify-between rounded-xl border px-4 py-3 ${isMe ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white hover:bg-slate-50'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <span className={`w-8 text-center text-sm font-extrabold ${isMe ? 'text-blue-100' : 'text-slate-400'}`}>
                                                        #{index + 4}
                                                    </span>
                                                    <span
                                                        className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${isMe ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'
                                                            }`}
                                                    >
                                                        <User size={16} />
                                                    </span>
                                                    <div>
                                                        <p className={`text-sm font-bold ${isMe ? 'text-white' : 'text-slate-900'}`}>
                                                            {entry.student_name} {isMe ? '(You)' : ''}
                                                        </p>
                                                        <p className={`inline-flex items-center gap-1 text-[11px] font-semibold ${isMe ? 'text-blue-100' : 'text-slate-500'}`}>
                                                            <CheckCircle2 size={11} />
                                                            {entry.tasks_done} tasks
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 ${isMe ? 'bg-blue-500' : 'bg-slate-100'}`}>
                                                    <Zap size={14} fill="currentColor" className={isMe ? 'text-white' : 'text-blue-600'} />
                                                    <span className={`text-sm font-extrabold ${isMe ? 'text-white' : 'text-slate-900'}`}>
                                                        {entry.total_xp}
                                                    </span>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    </>
                )}
            </main>
        </div>
    );
}
