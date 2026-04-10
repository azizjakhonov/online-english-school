import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { BookOpen, CheckCircle, XCircle, Clock, Plus } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface Course {
    id: number;
    title: string;
}

interface Enrollment {
    id: number;
    course_id: number;
    course_title: string;
    status: 'ACTIVE' | 'COMPLETED' | 'DROPPED';
    status_label: string;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
}

// ── API helpers ────────────────────────────────────────────────────────────

const fetchEnrollments = (): Promise<Enrollment[]> =>
    api.get('/api/curriculum/enrollments/').then(r => r.data);

const fetchCourses = (): Promise<Course[]> =>
    api.get('/api/curriculum/courses/').then(r => r.data.results ?? r.data);

const enrollInCourse = (course_id: number) =>
    api.post('/api/curriculum/enrollments/', { course_id }).then(r => r.data);

const updateEnrollment = (id: number, status: string) =>
    api.patch(`/api/curriculum/enrollments/${id}/`, { status }).then(r => r.data);

// ── Status badge ───────────────────────────────────────────────────────────

const STATUS_STYLES = {
    ACTIVE: 'bg-emerald-100 text-emerald-700',
    COMPLETED: 'bg-blue-100 text-blue-700',
    DROPPED: 'bg-red-100 text-red-700',
};

const STATUS_ICONS = {
    ACTIVE: <Clock className="w-3.5 h-3.5" />,
    COMPLETED: <CheckCircle className="w-3.5 h-3.5" />,
    DROPPED: <XCircle className="w-3.5 h-3.5" />,
};

function StatusBadge({ status, label }: { status: Enrollment['status']; label: string }) {
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}>
            {STATUS_ICONS[status]}
            {label}
        </span>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────

import { usePageTitle } from '../../lib/usePageTitle';

export default function StudentEnrollments() {
    usePageTitle('My Courses');
    const qc = useQueryClient();
    const [showEnrollForm, setShowEnrollForm] = useState(false);
    const [selectedCourseId, setSelectedCourseId] = useState<number | ''>('');

    const { data: enrollments = [], isLoading } = useQuery({
        queryKey: ['enrollments'],
        queryFn: fetchEnrollments,
    });

    const { data: courses = [] } = useQuery({
        queryKey: ['courses'],
        queryFn: fetchCourses,
        enabled: showEnrollForm,
    });

    const enrollMutation = useMutation({
        mutationFn: (courseId: number) => enrollInCourse(courseId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['enrollments'] });
            setShowEnrollForm(false);
            setSelectedCourseId('');
        },
    });

    const dropMutation = useMutation({
        mutationFn: ({ id }: { id: number }) => updateEnrollment(id, 'DROPPED'),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['enrollments'] }),
    });

    const handleEnroll = () => {
        if (selectedCourseId === '') return;
        enrollMutation.mutate(selectedCourseId as number);
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-xl">
                        <BookOpen className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">My Enrollments</h1>
                        <p className="text-sm text-gray-500">Courses you are enrolled in</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowEnrollForm(v => !v)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Enroll in a Course
                </button>
            </div>

            {/* Enroll form */}
            {showEnrollForm && (
                <div className="mb-6 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <h2 className="text-sm font-semibold text-gray-700 mb-3">Select a course to enroll in</h2>
                    <div className="flex gap-3">
                        <select
                            value={selectedCourseId}
                            onChange={e => setSelectedCourseId(Number(e.target.value))}
                            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        >
                            <option value="">— Choose a course —</option>
                            {courses.map(c => (
                                <option key={c.id} value={c.id}>{c.title}</option>
                            ))}
                        </select>
                        <button
                            onClick={handleEnroll}
                            disabled={selectedCourseId === '' || enrollMutation.isPending}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        >
                            {enrollMutation.isPending ? 'Enrolling…' : 'Enroll'}
                        </button>
                    </div>
                    {enrollMutation.isError && (
                        <p className="mt-2 text-xs text-red-600">
                            {(enrollMutation.error as any)?.response?.data?.error ?? 'Enrollment failed.'}
                        </p>
                    )}
                </div>
            )}

            {/* Enrollment list */}
            {isLoading ? (
                <div className="flex justify-center py-16">
                    <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : enrollments.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                    <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">You haven't enrolled in any courses yet.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {enrollments.map(e => (
                        <div key={e.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 truncate">{e.course_title}</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    Enrolled {e.started_at ? new Date(e.started_at).toLocaleDateString() : '—'}
                                    {e.completed_at && ` · Completed ${new Date(e.completed_at).toLocaleDateString()}`}
                                </p>
                            </div>
                            <StatusBadge status={e.status} label={e.status_label} />
                            {e.status === 'ACTIVE' && (
                                <button
                                    onClick={() => dropMutation.mutate({ id: e.id })}
                                    disabled={dropMutation.isPending}
                                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                                >
                                    Drop
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
