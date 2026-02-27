import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Loader2, History, CheckCircle2, XCircle, Clock,
    AlertCircle, ChevronDown, X, DollarSign, Users, BookOpen,
    TrendingUp, Filter, Search
} from 'lucide-react';
import api from '../../lib/api';
import { formatDateTime, formatTime } from '../../utils/datetime';
import { formatUZS, formatUZSCompact } from '../../lib/formatCurrency';
import Avatar from '../../components/Avatar';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface LessonHistoryItem {
    lesson_id: number;
    student_name: string;
    student_phone: string;
    student_profile_picture_url: string | null;
    start_time: string;
    end_time: string;
    status: string;
    credits_consumed: boolean;
    teacher_rate_uzs: number;
    payout_amount_uzs: number;
    payout_status: 'PENDING' | 'PAID';
    earnings_event_id: number | null;
    credit_transaction_id: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Status & display helpers
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
    COMPLETED: { label: 'Completed', bg: 'bg-green-100', text: 'text-green-700', icon: <CheckCircle2 size={13} /> },
    STUDENT_ABSENT: { label: 'Student Absent', bg: 'bg-orange-100', text: 'text-orange-700', icon: <AlertCircle size={13} /> },
    CANCELLED: { label: 'Cancelled', bg: 'bg-red-100', text: 'text-red-700', icon: <XCircle size={13} /> },
    PENDING: { label: 'Pending', bg: 'bg-blue-100', text: 'text-blue-700', icon: <Clock size={13} /> },
    CONFIRMED: { label: 'Confirmed', bg: 'bg-indigo-100', text: 'text-indigo-700', icon: <Clock size={13} /> },
};

// Allowed transitions per current status
const ALLOWED_NEXT: Record<string, string[]> = {
    PENDING: ['COMPLETED', 'STUDENT_ABSENT', 'CANCELLED'],
    CONFIRMED: ['COMPLETED', 'STUDENT_ABSENT', 'CANCELLED'],
};

