import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, BookOpen, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import Avatar from '../../components/Avatar';

interface Props {
  children: ReactNode;
  userRole?: string; // 'student' or 'teacher'
}

export default function DashboardLayout({ children, userRole = 'student' }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col fixed h-full">
        {/* Logo Area */}
        <div className="h-16 flex items-center px-8 border-b border-gray-100">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
            <span className="text-white font-bold text-lg">O</span>
          </div>
          <span className="font-bold text-gray-800 text-lg">OnlineSchool</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active />
          <NavItem icon={<BookOpen size={20} />} label="My Lessons" />
          {userRole === 'teacher' && <NavItem icon={<Users size={20} />} label="Students" />}
          <NavItem icon={<Settings size={20} />} label="Settings" />
        </nav>

        {/* User Profile (Bottom) */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 text-gray-500 hover:text-red-600 transition-colors w-full px-4 py-2"
          >
            <LogOut size={20} />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col md:ml-64">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <h2 className="text-xl font-semibold text-gray-800">Dashboard</h2>
          <div className="flex items-center gap-4">
            <Avatar
              url={user?.profile_picture_url}
              name={user?.full_name ?? (userRole === 'student' ? 'Student' : 'Teacher')}
              size={40}
              className="border border-blue-200"
            />
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

// Helper Component for Menu Items
function NavItem({ icon, label, active = false }: { icon: ReactNode, label: string, active?: boolean }) {
  return (
    <button className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active
        ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm'
        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}>
      {icon}
      <span>{label}</span>
    </button>
  );
}