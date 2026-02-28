import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Loader2, ArrowLeft, MessageSquare } from 'lucide-react';
import api from '../../lib/api';

interface ApiError {
  response?: { data?: { error?: string } };
}

export default function TeacherVerifyOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const phone: string = location.state?.phone || '';
  const from: string = location.state?.from || 'login';

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!phone) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-500 mb-4">No phone number provided.</p>
          <Link to="/teacher/login" className="text-blue-600 font-bold hover:underline">
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/api/verify-otp/', { phone, code: otp });
      const { access, refresh, is_new_user } = res.data;
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);

      if (is_new_user) {
        navigate('/teacher/onboarding', { replace: true });
      } else {
        // Check teacher approval status
        const meRes = await api.get('/api/me/');
        const teacherProfile = meRes.data.teacher_profile;
        const status = teacherProfile?.status;
        // If status field not present or is 'active', go to dashboard
        if (!status || status === 'active') {
          window.location.href = '/dashboard';
        } else {
          navigate('/teacher/pending-approval', { replace: true });
        }
      }
    } catch (err) {
      const e = err as ApiError;
      setError(e.response?.data?.error || 'Incorrect code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const backTo = from === 'register' ? '/teacher/register' : '/teacher/login';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          to={backTo}
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-700 mb-6 transition-colors uppercase tracking-widest"
        >
          <ArrowLeft size={16} /> Back
        </Link>

        <div className="bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
          <div className="w-14 h-14 bg-teal-100 rounded-2xl flex items-center justify-center mb-6">
            <MessageSquare size={28} className="text-teal-600" />
          </div>

          <h1 className="text-2xl font-black text-slate-900 mb-1">Enter the Code</h1>
          <p className="text-sm text-slate-500 font-medium mb-8">
            We sent a 5-digit verification code to{' '}
            <span className="font-bold text-slate-700">{phone}</span>
          </p>

          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-5">
            <input
              type="text"
              placeholder="•••••"
              maxLength={5}
              className="w-full text-center text-3xl font-black tracking-[0.5em] py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white outline-none transition-all"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              autoFocus
            />

            <button
              type="submit"
              disabled={loading || otp.length < 4}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : 'Verify Code'}
            </button>

            <button
              type="button"
              onClick={() => navigate(backTo)}
              className="w-full text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors uppercase tracking-widest"
            >
              Change phone number
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
