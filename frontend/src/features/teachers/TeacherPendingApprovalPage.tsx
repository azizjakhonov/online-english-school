import { useNavigate } from 'react-router-dom';
import { Clock, LogOut, School, CheckCircle, Mail } from 'lucide-react';

export default function TeacherPendingApprovalPage() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/teacher/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        {/* Amber clock icon */}
        <div className="w-20 h-20 bg-amber-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
          <Clock size={40} className="text-amber-600" />
        </div>

        <h1 className="text-2xl font-black text-slate-900 mb-2">Pending Approval</h1>
        <p className="text-slate-500 font-medium mb-8 leading-relaxed">
          Your teacher account is currently under review. An admin will activate your account once verified.
          This usually takes 1–2 business days.
        </p>

        {/* Progress steps */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-left mb-6 space-y-4">
          {[
            {
              icon: CheckCircle,
              colorClass: 'text-emerald-600 bg-emerald-100',
              text: 'Profile submitted successfully',
              done: true,
            },
            {
              icon: Clock,
              colorClass: 'text-amber-600 bg-amber-100',
              text: 'Admin review in progress…',
              done: false,
            },
            {
              icon: School,
              colorClass: 'text-slate-400 bg-slate-100',
              text: 'Account activated — start teaching!',
              done: false,
            },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${step.colorClass}`}>
                <step.icon size={18} />
              </div>
              <span className={`text-sm font-bold ${step.done ? 'text-slate-900' : 'text-slate-400'}`}>
                {step.text}
              </span>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-400 font-medium mb-6 flex items-center justify-center gap-1.5">
          <Mail size={14} /> We'll notify you when your account is active.
        </p>

        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
        >
          <LogOut size={16} /> Log Out
        </button>
      </div>
    </div>
  );
}
