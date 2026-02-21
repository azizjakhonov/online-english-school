import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Upload, 
  LogOut, 
  BookOpen, 
  ShieldCheck, 
  FileText, 
  PlusCircle // FIX: Added this missing import
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext'; 

export default function AdminLayout() {
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Separated navItems to distinguish between "Library/Management" and "Creation"
  const navItems = [
    { label: 'Manage Lessons', path: '/admin/lessons', icon: BookOpen },
    { label: 'Create Lesson', path: '/admin/lessons/create', icon: PlusCircle },
    { label: 'Homework Library', path: '/admin/homeworks', icon: FileText },
    { label: 'Upload Materials', path: '/admin/upload', icon: Upload },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      
      {/* SIDEBAR - Teacher Dashboard Style */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col fixed h-full z-10 transition-all">
        
        {/* Logo Area */}
        <div className="p-8 pb-4">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <ShieldCheck size={28} strokeWidth={2.5} />
            <h1 className="text-2xl font-black tracking-tighter text-slate-900">AdminPanel</h1>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Control Center</p>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-2 mt-4">
          
          <Link
            to="/dashboard"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 font-medium hover:bg-slate-50 transition-colors mb-6 border border-transparent hover:border-slate-200"
          >
            <LayoutDashboard size={20} />
            <span>Exit to App</span>
          </Link>

          <div className="text-xs font-bold text-slate-400 px-4 mb-2 uppercase tracking-widest">Administration</div>

          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-bold ${
                  isActive 
                    ? 'bg-blue-50 text-blue-600 shadow-sm shadow-blue-100' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 text-red-500 font-bold hover:bg-red-50 w-full rounded-xl transition-colors"
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* This is where AdminLessons, AdminLessonCreate, etc. will render */}
          <Outlet />
        </div>
      </main>
      
    </div>
  );
}