function StatusBadge({ status }: { status: string }) {
    const cfg = STATUS_CONFIG[status] ?? { label: status, bg: 'bg-slate-100', text: 'text-slate-600', icon: null };
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text}`}>
            {cfg.icon}{cfg.label}
        </span>
    );
}

function PayoutBadge({ status }: { status: 'PENDING' | 'PAID' }) {
    return status === 'PAID'
        ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700"><CheckCircle2 size={12} />Paid</span>
        : <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700"><Clock size={12} />Pending</span>;
}

function durationMins(start: string, end: string): number {
    return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────────────────────────────────────
function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
    useEffect(() => { const t = setTimeout(onClose, 3200); return () => clearTimeout(t); }, [onClose]);
    return (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <CheckCircle2 size={18} className="text-green-400" />
            <span className="font-semibold text-sm">{msg}</span>
            <button onClick={onClose} className="ml-2 text-slate-400 hover:text-white"><X size={16} /></button>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit Modal
// ─────────────────────────────────────────────────────────────────────────────
interface EditModalProps {
    lesson: LessonHistoryItem;
    onClose: () => void;
    onSave: (lessonId: number, newStatus: string) => Promise<void>;
}

function EditModal({ lesson, onClose, onSave }: EditModalProps) {
    const nextStatuses = ALLOWED_NEXT[lesson.status] ?? [];
    const [selected, setSelected] = useState(nextStatuses[0] ?? '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConfirm = async () => {
        if (!selected) return;
        setSaving(true);
        setError(null);
        try {
            await onSave(lesson.lesson_id, selected);
            onClose();
        } catch (e: unknown) {
            const axiosErr = e as { response?: { data?: { error?: string } } };
            setError(axiosErr?.response?.data?.error ?? 'Failed to update lesson. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700">
                    <X size={20} />
                </button>

                <h2 className="text-2xl font-black text-slate-900 mb-1">Update Lesson Status</h2>
                <p className="text-slate-500 text-sm mb-6">Lesson #{lesson.lesson_id}</p>

                {/* Read-only details */}
                <div className="bg-slate-50 rounded-2xl p-4 mb-6 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500 font-medium">Student</span><span className="font-bold text-slate-900">{lesson.student_name}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500 font-medium">Date & Time</span><span className="font-bold text-slate-900">{formatDateTime(lesson.start_time)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500 font-medium">Duration</span><span className="font-bold text-slate-900">{durationMins(lesson.start_time, lesson.end_time)} min</span></div>
                    <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">Current Status</span><StatusBadge status={lesson.status} /></div>
                </div>

                {nextStatuses.length === 0 ? (
                    <div className="text-center py-4 text-slate-500 font-medium">
                        No status changes are allowed for a <strong>{lesson.status}</strong> lesson.
                    </div>
                ) : (
                    <>
                        <label className="block text-sm font-bold text-slate-700 mb-2">New Status</label>
                        <div className="relative mb-6">
                            <select
                                value={selected}
                                onChange={e => setSelected(e.target.value)}
                                className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-10 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {nextStatuses.map(s => (
                                    <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>
                                ))}
                            </select>
                            <ChevronDown size={18} className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" />
                        </div>

                        {selected === 'COMPLETED' && (
                            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium">
                                ✓ Marking as Completed will automatically deduct 1 credit from the student and record your payout.
                            </div>
                        )}

                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button onClick={onClose} className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={saving || !selected}
                                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                {saving ? 'Saving…' : 'Confirm'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function TeacherLessonHistory() {
    const navigate = useNavigate();
    const [lessons, setLessons] = useState<LessonHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editTarget, setEditTarget] = useState<LessonHistoryItem | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/api/teacher/lesson-history/');
            setLessons(res.data);
        } catch {
            setError('Failed to load lesson history. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleSave = async (lessonId: number, newStatus: string) => {
        await api.patch(`/api/teacher/lesson-history/${lessonId}/`, { status: newStatus });
        setToast(`Lesson #${lessonId} updated to ${STATUS_CONFIG[newStatus]?.label ?? newStatus}`);
        await load();
    };

    // ── Filtering ──────────────────────────────────────────────────────────────
    const filtered = lessons.filter(l => {
        if (statusFilter !== 'ALL' && l.status !== statusFilter) return false;
        if (search && !l.student_name.toLowerCase().includes(search.toLowerCase())) return false;
        const startDate = l.start_time.slice(0, 10);
        if (dateFrom && startDate < dateFrom) return false;
        if (dateTo && startDate > dateTo) return false;
        return true;
    });

    // ── Stats ──────────────────────────────────────────────────────────────────
    const totalLessons = lessons.length;
    const totalCompleted = lessons.filter(l => l.status === 'COMPLETED').length;
    const totalAbsent = lessons.filter(l => l.status === 'STUDENT_ABSENT').length;
    const totalEarned = lessons.reduce((sum, l) => sum + l.payout_amount_uzs, 0);

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">

            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4 sticky top-0 z-20">
                <button onClick={() => navigate('/dashboard')} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 rounded-xl text-blue-600"><History size={20} /></div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900">Lesson History</h1>
                        <p className="text-xs text-slate-500 font-medium">All past lessons & financials</p>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

                {/* Stats Bar */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: 'Total Lessons', value: totalLessons, icon: <BookOpen size={20} />, color: 'bg-blue-50 text-blue-600' },
                        { label: 'Completed', value: totalCompleted, icon: <CheckCircle2 size={20} />, color: 'bg-green-50 text-green-600' },
                        { label: 'Student Absent', value: totalAbsent, icon: <AlertCircle size={20} />, color: 'bg-orange-50 text-orange-600' },
                        { label: 'Total Earned', value: formatUZSCompact(totalEarned), icon: <TrendingUp size={20} />, color: 'bg-indigo-50 text-indigo-600' },
                    ].map(card => (
                        <div key={card.label} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
                            <div className={`p-3 rounded-xl shrink-0 ${card.color}`}>{card.icon}</div>
                            <div>
                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{card.label}</p>
                                <p className="text-2xl font-black text-slate-900">{card.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 flex flex-wrap items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1 min-w-40">
                        <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search student…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Status filter */}
                    <div className="relative">
                        <Filter size={14} className="absolute left-3 top-2.5 text-slate-400" />
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            className="pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                        >
                            <option value="ALL">All Statuses</option>
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Date range */}
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-slate-400 text-sm font-medium">to</span>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    {/* Clear filters */}
                    {(search || statusFilter !== 'ALL' || dateFrom || dateTo) && (
                        <button
                            onClick={() => { setSearch(''); setStatusFilter('ALL'); setDateFrom(''); setDateTo(''); }}
                            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-800 font-medium rounded-xl hover:bg-slate-100 transition-colors flex items-center gap-1"
                        >
                            <X size={14} /> Clear
                        </button>
                    )}
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="flex justify-center items-center py-24">
                            <Loader2 size={36} className="animate-spin text-blue-600" />
                        </div>
                    ) : error ? (
                        <div className="p-10 text-center text-red-600 font-medium">{error}</div>
                    ) : filtered.length === 0 ? (
                        <div className="p-16 text-center">
                            <History size={48} className="mx-auto mb-4 text-slate-300" />
                            <h3 className="text-lg font-bold text-slate-900 mb-1">No lessons found</h3>
                            <p className="text-slate-500 text-sm">
                                {lessons.length === 0 ? 'Past lessons will appear here once completed.' : 'Try adjusting your filters.'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wider">
                                        <th className="px-6 py-4 text-left font-semibold">Date & Time</th>
                                        <th className="px-4 py-4 text-left font-semibold">Student</th>
                                        <th className="px-4 py-4 text-left font-semibold">Duration</th>
                                        <th className="px-4 py-4 text-left font-semibold">Status</th>
                                        <th className="px-4 py-4 text-left font-semibold">Credit</th>
                                        <th className="px-4 py-4 text-left font-semibold">Payout</th>
                                        <th className="px-4 py-4 text-right font-semibold">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filtered.map(lesson => {
                                        const canEdit = !!ALLOWED_NEXT[lesson.status]?.length;
                                        return (
                                            <tr key={lesson.lesson_id} className="group hover:bg-slate-50 transition-colors">
                                                {/* Date */}
                                                <td className="px-6 py-4">
                                                    <p className="font-semibold text-slate-900 text-sm whitespace-nowrap">{formatDateTime(lesson.start_time)}</p>
                                                    <p className="text-xs text-slate-400 mt-0.5">{formatTime(lesson.start_time)} – {formatTime(lesson.end_time)}</p>
                                                </td>

                                                {/* Student */}
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar
                                                            url={lesson.student_profile_picture_url}
                                                            name={lesson.student_name}
                                                            size={36}
                                                            className="border border-slate-200 shrink-0"
                                                        />
                                                        <p className="font-semibold text-slate-900 text-sm">{lesson.student_name}</p>
                                                    </div>
                                                </td>

                                                {/* Duration */}
                                                <td className="px-4 py-4 text-sm font-medium text-slate-700 whitespace-nowrap">
                                                    {durationMins(lesson.start_time, lesson.end_time)} min
                                                </td>

                                                {/* Status */}
                                                <td className="px-4 py-4">
                                                    <StatusBadge status={lesson.status} />
                                                </td>

                                                {/* Credit */}
                                                <td className="px-4 py-4">
                                                    {lesson.credits_consumed ? (
                                                        <span className="inline-flex items-center gap-1 text-green-600 text-sm font-bold">
                                                            <CheckCircle2 size={15} /> Used
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-slate-400 text-sm font-medium">
                                                            <span className="h-4 w-4 rounded-full bg-slate-200 inline-block" /> Not used
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Payout */}
                                                <td className="px-4 py-4">
                                                    <div className="space-y-1">
                                                        <p className="font-bold text-slate-900 text-sm font-mono">
                                                            {lesson.payout_amount_uzs > 0 ? formatUZS(lesson.payout_amount_uzs) : '—'}
                                                        </p>
                                                        <PayoutBadge status={lesson.payout_status} />
                                                    </div>
                                                </td>

                                                {/* Action */}
                                                <td className="px-4 py-4 text-right">
                                                    {canEdit ? (
                                                        <button
                                                            onClick={() => setEditTarget(lesson)}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                                                        >
                                                            <DollarSign size={13} /> Update
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs text-slate-300 font-medium">Locked</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* Table footer */}
                            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                                <p className="text-xs text-slate-400 font-medium">
                                    Showing {filtered.length} of {lessons.length} lessons
                                </p>
                                <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                                    <Users size={13} /> {new Set(filtered.map(l => l.student_name)).size} unique students
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            {editTarget && (
                <EditModal
                    lesson={editTarget}
                    onClose={() => setEditTarget(null)}
                    onSave={handleSave}
                />
            )}

            {/* Toast */}
            {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
        </div>
    );
}
