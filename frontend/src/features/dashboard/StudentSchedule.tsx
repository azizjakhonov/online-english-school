import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, Video, CheckCircle, ArrowLeft,
  Loader2
  // Fix: Removed PlayCircle, ChevronRight
} from 'lucide-react';
import api from '../../lib/api';
import { formatMonthShort, formatDayNum, formatTime } from '../../utils/datetime';

interface Lesson {
  id: number;
  teacher_name: string;
  start_time: string;
  end_time: string;
  status: string;
  meeting_link: string;
}

export default function StudentSchedule() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/api/my-lessons/');
        setLessons(res.data);
      } catch (err) {
        console.error("Failed to load schedule", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter Logic
  const now = new Date();
  const upcomingLessons = lessons.filter(l => new Date(l.end_time) > now).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  const pastLessons = lessons.filter(l => new Date(l.end_time) <= now).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

  const displayedLessons = activeTab === 'upcoming' ? upcomingLessons : pastLessons;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <header className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/dashboard')} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900">My Schedule</h1>
            <p className="text-slate-500 font-medium">Manage your upcoming classes and view history.</p>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-white p-1.5 rounded-xl border border-slate-200 w-fit shadow-sm">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'upcoming' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Upcoming ({upcomingLessons.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            History ({pastLessons.length})
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
        ) : displayedLessons.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
            <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mb-4">
              <Calendar size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No {activeTab} lessons</h3>
            <p className="text-slate-500 mb-6">
              {activeTab === 'upcoming' ? "You don't have any classes scheduled." : "You haven't completed any lessons yet."}
            </p>
            {activeTab === 'upcoming' && (
              <button onClick={() => navigate('/find-teachers')} className="text-blue-600 font-bold hover:underline">
                Find a Teacher &rarr;
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {displayedLessons.map(lesson => (
              <div key={lesson.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 hover:border-blue-300 transition-colors group">

                <div className="flex items-center gap-5 w-full md:w-auto">
                  {/* Date Badge */}
                  <div className={`h-16 w-16 rounded-2xl flex flex-col items-center justify-center font-bold shadow-sm shrink-0 ${activeTab === 'upcoming' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                    <span className="text-xs uppercase opacity-80">{formatMonthShort(lesson.start_time)}</span>
                    <span className="text-2xl">{formatDayNum(lesson.start_time)}</span>
                  </div>

                  {/* Info */}
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">English Lesson</h3>
                    <p className="text-slate-500 font-medium text-sm flex items-center gap-2">
                      <span className="flex items-center gap-1"><Clock size={14} /> {formatTime(lesson.start_time)}</span>
                      <span>•</span>
                      <span>with {lesson.teacher_name}</span>
                    </p>
                  </div>
                </div>

                {/* Action */}
                <div className="w-full md:w-auto">
                  {activeTab === 'upcoming' ? (
                    <button
                      onClick={() => navigate(`/classroom/${lesson.id}`)}
                      className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-slate-200"
                    >
                      <Video size={18} /> Join Class
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 text-green-600 font-bold bg-green-50 px-4 py-2 rounded-lg">
                      <CheckCircle size={18} /> Completed
                    </div>
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