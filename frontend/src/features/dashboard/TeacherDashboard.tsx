import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Clock,
  Calendar as CalendarIcon,
  Settings,
  LogOut,
  Video,
  ChevronRight,
  Plus,
  History
} from 'lucide-react';
import api from '../../lib/api';
import { formatWeekdayShort, formatDayNum, formatTime } from '../../utils/datetime';

// --- DEFINITIONS ---

interface TeacherProfile {
  headline: string;
  rating: number;
  lessons_taught: number;
}

interface User {
  full_name: string;
  phone_number: string;
  teacher_profile?: TeacherProfile;
}

interface Lesson {
  id: number;
  room_sid?: string;
  student_name: string;
  start_time: string;
  end_time: string;
  ended_at?: string | null;
  status: string;
  meeting_link: string;
}

interface TeacherDashboardProps {
  user?: User | null;
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend: string;
}

// --- COMPONENT ---

export default function TeacherDashboard({ user: propUser }: TeacherDashboardProps) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(propUser || null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(!propUser);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userRes = await api.get('/api/me/');
        setUser(userRes.data);

        const lessonsRes = await api.get('/api/my-lessons/');
        setLessons(lessonsRes.data);

      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    };

    if (!propUser) {
      fetchData();
    } else {
      api.get('/api/my-lessons/').then(res => setLessons(res.data));
      setLoading(false);
    }
  }, [propUser]);

  // --- LESSON CATEGORIZATION ---
  const GRACE_MS = 10 * 60 * 1000;
  const joinableLessons = lessons.filter(l => {
    const start = new Date(l.start_time).getTime();
    const end = new Date(l.end_time).getTime() + GRACE_MS;
    const now = Date.now();
    return start <= now && now <= end;
  });
  const upcomingLessons = lessons.filter(l => new Date(l.start_time).getTime() > Date.now());
  const awaitingLessons = lessons.filter(l =>
    new Date(l.end_time).getTime() + GRACE_MS < Date.now() &&
    l.status !== 'COMPLETED' && l.status !== 'CANCELLED'
  );
  const activeLessons = [...joinableLessons, ...upcomingLessons];
  const activeLessonsCount = activeLessons.length;

  // --- BUG FIX: CALCULATE UNIQUE STUDENTS ---
  // We map the lessons to get just names, then use Set to remove duplicates
  const uniqueStudentCount = new Set(lessons.map(l => l.student_name)).size;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <div className="p-10 text-center">Failed to load profile. Please refresh.</div>;
  }

  const firstName = user.full_name ? user.full_name.split(' ')[0] : 'Teacher';

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
          <NavItem
            icon={<Clock size={20} />}
            label="Dashboard"
            active={true}
            onClick={() => navigate('/dashboard')}
          />
          <NavItem
            icon={<CalendarIcon size={20} />}
            label="Schedule"
            onClick={() => navigate('/teacher/schedule')}
          />
          <NavItem icon={<Users size={20} />} label="My Students" />
          <NavItem
            icon={<Settings size={20} />}
            label="Settings"
            onClick={() => navigate('/teacher/settings')}
          />
          <NavItem
            icon={<History size={20} />}
            label="Lesson History"
            onClick={() => navigate('/teacher/history')}
          />
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
              {firstName[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{user.full_name}</p>
              <p className="text-xs text-slate-500 truncate">Teacher Account</p>
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
              Hello, {firstName} 👋
            </h1>
            <p className="text-slate-500 font-medium">
              You have {activeLessonsCount} upcoming lesson{activeLessonsCount !== 1 ? 's' : ''}.
            </p>
          </div>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95">
            <Plus size={20} /> New Lesson
          </button>
        </header>

        {/* STATS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            label="Total Students"
            value={uniqueStudentCount} // <--- UPDATED THIS
            icon={<Users className="text-blue-600" />}
            trend="Active now"
          />
          <StatCard
            label="Hours Taught"
            value={user.teacher_profile?.lessons_taught || 0}
            icon={<Clock className="text-purple-600" />}
            trend="Total lifetime"
          />
          <StatCard
            label="Rating"
            value={user.teacher_profile?.rating || "5.0"}
            icon={<Users className="text-yellow-500" />}
            trend="Excellent"
          />
        </div>

        {/* SCHEDULE SECTION */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CalendarIcon className="text-blue-600" /> Upcoming Schedule
          </h2>

          {lessons.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center py-20">
              <div className="h-20 w-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-200">
                <CalendarIcon size={40} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">No lessons scheduled</h3>
              <p className="text-slate-500 max-w-sm mx-auto mb-8">
                Your schedule is empty. Share your profile link with students to get booked.
              </p>
              <button
                onClick={() => navigate('/teacher/schedule')}
                className="text-blue-600 font-bold hover:underline"
              >
                Manage Availability
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {/* ── Joinable (in-progress) ── */}
              {joinableLessons.map((lesson) => (
                <div key={lesson.id} className="bg-white p-5 rounded-2xl border-2 border-green-400 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="h-16 w-16 rounded-xl bg-green-100 text-green-600 flex flex-col items-center justify-center font-bold shrink-0">
                      <span className="text-xs uppercase opacity-70">{formatWeekdayShort(lesson.start_time)}</span>
                      <span className="text-xl">{formatDayNum(lesson.start_time)}</span>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full mb-1 inline-block">🟢 In Progress</span>
                      <h3 className="font-bold text-lg text-slate-900">{lesson.student_name}</h3>
                      <p className="text-slate-500 text-sm font-medium flex items-center gap-2">
                        <Clock size={14} />
                        {formatTime(lesson.start_time)} - {formatTime(lesson.end_time)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/classroom/${lesson.id}`)}
                    className="w-full md:w-auto px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2 shadow-md shadow-green-200"
                  >
                    <Video size={18} /> Start Class
                  </button>
                </div>
              ))}

              {/* ── Upcoming ── */}
              {upcomingLessons.map((lesson) => (
                <div key={lesson.id} className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 hover:border-blue-300 transition-colors shadow-sm">
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="h-16 w-16 rounded-xl bg-purple-100 text-purple-600 flex flex-col items-center justify-center font-bold shrink-0">
                      <span className="text-xs uppercase opacity-70">{formatWeekdayShort(lesson.start_time)}</span>
                      <span className="text-xl">{formatDayNum(lesson.start_time)}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-900">{lesson.student_name}</h3>
                      <p className="text-slate-500 text-sm font-medium flex items-center gap-2">
                        <Clock size={14} />
                        {formatTime(lesson.start_time)} - {formatTime(lesson.end_time)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/classroom/${lesson.id}`)}
                    className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-md shadow-blue-200"
                  >
                    <Video size={18} /> Start Class
                  </button>
                </div>
              ))}

              {/* ── Awaiting Confirmation ── */}
              {awaitingLessons.length > 0 && (
                <>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest pt-2">Awaiting Confirmation</p>
                  {awaitingLessons.map((lesson) => (
                    <div key={lesson.id} className="bg-orange-50 p-5 rounded-2xl border border-orange-200 flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="h-16 w-16 rounded-xl bg-orange-100 text-orange-500 flex flex-col items-center justify-center font-bold shrink-0">
                          <Clock size={28} />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full mb-1 inline-block">⏳ Awaiting Confirmation</span>
                          <h3 className="font-bold text-lg text-slate-900">{lesson.student_name}</h3>
                          <p className="text-slate-500 text-sm font-medium flex items-center gap-2">
                            <Clock size={14} />
                            {formatTime(lesson.start_time)} - {formatTime(lesson.end_time)}
                          </p>
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

// --- SUBCOMPONENTS ---

function NavItem({ icon, label, active = false, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${active ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
    >
      {icon}
      <span>{label}</span>
      {active && <ChevronRight size={16} className="ml-auto" />}
    </button>
  );
}

function StatCard({ label, value, icon, trend }: StatCardProps) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-slate-50 rounded-xl">{icon}</div>
        <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md">{trend}</span>
      </div>
      <h3 className="text-3xl font-black text-slate-900 mb-1">{value}</h3>
      <p className="text-sm font-medium text-slate-400">{label}</p>
    </div>
  );
}