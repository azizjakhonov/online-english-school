import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, ArrowLeft, CheckCircle, PlayCircle, Loader2, AlertCircle
} from 'lucide-react';
import api from '../../lib/api';
import { formatDate } from '../../utils/datetime';

// ✅ UPDATED: Match the new Activity-based model
interface Assignment {
  id: number;
  title: string;
  teacher_name: string;
  due_date: string;
  is_completed: boolean;
  score: number;      // Earned points
  percentage: number; // 0-100 scale
}

export default function StudentHomework() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending'>('all');

  useEffect(() => {
    const fetchHomework = async () => {
      try {
        // Points to your StudentAssignmentsListView in backend/homework/views.py
        const res = await api.get('/api/homework/my-assignments/');
        setAssignments(res.data);
      } catch (err) {
        console.error("Failed to load homework", err);
        setError("Could not load assignments.");
      } finally {
        setLoading(false);
      }
    };
    fetchHomework();
  }, []);

  const filteredList = filter === 'all'
    ? assignments
    : assignments.filter(h => !h.is_completed);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <header className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/dashboard')} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900">My Homework</h1>
            <p className="text-slate-500 font-medium">Complete interactive tasks and track your progress.</p>
          </div>
        </header>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${filter === 'all' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>All</button>
          <button onClick={() => setFilter('pending')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${filter === 'pending' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>Pending</button>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-2 mb-6">
            <AlertCircle size={20} /> {error}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
        ) : filteredList.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
            <div className="h-16 w-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText size={32} />
            </div>
            <p className="text-slate-500 font-medium">No homework found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredList.map((hw) => (
              <div key={hw.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 hover:border-blue-300 transition-colors">

                <div className="flex gap-4 items-center">
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${hw.is_completed ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                    {hw.is_completed ? <CheckCircle size={20} /> : <FileText size={20} />}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{hw.title}</h3>
                    <p className="text-sm text-slate-500">
                      From {hw.teacher_name} • Due {formatDate(hw.due_date)}
                    </p>
                  </div>
                </div>
                <div className="w-full md:w-auto flex justify-end">
                  {hw.is_completed ? (
                    <div className="text-right flex flex-col items-end">
                      {/* Displays the Grade instead of the Start Button once completed */}
                      <span className="text-2xl font-black text-slate-900">
                        {hw.percentage.toFixed(0)}%
                      </span>
                      <div className="flex items-center gap-1 text-xs font-bold text-green-600">
                        <CheckCircle size={14} /> Completed
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => navigate(`/student/homework/${hw.id}`)}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95"
                    >
                      <PlayCircle size={18} /> Start
                    </button>
                  )}
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}