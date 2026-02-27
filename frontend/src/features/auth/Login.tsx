import { useState, useEffect, useRef, memo, useCallback } from 'react';
import {
  GraduationCap,
  School,
  Loader2
} from 'lucide-react';
import api from '../../lib/api';

declare global {
  interface Window {
    onTelegramAuth: (user: any) => void;
    google?: {
      accounts: {
        id: {
          initialize: (config: object) => void;
          renderButton: (el: HTMLElement, config: object) => void;
        };
      };
    };
  }
}

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

  // Social linking — set when Google/Telegram returns 202 (phone required)
  const [pendingSocialToken, setPendingSocialToken] = useState<string | null>(null);
  const [pendingSocialProvider, setPendingSocialProvider] = useState<'google' | 'telegram' | null>(null);



  // Shared helper: store tokens & advance flow
  const finishLogin = (access: string, refresh: string, is_new_user: boolean) => {
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    setPendingSocialToken(null);
    setPendingSocialProvider(null);
    if (is_new_user) {
      setStep(3);
    } else {
      window.location.href = '/dashboard';
    }
  };

  const handleGoogleLogin = async (idToken: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/api/auth/google/', { id_token: idToken });
      if (response.status === 202) {
        setPendingSocialToken(response.data.social_token);
        setPendingSocialProvider('google');
        setStep(1);
        return;
      }
      const { access, refresh, is_new_user } = response.data;
      finishLogin(access, refresh, is_new_user);
    } catch (err) {
      const e = err as ApiError;
      setError(e.response?.data?.error || 'Google orqali kirishda xatolik');
    } finally {
      setLoading(false);
    }
  };

  const handleTelegramLogin = async (user: any) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/api/auth/telegram/web/verify/', user);
      if (response.status === 202) {
        setPendingSocialToken(response.data.social_token);
        setPendingSocialProvider('telegram');
        setStep(1);
        return;
      }
      const { access, refresh, is_new_user } = response.data;
      finishLogin(access, refresh, is_new_user);
    } catch (err) {
      const e = err as ApiError;
      setError(e.response?.data?.error || 'Telegram orqali kirishda xatolik');
    } finally {
      setLoading(false);
    }
  };

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
      const e = err as ApiError;
      setError(e.response?.data?.error || 'Kod yuborishda xatolik');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload: Record<string, string> = { phone: getFullPhone(), code: otp };
      if (pendingSocialToken) payload.social_token = pendingSocialToken;

      const response = await api.post('/api/verify-otp/', payload);
      const { access, refresh, is_new_user } = response.data;
      finishLogin(access, refresh, is_new_user);
    } catch (err) {
      const e = err as ApiError;
      setError(e.response?.data?.error || "Kod noto'g'ri");
    } finally {
      setLoading(false);
    }
  };

  const handleOnboarding = async () => {
    if (!role || !fullName) {
      setError("Hamma maydonlarni to'ldiring");
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/select-role/', { role, full_name: fullName });
      window.location.href = '/dashboard';
    } catch (err) {
      const e = err as ApiError;
      setError(e.response?.data?.error || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const providerLabel = pendingSocialProvider === 'google' ? 'Google' : 'Telegram';

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
            <p className="text-slate-500 text-sm mb-6">
              {step === 1 && (pendingSocialProvider
                ? `${providerLabel} hisobingizni ulash uchun telefon raqamingizni kiriting`
                : "Telefon raqamingizni kiriting"
              )}
              {step === 2 && `Kod ${getFullPhone()} raqamiga yuborildi`}
              {step === 3 && "Ma'lumotlaringizni kiriting"}
            </p>

            {/* Social linking banner */}
            {step === 1 && pendingSocialProvider && (
              <div className="mb-5 p-3 bg-blue-50 border-l-4 border-blue-500 text-blue-700 text-xs font-medium rounded-r-lg">
                {providerLabel} hisobingiz yangi. Telefon raqamingizni tasdiqlang — keyin avtomatik bog'lanadi.
              </div>
            )}

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

                {/* Social buttons — hidden while a social link is pending */}
                {!pendingSocialProvider && (
                  <>
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-100"></div>
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-4 text-slate-400 font-bold tracking-widest">Yoki</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <GoogleSignInButton onCredential={handleGoogleLogin} disabled={loading} />
                      <TelegramLoginButton disabled={loading} onAuth={handleTelegramLogin} />
                    </div>
                  </>
                )}

                {/* Cancel pending social link */}
                {pendingSocialProvider && (
                  <button
                    type="button"
                    onClick={() => {
                      setPendingSocialToken(null);
                      setPendingSocialProvider(null);
                      setError('');
                    }}
                    className="w-full text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-widest"
                  >
                    Bekor qilish
                  </button>
                )}
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
              O'quv jarayonini biz bilan <br /> yangi bosqichga olib chiqing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Google Sign-In Button (Google Identity Services) ────────────────────────
// Renders the GIS button in a hidden off-screen div so the auth callback works,
// then exposes a custom-styled button that programmatically clicks the hidden one.
const GoogleSignInButton = memo(function GoogleSignInButton({
  onCredential,
  disabled,
}: {
  onCredential: (credential: string) => void;
  disabled?: boolean;
}) {
  const hiddenRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);

  useEffect(() => { callbackRef.current = onCredential; });

  useEffect(() => {
    const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID as string | undefined;
    if (!clientId) return;

    const init = () => {
      if (!window.google?.accounts?.id || !hiddenRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: ({ credential }: { credential: string }) => callbackRef.current(credential),
      });
      window.google.accounts.id.renderButton(hiddenRef.current, {
        theme: 'filled_blue',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 400,
      });
    };

    if (window.google?.accounts) {
      init();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener('load', init);
      return () => existing.removeEventListener('load', init);
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = init;
    document.head.appendChild(script);
    return () => { script.remove(); };
  }, []);

  const handleClick = useCallback(() => {
    const btn = hiddenRef.current?.querySelector<HTMLElement>('[role="button"], button, div[tabindex]');
    btn?.click();
  }, []);

  return (
    <div className={`w-full transition-opacity ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Hidden GIS-rendered button — keeps the real auth click handler alive */}
      <div
        ref={hiddenRef}
        style={{ position: 'absolute', top: 0, left: 0, visibility: 'hidden', width: 400, height: 44, pointerEvents: 'none' }}
      />
      {/* Custom button styled to match "Davom etish" */}
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="w-full bg-white hover:bg-gray-50 text-gray-700 font-bold py-4 rounded-2xl shadow-lg border border-gray-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-1 flex items-center justify-center gap-3"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Google orqali kirish
      </button>
    </div>
  );
});

// ─── Telegram Login Button ───────────────────────────────────────────────────
// Trigger button opens a styled modal. The real Telegram widget lives off-screen
// so its auth callback works. "Telegramni ochish" inside the modal clicks it.
const TG_SVG = (size = 20) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="white" aria-hidden="true">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z" />
  </svg>
);

const TelegramLoginButton = memo(function TelegramLoginButton({
  disabled,
  onAuth,
}: {
  disabled?: boolean;
  onAuth: (user: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const callbackRef = useRef(onAuth);

  useEffect(() => {
    callbackRef.current = onAuth;
  });

  useEffect(() => {
    // Expose the global callback required by Telegram widget
    window.onTelegramAuth = (user: any) => {
      setOpen(false);
      callbackRef.current(user);
    };
    return () => {
      delete (window as any).onTelegramAuth;
    };
  }, []);

  return (
    <>
      {/* Styled trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="w-full bg-[#229ED9] hover:bg-[#1a8bc4] text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#229ED9] focus:ring-offset-1 flex items-center justify-center gap-3"
      >
        {TG_SVG(20)}
        Telegram orqali kirish
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Card */}
          <div
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xs p-8 flex flex-col items-center gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-2xl leading-none"
            >
              ×
            </button>

            {/* Telegram icon badge */}
            <div className="w-16 h-16 bg-[#229ED9] rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
              {TG_SVG(32)}
            </div>

            {/* Title + description */}
            <div className="text-center space-y-1">
              <h3 className="text-xl font-extrabold text-slate-800">Telegram orqali kirish</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Telegram ilovangizda tasdiqlash uchun pastdagi tugmani bosing.
              </p>
            </div>

            {/* CTA - The actual Telegram Widget */}
            <div className="w-full flex justify-center min-h-[40px] items-center">
              <TelegramWidget />
            </div>

            {/* Cancel */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-widest mt-2"
            >
              Bekor qilish
            </button>
          </div>
        </div>
      )}
    </>
  );
});

function TelegramWidget() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', 'educator_supportbot');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '16');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;
    containerRef.current.appendChild(script);
  }, []);

  return <div ref={containerRef} />;
}
