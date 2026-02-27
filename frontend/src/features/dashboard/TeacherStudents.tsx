import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, Mail, Calendar, MoreHorizontal,
  ArrowLeft, Loader2, BookOpen
} from 'lucide-react';
import api from '../../lib/api';
import Avatar from '../../components/Avatar';
import { formatDate } from '../../utils/datetime';

interface Lesson {
  id: number;
  student_name: string;
  student_profile_picture_url?: string | null;
  start_time: string;
  status: string;
}

interface StudentStat {
  name: string;
  profile_picture_url: string | null;
  total_lessons: number;
  last_seen: string;
}

export default function TeacherStudents() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentStat[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // We fetch lessons to derive the student list
        // (In a real app, you might have a dedicated /api/my-students/ endpoint)
        const res = await api.get('/api/my-lessons/');
        const lessons: Lesson[] = res.data;

        // Logic to group lessons by student name
        const studentMap = new Map<string, StudentStat>();

        lessons.forEach(lesson => {
          if (!lesson.student_name) return;

          if (!studentMap.has(lesson.student_name)) {
            studentMap.set(lesson.student_name, {
              name: lesson.student_name,
              profile_picture_url: lesson.student_profile_picture_url ?? null,
              total_lessons: 0,
              last_seen: lesson.start_time,
            });
          }

          const stat = studentMap.get(lesson.student_name)!;
          stat.total_lessons += 1;
          // Update last_seen if this lesson is newer
          if (new Date(lesson.start_time) > new Date(stat.last_seen)) {
            stat.last_seen = lesson.start_time;
          }
        });

        setStudents(Array.from(studentMap.values()));
      } catch (err) {
        console.error("Failed to load students", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalLessons = students.reduce((sum, s) => sum + s.total_lessons, 0);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header — same pattern as TeacherLessonHistory */}
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
            <Users size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">My Students</h1>
            <p className="text-xs text-slate-500 font-medium">Manage the students you are currently teaching</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats bar — same card style as TeacherLessonHistory */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-xl shrink-0 bg-blue-50 text-blue-600">
              <Users size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Students</p>
              <p className="text-2xl font-black text-slate-900">{students.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-xl shrink-0 bg-green-50 text-green-600">
              <BookOpen size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Lessons</p>
              <p className="text-2xl font-black text-slate-900">{totalLessons}</p>
            </div>
          </div>
        </div>

        {/* Search — same as TeacherLessonHistory filter bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6">
          <div className="relative flex-1 min-w-0">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search students by name…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center py-24">
              <Loader2 size={36} className="animate-spin text-blue-600" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-16 text-center">
              <Users size={48} className="mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-bold text-slate-900 mb-1">No students found</h3>
              <p className="text-slate-500 text-sm">
                {students.length === 0
                  ? 'Once you schedule classes, your students will appear here.'
                  : 'Try adjusting your search.'}
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-50">
                {filteredStudents.map((student, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-4 px-6 py-4 group hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <Avatar
                        url={student.profile_picture_url}
                        name={student.name}
                        size={40}
                        className="border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900 text-sm truncate">{student.name}</h3>
                        <div className="flex items-center gap-4 text-xs text-slate-500 mt-0.5">
                          <span className="flex items-center gap-1">
                            <BookOpen size={13} /> {student.total_lessons} lessons
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar size={13} /> Last: {formatDate(student.last_seen)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                        title="Message"
                      >
                        <Mail size={18} />
                      </button>
                      <button
                        type="button"
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-1"
                        title="More options"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-400 font-medium">
                  Showing {filteredStudents.length} of {students.length} students
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}