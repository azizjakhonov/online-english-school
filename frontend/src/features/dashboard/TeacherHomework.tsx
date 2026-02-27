import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, ArrowLeft, Plus, CheckCircle, Clock,
  Users, X, Loader2, BookOpen, Search, Eye, AlertCircle
} from 'lucide-react';
import api from '../../lib/api';
import { formatDate } from '../../utils/datetime';

// --- TYPES ---

interface Assignment {
  id: number;
  student_name: string;
  homework_title: string;
  due_date: string;
  is_completed: boolean;
  score: number;      // Raw points
  percentage: number; // 0-100 Grade
}

interface LibraryItem {
  id: number;
  title: string;
  level: string;
}

interface LessonOption {
  id: number;
  student_name: string;
  start_time: string;
}

// ✅ NEW: Type for the Detailed Result View
interface AssignmentDetail {
  id: number;
  student_name: string;
  homework_title: string;
  score: number;
  percentage: number;
  answers: {
    question_text: string;    // e.g. "What color is the sky?"
    student_answer: string;   // e.g. "Blue"
    correct_answer: string;   // e.g. "Blue"
    is_correct: boolean;
    points_earned: number;
    max_points: number;
    type: 'quiz' | 'gap_fill' | 'matching';
  }[];
}

interface ApiError {
  response?: {
    data?: {
      error?: string;
    };
  };
}

