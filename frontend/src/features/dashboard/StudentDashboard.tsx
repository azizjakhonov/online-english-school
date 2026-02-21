import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Clock,
  Trophy,
  Target,
  Video,
  LogOut,
  ChevronRight,
  PlayCircle,
  Calendar
} from 'lucide-react';
import api from '../../lib/api';
import { formatDate, formatMonthShort, formatDayNum, formatTime } from '../../utils/datetime';

// --- TYPES ---
interface StudentProfile {
  level: string;
  lesson_credits: number;
  goals?: string;
}

interface User {
  id: number;
  full_name: string;
  phone_number: string;
  student_profile?: StudentProfile;
}

interface Lesson {
  id: number;
  room_sid?: string;
  teacher_name: string;
  start_time: string;
  end_time: string;
  ended_at?: string | null;
  status: string;
  meeting_link: string;
}

interface StudentDashboardProps {
  user: User;
}

export default function StudentDashboard({ user: initialUser }: StudentDashboardProps) {
  const navigate = useNavigate();

  // State for dynamic data
  const [user, setUser] = useState<User>(initialUser);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch Lessons on Mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Refresh user data (for credits/level updates)
        const userRes = await api.get('/api/me/');
        setUser(userRes.data);

        // Fetch Booked Lessons
        const lessonsRes = await api.get('/api/my-lessons/');
        setLessons(lessonsRes.data);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Safe Name Extraction
  const firstName = user.full_name ? user.full_name.split(' ')[0] : 'Student';

  // Lesson categorization helpers
  const GRACE_MS = 10 * 60 * 1000;
  const upcomingLessons = lessons.filter(l => new Date(l.start_time).getTime() > Date.now());
  const joinableLessons = lessons.filter(l => {
    const start = new Date(l.start_time).getTime();
    const end   = new Date(l.end_time).getTime() + GRACE_MS;
    const now   = Date.now();
    return start <= now && now <= end;
  });
  const awaitingLessons = lessons.filter(l =>
    new Date(l.end_time).getTime() + GRACE_MS < Date.now() &&
    l.status !== 'COMPLETED' && l.status !== 'CANCELLED'
  );
  const activeLessons = [...joinableLessons, ...upcomingLessons];

  // Helper to find the very next lesson
  const nextLesson = activeLessons.length > 0 ? activeLessons[0] : null;

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">

      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col fixed h-full z-10">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-blue-600 font-black text-xl tracking-tight">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Video size={20} />
            </div>
            OnlineSchool
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavItem icon={<BookOpen size={20} />} label="My Learning" active />
          <NavItem icon={<Clock size={20} />} label="Schedule" />
          <NavItem icon={<Trophy size={20} />} label="Achievements" />
          <NavItem icon={<Target size={20} />} label="Goals" />
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
              {firstName[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{user.full_name}</p>
              <p className="text-xs text-slate-500 truncate">Student Account</p>
            </div>
            <LogOut size={16} className="text-slate-400 cursor-pointer hover:text-red-500" />
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 md:ml-64 p-8">
        <header className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 mb-2">
              Welcome back, {firstName} 🚀
            </h1>
            <p className="text-slate-500 font-medium">
              You have {user.student_profile?.lesson_credits || 0} lesson credits remaining.
            </p>
          </div>

          <button
            onClick={() => navigate('/find-teachers')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95"
          >
            <BookOpen size={20} /> Browse Teachers
          </button>
        </header>

        {/* STATS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            label="Current Level"
            value={user.student_profile?.level || "Beginner"}
            icon={<Trophy className="text-yellow-500" />}
            trend="Keep going!"
          />
          <StatCard
            label="Upcoming Lessons"
            value={activeLessons.length}
            icon={<Clock className="text-blue-600" />}
            trend={activeLessons.length > 0 ? "You're on track!" : "Book a class"}
          />
          <StatCard
            label="Next Lesson"
            value={nextLesson ? formatDate(nextLesson.start_time) : "None"}
            icon={<Video className="text-purple-600" />}
            trend={nextLesson ? "Get ready!" : "Book now"}
          />
        </div>

        {/* UPCOMING LESSONS SECTION */}
        <div className="bg-white rounded-3xl border border-slate-200 p-8">
          <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Calendar className="text-blue-600" /> Upcoming Schedule
          </h3>

          {loading ? (
            <div className="text-center py-12 text-slate-400">Loading schedule...</div>
          ) : activeLessons.length === 0 && awaitingLessons.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
              <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-slate-400">
                <PlayCircle size={32} />
              </div>
              <h4 className="text-lg font-bold text-slate-900">No lessons booked</h4>
              <p className="text-slate-500 mb-6">Find a teacher and start learning today!</p>
              <button
                onClick={() => navigate('/find-teachers')}
                className="text-blue-600 font-bold hover:underline"
              >
                Find a Teacher &rarr;
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {/* ── Joinable (in-progress) ── */}
              {joinableLessons.map((lesson) => (
                <div key={lesson.id} className="bg-white p-6 rounded-2xl border-2 border-green-400 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="h-16 w-16 rounded-2xl bg-green-600 text-white flex flex-col items-center justify-center font-bold shadow-md shrink-0">
                      <span className="text-xs uppercase opacity-80">{formatMonthShort(lesson.start_time)}</span>
                      <span className="text-2xl">{formatDayNum(lesson.start_time)}</span>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full mb-1 inline-block">🟢 In Progress</span>
                      <h3 className="font-bold text-lg text-slate-900">English Lesson</h3>
                      <p className="text-slate-500 font-medium text-sm">with {lesson.teacher_name} • {formatTime(lesson.start_time)}</p>
                    </div>
                  </div>
                  <div className="w-full md:w-auto">
                    <button
                      onClick={() => navigate(`/classroom/${lesson.id}`)}
                      className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-green-200"
                    >
                      <Video size={18} /> Join Class
                    </button>
                  </div>
                </div>
              ))}

              {/* ── Upcoming ── */}
              {upcomingLessons.map((lesson) => (
                <div key={lesson.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 hover:border-blue-300 transition-colors">
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="h-16 w-16 rounded-2xl bg-blue-600 text-white flex flex-col items-center justify-center font-bold shadow-md shadow-blue-200 shrink-0">
                      <span className="text-xs uppercase opacity-80">{formatMonthShort(lesson.start_time)}</span>
                      <span className="text-2xl">{formatDayNum(lesson.start_time)}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-900">English Lesson</h3>
                      <p className="text-slate-500 font-medium text-sm">with {lesson.teacher_name} • {formatTime(lesson.start_time)}</p>
                    </div>
                  </div>
                  <div className="w-full md:w-auto">
                    <button
                      onClick={() => navigate(`/classroom/${lesson.id}`)}
                      className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                      <Video size={18} /> Join Class
                    </button>
                  </div>
                </div>
              ))}

              {/* ── Awaiting Confirmation (ended, not yet completed) ── */}
              {awaitingLessons.length > 0 && (
                <>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest pt-2">Awaiting Confirmation</p>
                  {awaitingLessons.map((lesson) => (
                    <div key={lesson.id} className="bg-orange-50 p-6 rounded-2xl border border-orange-200 flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="h-16 w-16 rounded-2xl bg-orange-100 text-orange-500 flex flex-col items-center justify-center font-bold shrink-0">
                          <Clock size={28} />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full mb-1 inline-block">⏳ Awaiting Confirmation</span>
                          <h3 className="font-bold text-lg text-slate-900">English Lesson</h3>
                          <p className="text-slate-500 font-medium text-sm">with {lesson.teacher_name} • {formatTime(lesson.start_time)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// --- HELPER COMPONENTS ---

function NavItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <button className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${active ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
      {icon}
      <span>{label}</span>
      {active && <ChevronRight size={16} className="ml-auto" />}
    </button>
  );
}

function StatCard({ label, value, icon, trend }: { label: string, value: string | number, icon: React.ReactNode, trend: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-slate-50 rounded-xl">{icon}</div>
        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{trend}</span>
      </div>
      <h3 className="text-3xl font-black text-slate-900 mb-1">{value}</h3>
      <p className="text-sm font-medium text-slate-400">{label}</p>
    </div>
  );
}