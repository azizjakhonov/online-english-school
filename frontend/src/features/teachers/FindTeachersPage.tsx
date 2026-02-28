import { useState, useEffect } from 'react';
import { Search, Star, Clock, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import Avatar from '../../components/Avatar';

interface Teacher {
  id: number;
  user: {
    full_name: string;
    profile_picture_url?: string | null;
  };
  headline: string;
  bio: string;
  rating: number;
  lessons_taught: number;
  is_accepting_students: boolean;
}

export default function FindTeachersPage() {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    try {
      // Fetch the list from our backend
      const { data } = await api.get('/api/teachers/');
      setTeachers(data);
    } catch (err) {
      console.error("Failed to load teachers", err);
    } finally {
      setLoading(false);
    }
  };

  // Filter teachers based on search
  const filteredTeachers = teachers.filter(t => 
    t.user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.headline.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header — same pattern as TeacherLessonHistory */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-center gap-4 sticky top-0 z-20">
        <button
          onClick={() => navigate('/dashboard')}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          title="Back to dashboard"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-100 rounded-xl text-blue-600 shrink-0">
            <Search size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Find a Teacher</h1>
            <p className="text-xs text-slate-500 font-medium">Browse and book lessons with our teachers</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Search bar — same card style as TeacherLessonHistory filters */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-8">
          <div className="relative flex-1 min-w-0">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or subject…"
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-24">
            <div className="flex flex-col items-center gap-3">
              <div className="h-9 w-9 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-500 font-medium">Loading teachers…</p>
            </div>
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-16 text-center">
              <Search size={48} className="mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-bold text-slate-900 mb-1">No teachers found</h3>
              <p className="text-slate-500 text-sm">Try adjusting your search terms.</p>
            </div>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTeachers.map((teacher) => (
            <div
              key={teacher.id}
              onClick={() => navigate(`/teacher/${teacher.id}`)}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:border-slate-300 transition-colors group cursor-pointer"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <Avatar
                    url={teacher.user.profile_picture_url}
                    name={teacher.user.full_name}
                    size={56}
                  />
                  <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg">
                    <Star size={14} className="text-yellow-500 fill-yellow-500" />
                    <span className="text-xs font-bold text-yellow-700">{teacher.rating}</span>
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-slate-900 mb-1">{teacher.user.full_name}</h3>
                <p className="text-sm text-blue-600 font-medium mb-3 line-clamp-1">{teacher.headline || "Professional Teacher"}</p>
                <p className="text-sm text-slate-500 line-clamp-2 mb-6 h-10">{teacher.bio || "No bio yet."}</p>

                <div className="flex items-center pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-bold">
                     <Clock size={14} />
                     {teacher.lessons_taught} lessons taught
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 p-3 text-center text-sm font-bold text-blue-600 group-hover:bg-blue-100 transition-colors border-t border-slate-100">
                View Profile
              </div>
            </div>
          ))}
        </div>
        )}
      </main>
    </div>
  );
}