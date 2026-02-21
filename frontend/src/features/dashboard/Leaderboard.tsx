import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, User, ArrowLeft, Zap, Globe, CheckCircle2 } from 'lucide-react';
import api from '../../lib/api';

interface LeaderboardEntry {
    student_id: number;
    student_name: string;
    total_xp: number;
    tasks_done: number;
}

type Period = 'weekly' | 'monthly' | 'all_time';

export default function Leaderboard() {
    const navigate = useNavigate();
    const [data, setData] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<Period>('weekly');

    // Get current user ID for highlighting
    const storedUser = localStorage.getItem('user');
    const currentUserId = storedUser ? JSON.parse(storedUser).id : null;

    const fetchLeaderboard = useCallback(async (selectedPeriod: Period) => {
        setLoading(true);
        try {
            const res = await api.get(`/api/homework/leaderboard/?period=${selectedPeriod}`);
            setData(res.data);
        } catch (err) {
            console.error("Leaderboard error:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLeaderboard(period);
    }, [period, fetchLeaderboard]);

    const topThree = data.slice(0, 3);
    const theRest = data.slice(3);

    return (
        <div className="min-h-screen bg-slate-50 p-8 font-sans">
            <div className="max-w-4xl mx-auto">

                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/dashboard')} className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-100 text-slate-500 transition-all active:scale-95 shadow-sm">
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Leaderboard</h1>
                            <p className="text-slate-500 font-medium">Earn XP to win free lessons! 🎁</p>
                        </div>
                    </div>

                    <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm self-start md:self-center">
                        {(['weekly', 'monthly', 'all_time'] as Period[]).map((p) => (
                            <button key={p} onClick={() => setPeriod(p)} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${period === p ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
                                {p.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </header>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Calculating XP...</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                            {topThree.map((entry, index) => {
                                const isMe = entry.student_id === currentUserId;
                                return (
                                    <div key={entry.student_id} className={`relative p-8 rounded-[32px] border-2 flex flex-col items-center text-center transition-all hover:-translate-y-2 ${isMe ? 'ring-4 ring-blue-500/20' : ''} ${index === 0 ? 'bg-slate-900 border-slate-900 text-white shadow-2xl shadow-slate-300' : 'bg-white border-slate-100'}`}>
                                        <div className={`absolute -top-4 px-4 py-1 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg ${index === 0 ? 'bg-yellow-400 text-slate-900' : index === 1 ? 'bg-slate-200 text-slate-600' : 'bg-orange-100 text-orange-600'}`}>
                                            {index === 0 ? '🏆 1st Place' : index === 1 ? '🥈 2nd Place' : '🥉 3rd Place'}
                                        </div>
                                        <div className={`h-20 w-20 rounded-full flex items-center justify-center mb-4 border-4 ${index === 0 ? 'bg-slate-800 border-yellow-400/30' : 'bg-slate-50 border-transparent'}`}>
                                            <User size={32} className={index === 0 ? 'text-yellow-400' : 'text-slate-400'} />
                                        </div>
                                        <h3 className="text-xl font-black mb-1 truncate w-full">{entry.student_name} {isMe && "(You)"}</h3>
                                        <div className={`flex items-center gap-2 text-3xl font-black mb-4 ${index === 0 ? 'text-yellow-400' : 'text-blue-600'}`}>
                                            <Zap size={24} fill="currentColor" /> {entry.total_xp}
                                        </div>
                                        <div className={`text-[10px] font-black uppercase tracking-widest ${index === 0 ? 'text-slate-400' : 'text-slate-300'}`}>
                                            {entry.tasks_done} Assignments Done
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="space-y-3 pb-10">
                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-4 mb-4 flex items-center gap-2">
                                <Globe size={14} /> Full Rankings
                            </h4>
                            {theRest.map((entry, index) => {
                                const isMe = entry.student_id === currentUserId;
                                return (
                                    <div key={entry.student_id} className={`p-5 rounded-3xl border transition-all group flex items-center justify-between ${isMe ? 'bg-blue-600 border-blue-600 shadow-xl shadow-blue-200 translate-x-2' : 'bg-white border-slate-100 hover:shadow-md hover:border-blue-100'}`}>
                                        <div className="flex items-center gap-6">
                                            <span className={`w-8 text-center font-black ${isMe ? 'text-blue-200' : 'text-slate-300 group-hover:text-blue-600'}`}>#{index + 4}</span>
                                            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isMe ? 'bg-blue-500 text-white' : 'bg-slate-50 text-slate-400'}`}>
                                                <User size={18} />
                                            </div>
                                            <div>
                                                <div className={`font-bold ${isMe ? 'text-white' : 'text-slate-800'}`}>{entry.student_name} {isMe && "(You)"}</div>
                                                <div className={`flex items-center gap-2 text-[10px] font-bold uppercase ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                                                    <CheckCircle2 size={10} /> {entry.tasks_done} Tasks
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`px-4 py-2 rounded-2xl flex items-center gap-2 ${isMe ? 'bg-blue-500' : 'bg-slate-50'}`}>
                                            <Zap size={14} className={isMe ? 'text-white' : 'text-blue-600'} fill="currentColor" />
                                            <span className={`text-lg font-black ${isMe ? 'text-white' : 'text-slate-900'}`}>{entry.total_xp}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}