import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { School, Loader2, ArrowLeft, UserPlus } from 'lucide-react';
import api from '../../lib/api';

interface ApiError {
  response?: { data?: { error?: string } };
}

import { usePageTitle } from '../../lib/usePageTitle';

export default function TeacherRegisterPage() {
  usePageTitle('Teacher Registration');
  const navigate = useNavigate();
  const [phoneSuffix, setPhoneSuffix] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneSuffix.length !== 9) {
      setError('Please enter a valid 9-digit phone number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const phone = `+998${phoneSuffix}`;
      await api.post('/api/send-otp/', { phone });
      navigate('/teacher/verify-otp', { state: { phone, from: 'register' } });
    } catch (err) {
      const e = err as ApiError;
      setError(e.response?.data?.error || 'Failed to send code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-700 mb-6 transition-colors uppercase tracking-widest"
        >
          <ArrowLeft size={16} /> Main Login
        </Link>

        <div className="bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
          <div className="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center mb-6">
            <UserPlus size={28} className="text-violet-600" />
          </div>

          <h1 className="text-2xl font-black text-slate-900 mb-1">Create Teacher Account</h1>
          <p className="text-sm text-slate-500 font-medium mb-2">
            Join OnlineSchool as a teacher
          </p>

          {/* Benefits */}
          <div className="flex flex-wrap gap-2 mb-6">
            {['Flexible schedule', 'Student management', 'Earnings tracking'].map((b) => (
              <span key={b} className="text-xs font-bold bg-violet-50 text-violet-700 px-2.5 py-1 rounded-lg">
                {b}
              </span>
            ))}
          </div>

          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                Phone Number
              </label>
              <div className="flex items-center bg-slate-50 border-2 border-slate-100 rounded-2xl focus-within:border-violet-500 focus-within:bg-white transition-all overflow-hidden">
                <div className="px-4 py-3.5 bg-slate-100/60 border-r border-slate-200 shrink-0">
                  <span className="text-slate-700 font-bold">+998</span>
                </div>
                <input
                  type="tel"
                  placeholder="90 123 45 67"
                  maxLength={9}
                  className="flex-1 px-4 py-3.5 bg-transparent outline-none text-slate-900 font-bold text-lg placeholder:text-slate-300"
                  value={phoneSuffix}
                  onChange={(e) => setPhoneSuffix(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-3.5 rounded-2xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-violet-100"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : 'Send Verification Code'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 font-medium mt-4 leading-relaxed">
            By registering, you agree to our Terms of Service.
            After completing your profile, an admin will review and activate your account.
          </p>

          <p className="text-center text-sm text-slate-500 mt-4">
            Already have an account?{' '}
            <Link to="/teacher/login" className="font-bold text-blue-600 hover:underline">
              Sign in
            </Link>
          </p>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-center gap-2">
            <School size={16} className="text-slate-400" />
            <p className="text-xs text-slate-400 font-medium">
              Looking to learn?{' '}
              <Link to="/login" className="text-blue-600 font-bold hover:underline">
                Student login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
