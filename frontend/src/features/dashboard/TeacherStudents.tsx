import React, { useState, useEffect } from 'react';
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

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 p-8">

      {/* Header */}
      <header className="max-w-5xl mx-auto mb-8 flex items-center gap-4">
        <button onClick={() => navigate('/dashboard')} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-black text-slate-900">My Students</h1>
          <p className="text-slate-500 font-medium">Manage the students you are currently teaching.</p>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto">

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Search students by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
        ) : filteredStudents.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
            <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mb-4">
              <Users size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No students found</h3>
            <p className="text-slate-500">Once you schedule classes, your students will appear here.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredStudents.map((student, idx) => (
              <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 transition-all flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <Avatar url={student.profile_picture_url} name={student.name} size={48} />
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{student.name}</h3>
                    <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                      <span className="flex items-center gap-1"><BookOpen size={14} /> {student.total_lessons} Lessons</span>
                      <span className="flex items-center gap-1"><Calendar size={14} /> Last: {formatDate(student.last_seen)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Message">
                    <Mail size={20} />
                  </button>
                  <button className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
                    <MoreHorizontal size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}