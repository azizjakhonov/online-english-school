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

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 p-8">
      <div className="max-w-5xl mx-auto">

        {/* HEADER */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-3xl font-black text-slate-900">Homework Manager</h1>
              <p className="text-slate-500 font-medium">Assign library quizzes and track results.</p>
            </div>
          </div>
          <button
            onClick={openAssignModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95"
          >
            <Plus size={20} /> Assign New
          </button>
        </header>

        {/* SEARCH BAR */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex items-center gap-3">
          <Search size={20} className="text-slate-400" />
          <input
            type="text"
            placeholder="Search by student or homework title..."
            className="flex-1 outline-none text-slate-700 font-medium placeholder:text-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* ASSIGNMENTS LIST */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
        ) : filteredAssignments.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
            <div className="h-16 w-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No active assignments found</h3>
            <p className="text-slate-500">Assign homework to your students to see them here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAssignments.map((item) => (
              <div key={item.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2">

                {/* Left: Info */}
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="h-14 w-14 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{item.homework_title}</h3>
                    <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                      <span className="flex items-center gap-1"><Users size={14} /> {item.student_name}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Clock size={14} /> Due: {formatDate(item.due_date)}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Status & Action */}
                <div className="w-full md:w-auto flex items-center justify-end gap-4">
                  {item.is_completed ? (
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-2xl font-black text-slate-900">
                          {item.percentage ? item.percentage.toFixed(0) : 0}%
                        </span>
                        <div className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md mt-1 flex items-center justify-end gap-1">
                          <CheckCircle size={12} /> {item.score} pts
                        </div>
                      </div>
                      {/* ✅ VIEW RESULTS BUTTON */}
                      <button
                        onClick={() => openResultsModal(item.id)}
                        className="p-3 bg-slate-100 hover:bg-blue-100 hover:text-blue-600 rounded-xl text-slate-600 transition-colors"
                        title="View Details"
                      >
                        <Eye size={20} />
                      </button>
                    </div>
                  ) : (
                    <div className="px-4 py-2 bg-yellow-50 text-yellow-700 rounded-lg text-sm font-bold flex items-center gap-2">
                      <Clock size={16} /> Pending
                    </div>
                  )}
                </div>

              </div>
            ))}
          </div>
        )}

      </div>

      {/* --- ASSIGN MODAL --- */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-8 relative animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => setShowModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900"><X size={24} /></button>
            <h2 className="text-2xl font-black text-slate-900 mb-6">Assign Homework</h2>
            <form onSubmit={handleAssign} className="space-y-6">
              {/* Form Content kept same as before... */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Select Student (Lesson)</label>
                <select
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  value={selectedLesson}
                  onChange={(e) => setSelectedLesson(e.target.value)}
                  required
                >
                  <option value="">-- Choose a Lesson --</option>
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
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  value={selectedHomework}
                  onChange={(e) => setSelectedHomework(e.target.value)}
                  required
                >
                  <option value="">-- Choose from Library --</option>
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
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={assigning}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50"
              >
                {assigning ? <Loader2 className="animate-spin" /> : <CheckCircle size={20} />}
                Confirm Assignment
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- ✅ NEW: RESULTS MODAL --- */}
      {showResultsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 flex flex-col">

            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-slate-900">Homework Results</h2>
                {selectedResult && <p className="text-slate-500 text-sm">{selectedResult.student_name} • {selectedResult.homework_title}</p>}
              </div>
              <button onClick={() => setShowResultsModal(false)} className="text-slate-400 hover:text-slate-900"><X size={24} /></button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto bg-slate-50">
              {loadingResult ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
              ) : selectedResult ? (
                <div className="space-y-4">
                  {/* Score Summary Card */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between mb-6">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Score</p>
                      <p className="text-3xl font-black text-slate-900">{selectedResult.score} pts</p>
                    </div>
                    <div className={`text-2xl font-black ${selectedResult.percentage >= 70 ? 'text-green-600' : 'text-orange-500'}`}>
                      {selectedResult.percentage.toFixed(0)}%
                    </div>
                  </div>

                  {/* Question Breakdown */}
                  {selectedResult.answers.map((ans, idx) => (
                    <div key={idx} className={`p-4 rounded-xl border ${ans.is_correct ? 'bg-white border-slate-200' : 'bg-red-50 border-red-100'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold uppercase text-slate-400">Question {idx + 1}</span>
                        {ans.is_correct ? (
                          <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded flex items-center gap-1">
                            <CheckCircle size={10} /> Correct (+{ans.points_earned})
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded flex items-center gap-1">
                            <AlertCircle size={10} /> Incorrect (0/{ans.max_points})
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-slate-800 mb-2">{ans.question_text}</h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-3">
                        <div className={`${ans.is_correct ? 'text-slate-600' : 'text-red-600 font-bold'}`}>
                          <span className="block text-xs text-slate-400 uppercase mb-1">Student Answer</span>
                          {ans.student_answer}
                        </div>
                        {!ans.is_correct && (
                          <div className="text-green-700 font-bold">
                            <span className="block text-xs text-slate-400 uppercase mb-1">Correct Answer</span>
                            {ans.correct_answer}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-slate-500">No details available.</div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}