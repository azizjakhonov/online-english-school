import { useState } from 'react';
import { 
  GraduationCap, 
  School, 
  Loader2 
} from 'lucide-react';
import api from '../../lib/api';

interface ApiError {
  response?: {
    data?: {
      error?: string;
    };
  };
}

export default function Login() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // DATA STATES
  const [phoneSuffix, setPhoneSuffix] = useState(''); 
  const [otp, setOtp] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'student' | 'teacher' | null>(null);

  const getFullPhone = () => `+998${phoneSuffix}`;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneSuffix.length !== 9) {
      setError('Iltimos, 9 xonali raqam kiriting');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/api/send-otp/', { phone: getFullPhone() });
      setStep(2); 
    } catch (err) {
      const errorObj = err as ApiError;
      setError(errorObj.response?.data?.error || 'Kod yuborishda xatolik');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/api/verify-otp/', { 
        phone: getFullPhone(), 
        code: otp 
      });
      
      const { access, refresh, is_new_user } = response.data;
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);

      if (is_new_user) {
        setStep(3);
      } else {
        window.location.href = '/dashboard';
      }
    } catch (err) {
      const errorObj = err as ApiError;
      setError(errorObj.response?.data?.error || 'Kod noto‘g‘ri');
    } finally {
      setLoading(false);
    }
  };

  const handleOnboarding = async () => {
    if (!role || !fullName) {
      setError('Hamma maydonlarni to‘ldiring');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/select-role/', { role, full_name: fullName });
      window.location.href = '/dashboard'; 
    } catch (err) {
      const errorObj = err as ApiError;
      setError(errorObj.response?.data?.error || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f0f4f8] relative overflow-hidden font-sans">
      {/* Abstract Background Pattern */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" 
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 86c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zm66-3c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zm-46-43c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zm20-17c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%233b82f6' fill-opacity='0.4' fill-rule='evenodd'/%3E%3C/svg%3E")` }}>
      </div>

      <div className="flex w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10 mx-4 min-h-[550px]">
        
        {/* Left Form Side */}
        <div className="w-full lg:w-1/2 p-10 flex flex-col justify-center">
          <div className="max-w-xs mx-auto w-full">
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2">
                {step === 1 && "Hisobingizga kiring"}
                {step === 2 && "Tasdiqlash"}
                {step === 3 && "Sozlamalar"}
            </h1>
            <p className="text-slate-500 text-sm mb-8">
                {step === 1 && "Telefon raqamingizni kiriting"}
                {step === 2 && `Kod ${getFullPhone()} raqamiga yuborildi`}
                {step === 3 && "Ma'lumotlaringizni kiriting"}
            </p>
            
            {error && (
              <div className="mb-6 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-medium animate-shake">
                {error}
              </div>
            )}

            {step === 1 && (
              <form onSubmit={handleSendOtp} className="space-y-6">
                <div className="group">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1 transition-colors group-focus-within:text-blue-500">
                    Telefon raqam
                  </label>
                  <div className="flex items-center bg-slate-50 border-2 border-slate-100 rounded-2xl group-focus-within:border-blue-500 group-focus-within:bg-white transition-all duration-200 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-4 bg-slate-100/50 border-r border-slate-200">
                      <span className="text-slate-600 font-bold">+998</span>
                    </div>
                    <input 
                      type="tel" 
                      placeholder="90 123 45 67"
                      maxLength={9}
                      className="w-full px-4 py-4 bg-transparent outline-none text-slate-800 font-bold text-lg placeholder:text-slate-300"
                      value={phoneSuffix}
                      onChange={(e) => setPhoneSuffix(e.target.value.replace(/\D/g, ''))}
                      required
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin mx-auto" /> : "Davom etish"}
                </button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div className="flex justify-between gap-2">
                  <input 
                    type="text" 
                    placeholder="•••••"
                    maxLength={5}
                    className="w-full text-center text-3xl font-black tracking-[0.5em] py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white outline-none transition-all"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    autoFocus
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg"
                >
                  {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Tasdiqlash'}
                </button>
                <button type="button" onClick={() => setStep(1)} className="w-full text-xs font-bold text-slate-400 hover:text-blue-500 transition-colors uppercase tracking-widest">
                  Raqamni o'zgartirish
                </button>
              </form>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <input 
                  type="text" 
                  placeholder="To'liq ismingiz"
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white outline-none transition-all font-medium"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => setRole('student')}
                        className={`p-5 border-2 rounded-2xl flex flex-col items-center gap-2 transition-all ${role === 'student' ? 'border-blue-500 bg-blue-50 text-blue-600 shadow-md shadow-blue-100' : 'border-slate-50 bg-slate-50 text-slate-400 opacity-60'}`}
                    >
                        <GraduationCap size={28} />
                        <span className="text-[10px] font-black uppercase tracking-tighter">O'quvchi</span>
                    </button>
                    <button 
                        onClick={() => setRole('teacher')}
                        className={`p-5 border-2 rounded-2xl flex flex-col items-center gap-2 transition-all ${role === 'teacher' ? 'border-blue-500 bg-blue-50 text-blue-600 shadow-md shadow-blue-100' : 'border-slate-50 bg-slate-50 text-slate-400 opacity-60'}`}
                    >
                        <School size={28} />
                        <span className="text-[10px] font-black uppercase tracking-tighter">O'qituvchi</span>
                    </button>
                </div>
                <button 
                  onClick={handleOnboarding}
                  disabled={loading}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-100 transition-all mt-4"
                >
                  Tizimga kirish
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Design Side */}
        <div className="hidden lg:flex w-1/2 bg-blue-600 relative items-center justify-center overflow-hidden">
            <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-80 h-80 bg-blue-400/20 rounded-full blur-3xl"></div>
            
            <div className="relative z-10 text-center p-12">
                <div className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-3xl rotate-12 flex items-center justify-center mx-auto mb-8 border border-white/30 shadow-2xl">
                    <div className="w-12 h-12 bg-white rounded-xl -rotate-12 flex items-center justify-center">
                        <div className="w-6 h-6 bg-blue-600 rounded-sm"></div>
                    </div>
                </div>
                <h2 className="text-3xl font-black text-white mb-4">OnlineSchool</h2>
                <p className="text-blue-100 text-sm font-medium leading-relaxed">
                  O'quv jarayonini biz bilan <br/> yangi bosqichga olib chiqing.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
}