export default function TeacherHomework() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // Assign Modal State
  const [showModal, setShowModal] = useState(false);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [myLessons, setMyLessons] = useState<LessonOption[]>([]);

  // Results Modal State
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState<AssignmentDetail | null>(null);
  const [loadingResult, setLoadingResult] = useState(false);

  // Form State
  const [selectedLesson, setSelectedLesson] = useState('');
  const [selectedHomework, setSelectedHomework] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Fetch Teacher's Sent Assignments
  const fetchAssignments = async () => {
    try {
      const res = await api.get('/api/homework/teacher-assignments/');
      setAssignments(res.data);
    } catch (err) {
      console.error("Failed to load assignments", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  // 2. Load Data for the "Assign" Modal
  const openAssignModal = async () => {
    setShowModal(true);
    try {
      const [libRes, lessonRes] = await Promise.all([
        api.get('/api/homework/library/'),
        api.get('/api/my-lessons/')
      ]);
      setLibrary(libRes.data);
      setMyLessons(lessonRes.data);
    } catch (err) {
      console.error("Failed to load modal data", err);
    }
  };

  // 3. Submit New Assignment
  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLesson || !selectedHomework || !dueDate) return;

    setAssigning(true);
    try {
      await api.post(`/api/homework/assign/${selectedLesson}/`, {
        homework_id: selectedHomework,
        due_date: new Date(dueDate).toISOString()
      });

      alert("✅ Homework assigned successfully!");
      setShowModal(false);
      fetchAssignments();

      // Reset form
      setSelectedLesson('');
      setSelectedHomework('');
      setDueDate('');
    } catch (error) {
      const err = error as ApiError;
      console.error(err);
      alert("❌ Error: " + (err.response?.data?.error || "Failed to assign"));
    } finally {
      setAssigning(false);
    }
  };

  // 4. ✅ NEW: Open Results Modal
  const openResultsModal = async (assignmentId: number) => {
    setShowResultsModal(true);
    setLoadingResult(true);
    try {
      // NOTE: You need to implement this endpoint in Django
      // It should return the breakdown of answers for a specific assignment ID
      const res = await api.get(`/api/homework/assignment/${assignmentId}/details/`);
      setSelectedResult(res.data);
    } catch (err) {
      console.error("Failed to load results", err);
      // Fallback for demo if API fails
      alert("Could not load details. Make sure the backend endpoint exists.");
      setShowResultsModal(false);
    } finally {
      setLoadingResult(false);
    }
  };

  // Filter assignments based on search
  const filteredAssignments = assignments.filter(a =>
    a.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.homework_title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalCompleted = assignments.filter(a => a.is_completed).length;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header — same pattern as TeacherLessonHistory */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-center justify-between gap-4 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            title="Back to dashboard"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-xl text-blue-600 shrink-0">
              <BookOpen size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">Homework Manager</h1>
              <p className="text-xs text-slate-500 font-medium">Assign library quizzes and track results</p>
            </div>
          </div>
        </div>
        <button
          onClick={openAssignModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        >
          <Plus size={18} /> Assign New
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats bar */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-xl shrink-0 bg-blue-50 text-blue-600">
              <FileText size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Assignments</p>
              <p className="text-2xl font-black text-slate-900">{assignments.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-xl shrink-0 bg-green-50 text-green-600">
              <CheckCircle size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Completed</p>
              <p className="text-2xl font-black text-slate-900">{totalCompleted}</p>
            </div>
          </div>
        </div>

        {/* Search — same as TeacherLessonHistory */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6">
          <div className="relative flex-1 min-w-0">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student or homework title…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Assignments list */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center py-24">
              <Loader2 size={36} className="animate-spin text-blue-600" />
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="p-16 text-center">
              <BookOpen size={48} className="mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-bold text-slate-900 mb-1">No active assignments found</h3>
              <p className="text-slate-500 text-sm">
                {assignments.length === 0 ? 'Assign homework to your students to see them here.' : 'Try adjusting your search.'}
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-50">
                {filteredAssignments.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col md:flex-row items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-4 w-full md:w-auto min-w-0">
                      <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <FileText size={22} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900 text-sm">{item.homework_title}</h3>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                          <span className="flex items-center gap-1"><Users size={13} /> {item.student_name}</span>
                          <span className="text-slate-300">•</span>
                          <span className="flex items-center gap-1"><Clock size={13} /> Due: {formatDate(item.due_date)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="w-full md:w-auto flex items-center justify-end gap-4 shrink-0">
                      {item.is_completed ? (
                        <>
                          <div className="text-right">
                            <span className="text-xl font-black text-slate-900 tabular-nums">
                              {item.percentage ? item.percentage.toFixed(0) : 0}%
                            </span>
                            <div className="text-xs font-bold text-green-700 bg-green-100 px-2.5 py-1 rounded-full mt-1 inline-flex items-center gap-1">
                              <CheckCircle size={12} /> {item.score} pts
                            </div>
                          </div>
                          <button
                            onClick={() => openResultsModal(item.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                            title="View details"
                          >
                            <Eye size={14} /> View
                          </button>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                          <Clock size={12} /> Pending
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-400 font-medium">
                  Showing {filteredAssignments.length} of {assignments.length} assignments
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Assign modal — same overlay/modal style as TeacherLessonHistory */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-8 relative">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"><X size={20} /></button>
            <h2 className="text-2xl font-black text-slate-900 mb-1">Assign Homework</h2>
            <p className="text-slate-500 text-sm mb-6">Choose a student and homework from the library</p>
            <form onSubmit={handleAssign} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Select Student (Lesson)</label>
                <select
                  className="w-full appearance-none px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                  value={selectedLesson}
                  onChange={(e) => setSelectedLesson(e.target.value)}
                  required
                >
                  <option value="">Choose a lesson…</option>
                  {myLessons.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.student_name} ({formatDate(l.start_time)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Select Homework Template</label>
                <select
                  className="w-full appearance-none px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                  value={selectedHomework}
                  onChange={(e) => setSelectedHomework(e.target.value)}
                  required
                >
                  <option value="">Choose from library…</option>
                  {library.map(lib => (
                    <option key={lib.id} value={lib.id}>
                      {lib.title} ({lib.level})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Due Date</label>
                <input
                  type="date"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {assigning ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  {assigning ? 'Assigning…' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Results modal */}
      {showResultsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl relative flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-2xl font-black text-slate-900 mb-1">Homework Results</h2>
                {selectedResult && <p className="text-slate-500 text-sm">{selectedResult.student_name} · {selectedResult.homework_title}</p>}
              </div>
              <button onClick={() => setShowResultsModal(false)} className="text-slate-400 hover:text-slate-700 p-1"><X size={20} /></button>
            </div>

            <div className="p-6 overflow-y-auto bg-slate-50 flex-1 min-h-0">
              {loadingResult ? (
                <div className="flex justify-center py-12"><Loader2 size={36} className="animate-spin text-blue-600" /></div>
              ) : selectedResult ? (
                <div className="space-y-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Score</p>
                      <p className="text-2xl font-black text-slate-900">{selectedResult.score} pts</p>
                    </div>
                    <div className={`text-2xl font-black ${selectedResult.percentage >= 70 ? 'text-green-600' : 'text-orange-600'}`}>
                      {selectedResult.percentage.toFixed(0)}%
                    </div>
                  </div>

                  {selectedResult.answers.map((ans, idx) => (
                    <div key={idx} className={`p-4 rounded-2xl border ${ans.is_correct ? 'bg-white border-slate-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Question {idx + 1}</span>
                        {ans.is_correct ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                            <CheckCircle size={12} /> Correct (+{ans.points_earned})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                            <AlertCircle size={12} /> Incorrect (0/{ans.max_points})
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm mb-2">{ans.question_text}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mt-3">
                        <div className={`p-3 rounded-xl bg-slate-50 ${ans.is_correct ? 'text-slate-700' : 'text-red-700 font-semibold'}`}>
                          <span className="block text-xs text-slate-500 font-medium mb-0.5">Student answer</span>
                          {ans.student_answer}
                        </div>
                        {!ans.is_correct && (
                          <div className="p-3 rounded-xl bg-green-50 text-green-700 font-semibold">
                            <span className="block text-xs text-slate-500 font-medium mb-0.5">Correct answer</span>
                            {ans.correct_answer}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-slate-500 font-medium text-sm">No details available.</div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}