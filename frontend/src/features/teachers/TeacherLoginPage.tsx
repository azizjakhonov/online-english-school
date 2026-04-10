import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { School, Loader2, ArrowLeft } from 'lucide-react';
import api from '../../lib/api';

interface ApiError {
  response?: { data?: { error?: string } };
}

import { usePageTitle } from '../../lib/usePageTitle';

export default function TeacherLoginPage() {
  usePageTitle('Teacher Sign In');
  const navigate = useNavigate();
  const [phoneSuffix, setPhoneSuffix] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneSuffix.length !== 9) {
      setError('Iltimos, 9 xonali telefon raqami kiriting');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const phone = `+998${phoneSuffix}`;
      await api.post('/api/send-otp/', { phone });
      navigate('/teacher/verify-otp', {
        state: {
          phone,
          from: 'login',
        }
      });
    } catch (err) {
      const e = err as ApiError;
      setError(e.response?.data?.error || 'Kod yuborishda xatolik yuz berdi.');
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
          <ArrowLeft size={16} /> Asosiy kirish
        </Link>

        <div className="bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
          <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
            <School size={28} className="text-blue-600" />
          </div>

          <h1 className="text-2xl font-black text-slate-900 mb-1">O'qituvchi kirishi</h1>
          <p className="text-sm text-slate-500 font-medium mb-8">
            O'qituvchi hisobingizga kirish uchun telefon raqamingizni kiriting
          </p>

          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                Telefon raqam
              </label>
              <div className="flex items-center bg-slate-50 border-2 border-slate-100 rounded-2xl focus-within:border-blue-500 focus-within:bg-white transition-all overflow-hidden">
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
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : 'Tasdiqlash kodini yuborish'}
            </button>

          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Yangi o'qituvchimisiz?{' '}
            <Link to="/teacher/register" className="font-bold text-blue-600 hover:underline">
              Ro'yxatdan o'tish
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

