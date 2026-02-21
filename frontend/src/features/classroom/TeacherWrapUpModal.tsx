import { useState } from 'react';
import {
    CheckCircle, UserX, XCircle, X, AlertTriangle, BookOpen, Calendar,
    ClipboardList, Loader2, ChevronDown,
} from 'lucide-react';
import api from '../../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type LessonStatus = 'COMPLETED' | 'STUDENT_ABSENT' | 'CANCELLED';

interface HomeworkTemplate {
    id: number;
    title: string;
    level: string;
}

const STATUS_OPTIONS = [
    {
        value: 'COMPLETED' as LessonStatus,
        label: 'Completed',
        description: 'Lesson went well and was fully delivered.',
        icon: <CheckCircle size={18} />,
        ringColor: 'ring-emerald-400',
        selectedBorder: 'border-emerald-400 border-2',
        selectedBg: 'bg-emerald-50',
        selectedText: 'text-emerald-700',
        iconColor: 'text-emerald-500',
    },
    {
        value: 'STUDENT_ABSENT' as LessonStatus,
        label: 'Student Absent',
        description: 'Student did not attend the session.',
        icon: <UserX size={18} />,
        ringColor: 'ring-amber-400',
        selectedBorder: 'border-amber-400 border-2',
        selectedBg: 'bg-amber-50',
        selectedText: 'text-amber-700',
        iconColor: 'text-amber-500',
    },
    {
        value: 'CANCELLED' as LessonStatus,
        label: 'Cancelled',
        description: 'Session was cancelled by either party.',
        icon: <XCircle size={18} />,
        ringColor: 'ring-red-400',
        selectedBorder: 'border-red-400 border-2',
        selectedBg: 'bg-red-50',
        selectedText: 'text-red-700',
        iconColor: 'text-red-500',
    },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface TeacherWrapUpModalProps {
    open: boolean;
    lessonId: number | string;
    onSuccessExit: () => void;
    onCancel: () => void;
}

export default function TeacherWrapUpModal({
    open,
    lessonId,
    onSuccessExit,
    onCancel,
}: TeacherWrapUpModalProps) {
    // ── core form ──
    const [selectedStatus, setSelectedStatus] = useState<LessonStatus | null>(null);
    const [teacherNotes, setTeacherNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── homework section ──
    const [showHomework, setShowHomework] = useState(false);
    const [library, setLibrary] = useState<HomeworkTemplate[]>([]);
    const [libraryLoading, setLibraryLoading] = useState(false);
    const [selectedHomeworkId, setSelectedHomeworkId] = useState<number | ''>('');
    const [homeworkDue, setHomeworkDue] = useState('');

    if (!open) return null;

    const notesRequired =
        selectedStatus === 'COMPLETED' || selectedStatus === 'STUDENT_ABSENT';
    const canSave =
        selectedStatus !== null && (!notesRequired || teacherNotes.trim().length > 0);

    // ── fetch library once when homework section is opened ──
    const handleToggleHomework = async () => {
        const next = !showHomework;
        setShowHomework(next);
        if (next && library.length === 0 && !libraryLoading) {
            setLibraryLoading(true);
            try {
                const res = await api.get<HomeworkTemplate[]>('/api/homework/library/');
                setLibrary(res.data);
            } catch {
                // silent — user will just see an empty dropdown
            } finally {
                setLibraryLoading(false);
            }
        }
    };

    // ── save handler ──
    const handleSave = async () => {
        if (!canSave) return;
        setSaving(true);
        setError(null);
        try {
            // 1. Save the lesson wrap-up (status + notes)
            await api.patch(`/api/lessons/${lessonId}/wrap-up/`, {
                status: selectedStatus,
                teacher_notes: teacherNotes.trim(),
            });

            // 2. Optionally assign homework via the existing homework endpoint
            if (showHomework && selectedHomeworkId && homeworkDue) {
                try {
                    await api.post(`/api/homework/assign/${lessonId}/`, {
                        homework_id: selectedHomeworkId,
                        due_date: homeworkDue,
                    });
                } catch (hwErr: any) {
                    // Homework assign failed — non-fatal, still exit, but warn
                    const hwMsg =
                        hwErr?.response?.data?.error ||
                        hwErr?.response?.data?.detail ||
                        'Wrap-up saved, but homework assignment failed.';
                    setError(hwMsg);
                    setSaving(false);
                    return;
                }
            }

            onSuccessExit();
        } catch (err: any) {
            const msg =
                err?.response?.data?.error ||
                err?.response?.data?.detail ||
                'Failed to save wrap-up. Please check your connection and try again.';
            setError(msg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget && !saving) onCancel(); }}
        >
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 flex flex-col max-h-[90vh] overflow-hidden">

                {/* ── Header ─────────────────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                            <ClipboardList size={18} className="text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-900">Lesson Wrap-Up</h2>
                            <p className="text-xs text-gray-400">Save your notes before leaving</p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        disabled={saving}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors disabled:opacity-50"
                        aria-label="Close"
                    >
                        <X size={17} />
                    </button>
                </div>

                {/* ── Body ───────────────────────────────────────────────────────── */}
                <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

                    {/* Error banner */}
                    {error && (
                        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* ── 1. Status ────────────────────────────────────────────────── */}
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5">
                            Lesson Outcome <span className="text-red-400">*</span>
                        </p>
                        <div className="space-y-2">
                            {STATUS_OPTIONS.map((opt) => {
                                const isSelected = selectedStatus === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        onClick={() => setSelectedStatus(opt.value)}
                                        disabled={saving}
                                        className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all focus:outline-none focus:ring-2 ${opt.ringColor} disabled:opacity-50 ${isSelected
                                                ? `${opt.selectedBg} ${opt.selectedBorder}`
                                                : 'border-gray-200 hover:border-gray-300 bg-white'
                                            }`}
                                    >
                                        <span className={`mt-0.5 shrink-0 ${isSelected ? opt.iconColor : 'text-gray-400'}`}>
                                            {opt.icon}
                                        </span>
                                        <div>
                                            <p className={`text-sm font-semibold ${isSelected ? opt.selectedText : 'text-gray-700'}`}>
                                                {opt.label}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── 2. Teacher Notes ─────────────────────────────────────────── */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                            Lesson Notes
                            {notesRequired
                                ? <span className="text-red-400 ml-1">*</span>
                                : <span className="text-gray-400 font-normal ml-1">(optional)</span>
                            }
                        </label>
                        <textarea
                            rows={4}
                            value={teacherNotes}
                            onChange={(e) => setTeacherNotes(e.target.value)}
                            disabled={saving}
                            placeholder={
                                selectedStatus === 'COMPLETED'
                                    ? 'How did the lesson go? What did the student do well? What needs improvement?'
                                    : selectedStatus === 'STUDENT_ABSENT'
                                        ? 'Any context about the absence? Reschedule needed?'
                                        : 'Any relevant notes about the cancellation…'
                            }
                            className={`w-full px-3.5 py-3 text-sm rounded-xl border resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 transition-colors ${notesRequired && teacherNotes.trim() === ''
                                    ? 'border-red-300 bg-red-50'
                                    : 'border-gray-200 bg-gray-50 focus:bg-white'
                                }`}
                        />
                        {notesRequired && teacherNotes.trim() === '' && (
                            <p className="text-xs text-red-500 mt-1">Notes are required for this outcome.</p>
                        )}
                    </div>

                    {/* ── 3. Homework assignment (library template picker) ──────────── */}
                    <div>
                        <button
                            onClick={handleToggleHomework}
                            disabled={saving}
                            className="flex items-center justify-between w-full text-xs font-bold text-gray-500 uppercase tracking-wider hover:text-blue-600 transition-colors mb-1.5 disabled:opacity-50"
                        >
                            <span className="flex items-center gap-2">
                                <BookOpen size={13} />
                                Homework Assignment
                                <span className="text-gray-400 font-normal normal-case">
                                    (optional)
                                </span>
                            </span>
                            <ChevronDown
                                size={14}
                                className={`transition-transform ${showHomework ? 'rotate-180' : ''}`}
                            />
                        </button>

                        {showHomework && (
                            <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">

                                {/* Template selection */}
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 block mb-1.5">
                                        Select Homework Template
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={selectedHomeworkId}
                                            onChange={(e) =>
                                                setSelectedHomeworkId(e.target.value === '' ? '' : Number(e.target.value))
                                            }
                                            disabled={saving || libraryLoading}
                                            className="w-full appearance-none px-3.5 py-2.5 pr-9 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
                                        >
                                            <option value="">
                                                {libraryLoading ? 'Loading library…' : '— Choose from Library —'}
                                            </option>
                                            {library.map((hw) => (
                                                <option key={hw.id} value={hw.id}>
                                                    {hw.title} ({hw.level})
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown
                                            size={14}
                                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                                        />
                                    </div>
                                    {library.length === 0 && !libraryLoading && (
                                        <p className="text-xs text-gray-400 mt-1">
                                            No templates in library yet. Create one at{' '}
                                            <span className="text-blue-500">teacher/homework</span>.
                                        </p>
                                    )}
                                </div>

                                {/* Due date */}
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 block mb-1.5 flex items-center gap-1.5">
                                        <Calendar size={12} />
                                        Due Date
                                        {selectedHomeworkId
                                            ? <span className="text-red-400">*</span>
                                            : <span className="text-gray-400 font-normal">(required if template chosen)</span>
                                        }
                                    </label>
                                    <input
                                        type="date"
                                        value={homeworkDue}
                                        onChange={(e) => setHomeworkDue(e.target.value)}
                                        disabled={saving}
                                        className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
                                    />
                                </div>

                                {/* Inline validation hint */}
                                {selectedHomeworkId !== '' && !homeworkDue && (
                                    <p className="text-xs text-amber-600">
                                        Please pick a due date so the homework can be assigned.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Footer ─────────────────────────────────────────────────────── */}
                <div className="flex gap-3 px-5 py-4 border-t border-gray-100 shrink-0">
                    <button
                        onClick={onCancel}
                        disabled={saving}
                        className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={
                            !canSave ||
                            saving ||
                            (showHomework && selectedHomeworkId !== '' && !homeworkDue)
                        }
                        className="flex-[2] py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
                    >
                        {saving
                            ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
                            : 'Save & Exit'
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}
