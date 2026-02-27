import { useState, useEffect } from 'react';
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-center gap-4 sticky top-0 z-20">
        <button
          onClick={() => navigate('/dashboard')}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          title="Back to dashboard"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-100 rounded-xl text-blue-600 shrink-0">
            <FileText size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">My Homework</h1>
            <p className="text-xs text-slate-500 font-medium">Complete tasks and track progress</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors ${filter === 'pending' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Pending
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium p-4 flex items-center gap-2 mb-6">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="animate-spin text-blue-600" size={36} />
          </div>
        ) : filteredList.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-16 text-center">
              <FileText size={48} className="mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-bold text-slate-900 mb-1">No homework found</h3>
              <p className="text-slate-500 text-sm">Complete assignments from your teachers here.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredList.map((hw) => (
              <div key={hw.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 hover:border-slate-300 transition-colors">

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
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-colors"
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