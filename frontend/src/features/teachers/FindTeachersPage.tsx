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
  hourly_rate: string;
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
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ChevronLeft size={20} className="text-slate-500" />
          </button>
          <h1 className="text-lg font-bold">Find a Teacher</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-8">
        
        {/* SEARCH BAR */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Search by name or subject (e.g. English, Math)..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-600 focus:outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-500">Loading teachers...</p>
          </div>
        )}

        {/* EMPTY STATE */}
        {!loading && filteredTeachers.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
            <p className="text-lg font-bold text-slate-700">No teachers found</p>
            <p className="text-slate-500">Try adjusting your search terms.</p>
          </div>
        )}

        {/* TEACHER GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTeachers.map((teacher) => (
            <div 
              key={teacher.id} 
              onClick={() => navigate(`/teacher/${teacher.id}`)} // <--- ADDED CLICK HANDLER
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all group cursor-pointer"
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

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-bold">
                     <Clock size={14} />
                     {teacher.lessons_taught} lessons
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-slate-900">${teacher.hourly_rate}</span>
                    <span className="text-xs text-slate-400 font-medium">/hr</span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 p-3 text-center text-sm font-bold text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                View Profile
              </div>
            </div>
          ))}
        </div>

      </main>
    </div>
  );
}