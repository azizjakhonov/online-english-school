import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Clock, Trophy, Target, Video, LogOut, ChevronRight,
  PlayCircle, Calendar, Loader2, Users, DollarSign, Briefcase,
  FileText, CreditCard, PenTool, PlusCircle, Wallet,
  Settings
} from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../auth/AuthContext';
import Avatar from '../../components/Avatar';
import { formatDate, formatMonthShort, formatDayNum, formatTime } from '../../utils/datetime';
// --- TYPES ---
interface StudentProfile {
  level: string;
  lesson_credits: number;
  credits_reserved: number;
  available_credits: number;
}

interface TeacherProfile {
  bio: string;
  hourly_rate: number;
}

interface User {
  id: number;
  full_name: string;
  email: string;
  role?: string;
  is_superuser?: boolean;
  profile_picture_url?: string | null;
  student_profile?: StudentProfile;
  teacher_profile?: TeacherProfile;
}

interface Lesson {
  id: number;
  room_sid: string;
  teacher_name?: string;
  student_name?: string;
  start_time: string;
  end_time: string;
  status: string;
}

export default function DashboardPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [completedLessonsCount, setCompletedLessonsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userRes, lessonsRes] = await Promise.all([
          api.get('/api/me/'),
          api.get('/api/my-lessons/')
        ]);
        const fetchedUser = userRes.data as User;
        setUser(fetchedUser);
        setLessons(lessonsRes.data);

        // Fetch completed count from history only for teachers
        const role = fetchedUser.role?.toLowerCase();
        const isTeacherUser = role === 'teacher' || !!fetchedUser.teacher_profile || fetchedUser.is_superuser;
        if (isTeacherUser) {
          try {
            const historyRes = await api.get<{ status: string }[]>('/api/teacher/lesson-history/');
            const count = historyRes.data.filter(l => l.status === 'COMPLETED').length;
            setCompletedLessonsCount(count);
          } catch {
            // non-fatal — count stays 0
          }
        }
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      logout();
      navigate('/login');
    }
  };

  if (loading || !user) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  // Determine Role Logic
  const isTeacher =
    user.role?.toLowerCase() === 'teacher' ||
    !!user.teacher_profile ||
    user.is_superuser;

  return isTeacher ? (
    <TeacherDashboard user={user} lessons={lessons} completedLessonsCount={completedLessonsCount} onLogout={handleLogout} />
  ) : (
    <StudentDashboard user={user} lessons={lessons} onLogout={handleLogout} />
  );
}

