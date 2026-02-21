import React, { useState, useEffect } from 'react';
import { Edit2, Loader2, Plus } from 'lucide-react'; // FIX: Removed unused 'Search'
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
// FIX: Ensure this path is correct. If the modal is in the same folder, this works.
import AdminLessonEditModal from './AdminLessonEditModal';
import { formatDateTime } from '../../utils/datetime';

// FIX: Added interface to replace 'any'
interface Lesson {
  id: number;
  teacher_name: string;
  student_name: string;
  start_datetime: string;
  status: 'scheduled' | 'completed' | 'canceled';
}

export default function AdminLessons() {
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<Lesson[]>([]); // FIX: Typed state
  const [loading, setLoading] = useState(true);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  useEffect(() => {
    fetchLessons();
  }, []);

  const fetchLessons = async () => {
    try {
      const res = await api.get('/api/lessons/');
      setLessons(res.data);
    } catch (error) {
      console.error("Error fetching lessons:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Lesson Library</h1>
          <p className="text-slate-500 font-medium">View and manage all academic sessions.</p>
        </div>
        <button 
          onClick={() => navigate('/admin/lessons/create')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95"
        >
          <Plus size={20} /> New Lesson
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-8 py-4 text-center w-16">ID</th>
                <th className="px-8 py-4">Session Info</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {lessons.map((lesson) => (
                <tr key={lesson.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5 text-center text-slate-300 font-mono text-sm">#{lesson.id}</td>
                  <td className="px-8 py-5">
                    <div className="font-bold text-slate-700">{lesson.teacher_name} ↔ {lesson.student_name}</div>
                    <div className="text-sm text-slate-400">
                      {formatDateTime(lesson.start_datetime)}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize
                      ${lesson.status === 'scheduled' ? 'bg-blue-50 text-blue-600' : 
                        lesson.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}
                    `}>
                      {lesson.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button 
                      onClick={() => setSelectedLesson(lesson)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                    >
                      <Edit2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedLesson && (
        <AdminLessonEditModal 
          lesson={selectedLesson} 
          onClose={() => setSelectedLesson(null)} 
          onUpdate={fetchLessons} 
        />
      )}
    </div>
  );
}