import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Mail, Phone, CreditCard,
    ArrowLeft, Clock, CheckCircle2, XCircle, PlusCircle,
    History, Receipt, BookOpen, Camera, Loader2, Pencil, X
} from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../auth/AuthContext';
import { formatUZS } from '../../lib/formatCurrency';
import { formatDateTime, formatDate } from '../../utils/datetime';

// --- TYPES ---
interface LessonHistoryItem {
    id: number;
    teacher_name: string;
    start_time: string;
    end_time: string;
    status: string;
    credits_used: number;
}

interface PaymentRecord {
    id: number;
    credits_amount: number;
    amount_uzs: string;
    method_display: string;
    provider_display: string;
    status: string;
    status_display: string;
    created_at: string;
}

interface ExtendedUser {
    id: number;
    full_name: string;
    email: string;
    phone_number: string;
    profile_picture_url: string | null;
    student_profile?: {
        lesson_credits: number;
        level?: string;
        goals?: string;
    };
}

export default function StudentProfilePage() {
    const navigate = useNavigate();
    const { user, refreshUser } = useAuth();
    const currentUser = user as unknown as ExtendedUser | null;

    const [activeTab, setActiveTab] = useState<'lessons' | 'billing'>('lessons');
    const [loading, setLoading] = useState(true);

    const [lessonHistory, setLessonHistory] = useState<LessonHistoryItem[]>([]);
    const [payments, setPayments] = useState<PaymentRecord[]>([]);
    const [paymentsLoading, setPaymentsLoading] = useState(false);

    // --- Avatar state ---
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [avatarError, setAvatarError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Edit profile state ---
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [formFullName, setFormFullName] = useState('');
    const [formLevel, setFormLevel] = useState('');
    const [formGoals, setFormGoals] = useState('');

    // --- 1. FETCH INITIAL DATA ---
    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            try {
                // Fetch latest me/ data (includes profile_picture_url)
                const meRes = await api.get('/api/me/');
                if (isMounted) {
                    setAvatarUrl(meRes.data.profile_picture_url || null);
                }

                // Fetch lesson history from student profile endpoint
                // (backend already filters to end_time < now, so all items are truly past)
                const profileRes = await api.get('/api/student/profile/');
                if (isMounted) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const mapped = (profileRes.data.lesson_history || []).map((l: any) => ({
                        id: l.lesson_id,
                        teacher_name: l.teacher_name || 'Unknown Teacher',
                        start_time: l.start_time,
                        end_time: l.end_time,
                        status: l.status.toLowerCase(),
                        credits_used: l.credits_used ?? 0,
                    }));
                    setLessonHistory(mapped);
                    setLoading(false);
                }
            } catch (error) {
                console.error('Failed to fetch profile data', error);
                if (isMounted) setLoading(false);
            }
        };

        fetchData();
        return () => { isMounted = false; };
    }, []);

    // --- 2. FETCH PAYMENTS WHEN BILLING TAB OPENED ---
    useEffect(() => {
        if (activeTab !== 'billing' || payments.length > 0) return;
        setPaymentsLoading(true);
        api.get('/api/payments/')
            .then(res => setPayments(res.data))
            .catch(err => console.error('Failed to load payments', err))
            .finally(() => setPaymentsLoading(false));
    }, [activeTab]);

    // --- 3. AVATAR UPLOAD ---
    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Optimistic local preview
        const blobUrl = URL.createObjectURL(file);
        setAvatarUrl(blobUrl);
        setAvatarError(null);
        setAvatarUploading(true);

        try {
            const formData = new FormData();
            formData.append('avatar', file);
            // DO NOT set Content-Type manually — axios sets it automatically
            // for FormData, including the required multipart boundary.
            const res = await api.patch('/api/accounts/avatar/', formData);

            // Replace blob URL with the permanent server URL
            setAvatarUrl(res.data.profile_picture_url);

            // Sync the global AuthContext so the new avatar persists across
            // navigation and after page refresh.
            await refreshUser();
        } catch (err: unknown) {
            let msg = 'Upload failed. Please try again.';
            if (err && typeof err === 'object' && 'response' in err) {
                const apiErr = err as { response?: { data?: { error?: string } } };
                if (apiErr.response?.data?.error) msg = apiErr.response.data.error;
            }
            setAvatarError(msg);
            // Revert preview to whatever the server currently has
            setAvatarUrl(currentUser?.profile_picture_url || null);
        } finally {
            setAvatarUploading(false);
            // Reset file input so the same file can be re-selected if needed
            if (e.target) e.target.value = '';
        }
    };

    // --- 4. EDIT PROFILE ---
    const handleStartEdit = () => {
        setFormFullName(currentUser?.full_name || '');
        setFormLevel(currentUser?.student_profile?.level || '');
        setFormGoals(currentUser?.student_profile?.goals || '');
        setSaveMessage(null);
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setSaveMessage(null);
    };

    const handleSave = async () => {
        if (!formFullName.trim()) return;
        setIsSaving(true);
        setSaveMessage(null);
        try {
            // PATCH /api/me/ handles full_name, level, and goals in a single call.
            await api.patch('/api/me/', {
                full_name: formFullName.trim(),
                level: formLevel,
                goals: formGoals.trim(),
            });
            await refreshUser();
            setSaveMessage({ type: 'success', text: 'Profile updated successfully.' });
            setIsEditing(false);
        } catch (err: unknown) {
            let msg = 'Failed to save. Please try again.';
            if (err && typeof err === 'object' && 'response' in err) {
                const apiErr = err as { response?: { data?: { error?: string; detail?: string } } };
                if (apiErr.response?.data?.error) msg = apiErr.response.data.error;
                else if (apiErr.response?.data?.detail) msg = apiErr.response.data.detail;
            }
            setSaveMessage({ type: 'error', text: msg });
        } finally {
            setIsSaving(false);
        }
    };

    const statusBadgeConfig: Record<string, { bg: string; text: string; label: string }> = {
        succeeded: { bg: 'bg-green-100', text: 'text-green-700', label: 'Paid' },
        pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
        failed: { bg: 'bg-red-100', text: 'text-red-700', label: 'Failed' },
        refunded: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Refunded' },
        canceled: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Canceled' },
    };

    if (!currentUser) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

    const initials = currentUser.full_name?.[0]?.toUpperCase() || 'U';

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 p-6 md:p-10">
            <div className="max-w-5xl mx-auto">

                {/* Navigation */}
                <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold mb-6 transition-colors">
                    <ArrowLeft size={20} /> Back to Dashboard
                </button>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                    {/* LEFT COLUMN: Profile Card */}
                    <div className="md:col-span-1 space-y-6">
                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 text-center">

                            {/* Avatar */}
                            <div className="relative inline-block mx-auto mb-2">
                                <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center text-3xl font-black text-blue-600 border-4 border-white shadow-lg overflow-hidden">
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" onError={() => setAvatarUrl(null)} />
                                    ) : (
                                        <span>{initials}</span>
                                    )}
                                </div>
                                {/* Camera button */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={avatarUploading}
                                    className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md hover:bg-blue-700 transition-colors disabled:opacity-60"
                                    title="Change photo"
                                >
                                    {avatarUploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    className="hidden"
                                    onChange={handleAvatarChange}
                                />
                            </div>
                            {/* Inline avatar error banner */}
                            {avatarError && (
                                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-2 text-center">
                                    {avatarError}
                                </p>
                            )}

                            {isEditing ? (
                                /* ── EDIT MODE ── */
                                <div className="space-y-3 text-left mt-3">
                                    {/* Full Name */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Full Name</label>
                                        <input
                                            type="text"
                                            value={formFullName}
                                            onChange={e => setFormFullName(e.target.value)}
                                            placeholder="Your full name"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    {/* English Level */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">English Level</label>
                                        <select
                                            value={formLevel}
                                            onChange={e => setFormLevel(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">Not specified</option>
                                            <option value="A1">A1 – Beginner</option>
                                            <option value="A2">A2 – Elementary</option>
                                            <option value="B1">B1 – Intermediate</option>
                                            <option value="B2">B2 – Upper Intermediate</option>
                                            <option value="C1">C1 – Advanced</option>
                                            <option value="C2">C2 – Proficiency</option>
                                        </select>
                                    </div>

                                    {/* Goals */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Learning Goals</label>
                                        <textarea
                                            value={formGoals}
                                            onChange={e => setFormGoals(e.target.value)}
                                            placeholder="What do you want to achieve?"
                                            rows={3}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                        />
                                    </div>

                                    {/* Phone / Email (read-only) */}
                                    <div className="flex items-center gap-3 text-sm text-slate-500 p-3 bg-slate-50 rounded-xl">
                                        {currentUser.phone_number
                                            ? <><Phone size={16} className="text-slate-400 shrink-0" /><span className="truncate">{currentUser.phone_number}</span></>
                                            : <><Mail size={16} className="text-slate-400 shrink-0" /><span className="truncate">{currentUser.email || 'No contact'}</span></>
                                        }
                                    </div>

                                    {/* Save error */}
                                    {saveMessage?.type === 'error' && (
                                        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-center">
                                            {saveMessage.text}
                                        </p>
                                    )}

                                    {/* Save / Cancel */}
                                    <div className="flex gap-2 pt-1">
                                        <button
                                            onClick={handleSave}
                                            disabled={isSaving || !formFullName.trim()}
                                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                                        >
                                            {isSaving && <Loader2 size={14} className="animate-spin" />}
                                            {isSaving ? 'Saving…' : 'Save Changes'}
                                        </button>
                                        <button
                                            onClick={handleCancelEdit}
                                            disabled={isSaving}
                                            title="Cancel"
                                            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors disabled:opacity-50"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* ── VIEW MODE ── */
                                <>
                                    <h2 className="text-xl font-black text-slate-900">{currentUser.full_name}</h2>
                                    <p className="text-slate-500 font-medium text-sm mb-4">Student Account</p>

                                    <div className="space-y-3 text-left">
                                        {/* Phone / Email */}
                                        <div className="flex items-center gap-3 text-sm text-slate-600 p-3 bg-slate-50 rounded-xl">
                                            {currentUser.phone_number
                                                ? <><Phone size={18} className="text-slate-400 shrink-0" /><span className="truncate">{currentUser.phone_number}</span></>
                                                : <><Mail size={18} className="text-slate-400 shrink-0" /><span className="truncate">{currentUser.email || 'No contact'}</span></>
                                            }
                                        </div>

                                        {/* Level (only when set) */}
                                        {currentUser.student_profile?.level && (
                                            <div className="flex items-center gap-3 text-sm text-slate-600 p-3 bg-slate-50 rounded-xl">
                                                <BookOpen size={18} className="text-slate-400 shrink-0" />
                                                <span className="font-medium">{currentUser.student_profile.level}</span>
                                            </div>
                                        )}

                                        {/* Goals (only when set) */}
                                        {currentUser.student_profile?.goals && (
                                            <div className="text-left text-sm p-3 bg-slate-50 rounded-xl">
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Goals</p>
                                                <p className="text-slate-600 leading-relaxed">{currentUser.student_profile.goals}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Success message after save */}
                                    {saveMessage?.type === 'success' && (
                                        <p className="mt-3 text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-center">
                                            {saveMessage.text}
                                        </p>
                                    )}

                                    {/* Edit Profile button */}
                                    <button
                                        onClick={handleStartEdit}
                                        className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-600 hover:text-blue-700 text-sm font-bold rounded-xl transition-all"
                                    >
                                        <Pencil size={14} /> Edit Profile
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Balance Card */}
                        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
                            <div className="relative z-10">
                                <p className="text-slate-400 font-bold text-sm mb-1">Current Balance</p>
                                <h3 className="text-4xl font-black mb-6">{currentUser.student_profile?.lesson_credits || 0} <span className="text-lg font-medium text-slate-400">Credits</span></h3>
                                <button
                                    onClick={() => navigate('/buy-credits')}
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/50"
                                >
                                    <PlusCircle size={18} /> Top Up Balance
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: History & Tabs */}
                    <div className="md:col-span-2">
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 min-h-[600px] flex flex-col">

                            {/* Tabs */}
                            <div className="flex items-center border-b border-slate-100 p-2">
                                <button
                                    onClick={() => setActiveTab('lessons')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'lessons' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <History size={18} /> Lesson History
                                </button>
                                <button
                                    onClick={() => setActiveTab('billing')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'billing' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <Receipt size={18} /> Payments
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6 flex-1">
                                {activeTab === 'lessons' ? (
                                    loading ? (
                                        <div className="h-full flex items-center justify-center text-slate-400 gap-2">
                                            <Loader2 className="animate-spin" size={20} /> Loading history...
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {lessonHistory.length === 0 ? (
                                                <EmptyHistory icon={<BookOpen size={40} />} text="No lessons taken yet." />
                                            ) : (
                                                lessonHistory.map(lesson => {
                                                    // Normalize: map DB status to display
                                                    const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string; iconColor: string }> = {
                                                        completed: { bg: 'bg-green-500', text: 'text-white', label: 'Completed', iconColor: 'bg-green-500' },
                                                        cancelled: { bg: 'bg-red-500', text: 'text-white', label: 'Cancelled', iconColor: 'bg-red-500' },
                                                        student_absent: { bg: 'bg-orange-400', text: 'text-white', label: 'Absent', iconColor: 'bg-orange-400' },
                                                        teacher_absent: { bg: 'bg-orange-400', text: 'text-white', label: 'Teacher Absent', iconColor: 'bg-orange-400' },
                                                        pending: { bg: 'bg-yellow-400', text: 'text-slate-900', label: 'Awaiting Confirmation', iconColor: 'bg-slate-400' },
                                                        confirmed: { bg: 'bg-yellow-400', text: 'text-slate-900', label: 'Awaiting Confirmation', iconColor: 'bg-slate-400' },
                                                    };
                                                    const cfg = STATUS_CONFIG[lesson.status] || { bg: 'bg-slate-400', text: 'text-white', label: lesson.status, iconColor: 'bg-slate-400' };
                                                    return (
                                                        <div key={lesson.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-100 transition-colors">
                                                            <div className="flex items-center gap-4">
                                                                <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-white shrink-0 ${cfg.iconColor}`}>
                                                                    {lesson.status === 'completed' ? <CheckCircle2 size={24} /> : lesson.status === 'cancelled' ? <XCircle size={24} /> : <Clock size={24} />}
                                                                </div>
                                                                <div>
                                                                    <h4 className="font-bold text-slate-900">{lesson.teacher_name}</h4>
                                                                    <p className="text-xs text-slate-500 font-medium">
                                                                        {formatDateTime(lesson.start_time)}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <span className={`text-xs font-bold uppercase px-2 py-1 rounded-md ${cfg.bg} ${cfg.text}`}>
                                                                    {cfg.label}
                                                                </span>
                                                                <p className="text-xs text-slate-400 mt-1">-{lesson.credits_used} Credit</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )
                                ) : (
                                    /* BILLING TAB */
                                    paymentsLoading ? (
                                        <div className="h-full flex items-center justify-center text-slate-400 gap-2">
                                            <Loader2 className="animate-spin" size={20} /> Loading payments...
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {payments.length === 0 ? (
                                                <EmptyHistory icon={<CreditCard size={40} />} text="No payments yet. Buy your first credits!" />
                                            ) : (
                                                payments.map(tx => {
                                                    const badge = statusBadgeConfig[tx.status] || statusBadgeConfig['pending'];
                                                    return (
                                                        <div key={tx.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-blue-100 transition-colors">
                                                            <div className="flex items-center gap-4">
                                                                <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                                                                    <CreditCard size={20} />
                                                                </div>
                                                                <div>
                                                                    <h4 className="font-bold text-slate-900">{formatUZS(tx.amount_uzs)}</h4>
                                                                    <p className="text-xs text-slate-500 font-medium">
                                                                        {formatDate(tx.created_at)} · {tx.method_display} · {tx.provider_display}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <span className="block text-green-600 font-bold text-sm">+{tx.credits_amount} Credits</span>
                                                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}>
                                                                    {badge.label}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function EmptyHistory({ icon, text }: { icon: React.ReactNode, text: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="mb-4 opacity-50">{icon}</div>
            <p className="font-medium">{text}</p>
        </div>
    );
}