// =========================================================
// 2. TEACHER DASHBOARD
// =========================================================
// =========================================================
// 2. TEACHER DASHBOARD
// =========================================================
function TeacherDashboard({ user, lessons, completedLessonsCount, onLogout }: { user: User, lessons: Lesson[], completedLessonsCount: number, onLogout: () => void }) {
  const navigate = useNavigate();
  const firstName = user.full_name.split(' ')[0];

  // --- ADDED STATE FOR SEE MORE ---
  const [showAll, setShowAll] = useState(false);


  const uniqueStudents = new Set(lessons.map(l => l.student_name).filter(Boolean)).size;

  // --- LOGIC TO SHOW ONLY 5 OR ALL ---
  const displayedLessons = showAll ? lessons : lessons.slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col fixed h-full z-10 top-0 left-0">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-blue-600 font-black text-xl tracking-tight">
            <div className="p-2 bg-blue-100 rounded-lg"><Briefcase size={20} /></div>
            TeacherPanel
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavItem icon={<Clock size={20} />} label="Schedule" active onClick={() => navigate('/dashboard')} />
          <NavItem icon={<Users size={20} />} label="My Students" onClick={() => navigate('/teacher/students')} />
          <NavItem icon={<FileText size={20} />} label="Lesson History" onClick={() => navigate('/teacher/history')} />

          <NavItem icon={<PenTool size={20} />} label="Builder" onClick={() => navigate('/teacher/create-lesson')} />
          <NavItem icon={<FileText size={20} />} label="Homework" onClick={() => navigate('/teacher/homework')} />
          <NavItem icon={<DollarSign size={20} />} label="Earnings" onClick={() => navigate('/teacher/earnings')} />
          <NavItem icon={<Settings size={20} />} label="Settings" onClick={() => navigate('/teacher/settings')} />

        </nav>
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <Avatar url={user.profile_picture_url} name={user.full_name} size={40} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{user.full_name}</p>
              <p className="text-xs text-slate-500 truncate">Teacher</p>
            </div>
            <button onClick={onLogout} className="text-slate-400 hover:text-red-500 transition-colors"><LogOut size={18} /></button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 mb-2">Hello, Teacher {firstName} 👋</h1>
            <p className="text-slate-500 font-medium">You have <span className="text-blue-600 font-bold">{lessons.length}</span> classes scheduled.</p>
          </div>
          <button onClick={() => navigate('/teacher/schedule')} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all flex items-center gap-2">
            <Calendar size={18} /> Manage Availability
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard label="Active Students" value={uniqueStudents} icon={<Users className="text-blue-500" />} trend="Total Unique" />
          <StatCard label="Lessons Taught" value={completedLessonsCount} icon={<Clock className="text-purple-500" />} trend="Completed" />
          <StatCard label="Hourly Rate" value={`$${user.teacher_profile?.hourly_rate || 0}`} icon={<DollarSign className="text-green-500" />} trend="Per Lesson" />
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2"><Calendar className="text-blue-600" /> Your Class Schedule</h3>
          {lessons.length === 0 ? (
            <EmptyState title="No classes scheduled" desc="Waiting for students to book a slot." icon={<Clock size={32} />} />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4">
                {displayedLessons.map(lesson => (
                  <LessonRow key={lesson.id} lesson={lesson} role="teacher" onAction={() => navigate(`/classroom/${lesson.room_sid}`)} />
                ))}
              </div>

              {/* --- SEE ALL BUTTON --- */}
              {lessons.length > 5 && (
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="w-full mt-4 py-3 border-2 border-slate-100 rounded-xl text-slate-500 font-bold hover:bg-slate-50 transition-all"
                >
                  {showAll ? "Show Less" : "See All Classes"}
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
// =========================================================
// 3. STUDENT DASHBOARD
// =========================================================
function StudentDashboard({ user, lessons, onLogout }: { user: User, lessons: Lesson[], onLogout: () => void }) {
  const navigate = useNavigate();
  const firstName = user.full_name.split(' ')[0];
  const credits = user.student_profile?.available_credits ?? user.student_profile?.lesson_credits ?? 0;
  const reserved = user.student_profile?.credits_reserved ?? 0;
  const nextLesson = lessons.length > 0 ? lessons[0] : null;

  // --- ADDED STATE FOR SEE MORE ---
  const [showAll, setShowAll] = useState(false);

  // --- LOGIC TO SHOW ONLY 5 OR ALL ---
  const displayedLessons = showAll ? lessons : lessons.slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col fixed h-full z-10 top-0 left-0">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-blue-600 font-black text-xl tracking-tight">
            <div className="p-2 bg-blue-100 rounded-lg"><Video size={20} /></div>
            OnlineSchool
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavItem icon={<BookOpen size={20} />} label="My Learning" active onClick={() => navigate('/dashboard')} />
          <NavItem icon={<Clock size={20} />} label="Book a Lesson" onClick={() => navigate('/find-teachers')} />
          <NavItem icon={<CreditCard size={20} />} label="Buy Credits" onClick={() => navigate('/buy-credits')} />
          <div onClick={() => navigate('/student/homework')}>
            <NavItem icon={<FileText size={20} />} label="Homework" />
          </div>
          <div onClick={() => navigate('/student/achievements')}>
            <NavItem icon={<Trophy size={20} />} label="Achievements" />
          </div>
          <div onClick={() => navigate('/student/goals')}>
            <NavItem icon={<Target size={20} />} label="Goals" />
          </div>
          <div onClick={() => navigate('/student/leaderboard')}>
            <NavItem icon={<Trophy size={20} />} label="Leaderboard" />
          </div>
          <div onClick={() => navigate('/student/profile')}>
            <NavItem icon={<Settings size={20} />} label="Profile" />
          </div>
        </nav>
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <Avatar url={user.profile_picture_url} name={user.full_name} size={40} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{user.full_name}</p>
              <p className="text-xs text-slate-500 truncate">Student</p>
            </div>
            <button onClick={onLogout} className="text-slate-400 hover:text-red-500 transition-colors"><LogOut size={18} /></button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 mb-2">Welcome back, {firstName} 🚀</h1>
            <p className="text-slate-500 font-medium">You have <span className="text-blue-600 font-bold">{credits} available credits</span>{reserved > 0 ? <span className="text-slate-400 text-sm"> ({reserved} reserved)</span> : null}.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate('/buy-credits')} className="bg-white border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 text-slate-600 px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition-all">
              <PlusCircle size={20} /> Refill Credits
            </button>
            <button onClick={() => navigate('/find-teachers')} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-all">
              <BookOpen size={20} /> Browse Teachers
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            label="Lesson Credits"
            value={credits}
            icon={<Wallet className="text-blue-600" />}
            trend={credits > 0 ? 'Available now' : 'Top up needed'}
            highlight={credits === 0}
          />
          <StatCard label="Current Level" value={user.student_profile?.level || "Beginner"} icon={<Trophy className="text-yellow-500" />} trend="Keep going!" />
          <StatCard
            label="Next Lesson"
            value={nextLesson ? formatDate(nextLesson.start_time) : "None"}
            icon={<Video className="text-purple-600" />}
            trend={nextLesson ? "Get ready!" : "Book now"}
          />
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2"><Calendar className="text-blue-600" /> Upcoming Schedule</h3>
          {lessons.length === 0 ? (
            <EmptyState
              title="No lessons booked"
              desc="Use your credits to start learning today!"
              icon={<PlayCircle size={32} />}
              action={<button onClick={() => navigate('/find-teachers')} className="text-blue-600 font-bold hover:underline">Find a Teacher &rarr;</button>}
            />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4">
                {displayedLessons.map((lesson) => (
                  <LessonRow key={lesson.id} lesson={lesson} role="student" onAction={() => navigate(`/classroom/${lesson.room_sid}`)} />
                ))}
              </div>

              {/* --- SEE ALL BUTTON --- */}
              {lessons.length > 5 && (
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="w-full mt-4 py-3 border-2 border-slate-100 rounded-xl text-slate-500 font-bold hover:bg-slate-50 transition-all"
                >
                  {showAll ? "Show Less" : "See All Classes"}
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
// --- SHARED UI COMPONENTS ---

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all cursor-pointer ${active ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
      {icon}
      <span>{label}</span>
      {active && <ChevronRight size={16} className="ml-auto" />}
    </div>
  );
}

function StatCard({ label, value, icon, trend, highlight = false }: { label: string, value: string | number, icon: React.ReactNode, trend: string, highlight?: boolean }) {
  return (
    <div className={`p-6 rounded-2xl border transition-all ${highlight ? 'bg-red-50 border-red-100 shadow-sm' : 'bg-white border-slate-200 hover:shadow-lg'}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-slate-50 rounded-xl">{icon}</div>
        <span className={`text-xs font-bold px-2 py-1 rounded-md ${highlight ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>{trend}</span>
      </div>
      <h3 className="text-3xl font-black text-slate-900 mb-1">{value}</h3>
      <p className="text-sm font-medium text-slate-400">{label}</p>
    </div>
  );
}

function LessonRow({ lesson, role, onAction }: { lesson: Lesson, role: 'teacher' | 'student', onAction: () => void }) {
  const isActive = new Date() >= new Date(lesson.start_time) && new Date() <= new Date(lesson.end_time);

  return (
    <div className={`p-6 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-6 transition-all ${isActive ? 'bg-blue-50 border-blue-200 shadow-md' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
      <div className="flex items-center gap-4 w-full md:w-auto">
        <div className={`h-16 w-16 rounded-2xl flex flex-col items-center justify-center font-bold shrink-0 ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
          <span className="text-xs uppercase opacity-80">{formatMonthShort(lesson.start_time)}</span>
          <span className="text-2xl">{formatDayNum(lesson.start_time)}</span>
        </div>
        <div>
          <h3 className="font-bold text-lg text-slate-900">{role === 'teacher' ? `Class with ${lesson.student_name || 'Student'}` : `Lesson with ${lesson.teacher_name || 'Teacher'}`}</h3>
          <p className="text-slate-500 font-medium text-sm flex items-center gap-2">
            <Clock size={14} /> {formatTime(lesson.start_time)}
            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
            1 Credit
          </p>
        </div>
      </div>
      <button onClick={onAction} className={`w-full md:w-auto px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 ${isActive ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
        <Video size={18} /> {isActive ? 'Join Now' : (role === 'teacher' ? 'Start Class' : 'Join Class')}
      </button>
    </div>
  );
}

function EmptyState({ title, desc, icon, action }: { title: string, desc: string, icon: React.ReactNode, action?: React.ReactNode }) {
  return (
    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
      <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-slate-400">{icon}</div>
      <h4 className="text-lg font-bold text-slate-900">{title}</h4>
      <p className="text-slate-500 mb-6">{desc}</p>
      {action}
    </div>
  );
}