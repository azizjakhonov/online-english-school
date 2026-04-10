import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Avatar from '../../components/Avatar';
import {
  ChevronLeft,
  ChevronRight,
  Star,
  Clock,
  ShieldCheck,
  Play,
  Lock,
  AlertCircle,
  Calendar as CalendarIcon,
  CreditCard,
  X,
  CheckCircle,
  AlertTriangle,
  Info,
  Loader2
} from 'lucide-react';
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  isSameDay,
  addHours,
  isBefore
} from 'date-fns';
import api from '../../lib/api';
import { useAuth } from '../auth/AuthContext';

// --- CONFIGURATION ---
const START_HOUR = 6;
const END_HOUR = 23;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR);
const ROW_HEIGHT = 60;

// Proficiency → colour
const PROF_META: Record<string, { pill: string; dot: string; label: string }> = {
  Native: { pill: 'bg-violet-100 text-violet-700 border-violet-200', dot: 'bg-violet-500', label: 'Native' },
  Fluent: { pill: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'Fluent' },
  Intermediate: { pill: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500', label: 'Intermediate' },
  Basic: { pill: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-400', label: 'Basic' },
};
const getProfMeta = (p: string) => PROF_META[p] ?? { pill: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400', label: p };
const PROF_ORDER: Record<string, number> = { Native: 4, Fluent: 3, Intermediate: 2, Basic: 1 };

// --- TYPES ---
interface Subject {
  id: number;
  name: string;
}

interface Language {
  language: string;
  proficiency: string;
}

interface Certificate {
  certificate_name: string;
  score?: string;
  issued_date?: string;
  certificate_file_url?: string;
}

interface Teacher {
  id: number;
  user: { full_name: string; profile_picture_url?: string | null };
  headline: string;
  bio: string;
  rating: number;
  lessons_taught: number;
  youtube_intro_url?: string;
  is_accepting_students: boolean;
  subjects: Subject[];
  languages: Language[];
  language_certificates: Certificate[];
}

interface CurrentUser {
  id: number;
  student_profile?: {
    lesson_credits: number;
    credits_reserved?: number;
    available_credits?: number;
  };
}

interface AvailabilityRule {
  id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface ExistingBooking {
  start_time: string;
  end_time: string;
  status?: string;
}

interface ModalState {
  isOpen: boolean;
  type: 'success' | 'error' | 'confirm' | 'no-credits' | 'info';
  title: string;
  message: string;
}

interface PendingSlot {
  slotStart: Date;
  slotEnd: Date;
  key: string;
}

// --- HELPER: YouTube ---
const getYouTubeVideoId = (url: string) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

// --- LOGIC: Consistent Slot Key ---
const getSlotKey = (dateObj: Date) => {
  const y = dateObj.getFullYear();
  const m = dateObj.getMonth();
  const d = dateObj.getDate();
  const h = dateObj.getHours();
  return `${y}-${m}-${d}-${h}`;
};

import { usePageTitle } from '../../lib/usePageTitle';

export default function TeacherProfilePage() {
  usePageTitle('Teacher Profile');
  const { id } = useParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  // Data State
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [availability, setAvailability] = useState<AvailabilityRule[]>([]);
  const [bookedKeys, setBookedKeys] = useState<Set<string>>(new Set());

  // UI State
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Modal & Action State
  const [modal, setModal] = useState<ModalState>({ isOpen: false, type: 'info', title: '', message: '' });
  const [pendingSlot, setPendingSlot] = useState<PendingSlot | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- DATA FETCHING ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [teacherRes, availRes, meRes] = await Promise.all([
          api.get(`/api/teachers/${id}/`),
          api.get(`/api/availability/${id}/`),
          api.get('/api/me/')
        ]);

        setTeacher(teacherRes.data);
        setAvailability(availRes.data);
        setCurrentUser(meRes.data);

        try {
          const bookingRes = await api.get(`/api/bookings/?teacher_id=${id}`);
          const takenSet = new Set<string>();
          if (Array.isArray(bookingRes.data)) {
            bookingRes.data.forEach((booking: ExistingBooking) => {
              if (booking.status === 'CANCELLED') return;
              const bookedDate = new Date(booking.start_time);
              const key = getSlotKey(bookedDate);
              takenSet.add(key);
            });
          }
          setBookedKeys(takenSet);
        } catch (bookingErr) {
          console.warn("Could not load bookings", bookingErr);
        }

      } catch (err) {
        console.error("Critical error loading profile:", err);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchData();
  }, [id]);

  // --- STEP 1: GRID CLICK HANDLER (Validation) ---
  const handleGridClick = (date: Date, hour: number) => {
    if (isProcessing) return;

    const slotStart = new Date(date);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = addHours(slotStart, 1);
    const key = getSlotKey(slotStart);

    // 1. Validate: Past Date
    if (isBefore(slotStart, new Date())) {
      setModal({ isOpen: true, type: 'error', title: 'Invalid Slot', message: 'You cannot book lessons in the past.' });
      return;
    }

    // 2. Validate: Already Booked
    if (bookedKeys.has(key)) {
      setModal({ isOpen: true, type: 'error', title: 'Slot Unavailable', message: 'This time slot has already been booked.' });
      return;
    }

    // 3. Validate: Teacher Availability
    const jsDay = slotStart.getDay();
    const apiDay = jsDay === 0 ? 6 : jsDay - 1;
    const hasAvailability = availability.some(rule => {
      if (rule.day_of_week !== apiDay) return false;
      const [sH] = rule.start_time.split(':').map(Number);
      const [eH] = rule.end_time.split(':').map(Number);
      return hour >= sH && hour < eH;
    });

    if (!hasAvailability) return;

    // 4. Validate: Credits (use spendable available_credits)
    const credits = currentUser?.student_profile?.available_credits ?? currentUser?.student_profile?.lesson_credits ?? 0;
    if (credits < 1) {
      setModal({
        isOpen: true,
        type: 'no-credits',
        title: 'Out of Credits',
        message: 'You need at least 1 credit to book this lesson. Recharge your wallet to continue learning!'
      });
      return;
    }

    // 5. Success -> Open Confirm Modal
    setPendingSlot({ slotStart, slotEnd, key });
    setModal({
      isOpen: true,
      type: 'confirm',
      title: 'Confirm Booking',
      message: `Book lesson with ${teacher?.user.full_name}?\n\n📅 ${format(slotStart, 'EEEE, MMM d')}\n🕒 ${format(slotStart, 'h:mm a')} - ${format(slotEnd, 'h:mm a')}\n💳 Cost: 1 Credit`
    });
  };

  // --- STEP 2: PERFORM BOOKING (API Call) ---
  const performBooking = async () => {
    if (!pendingSlot) return;

    setIsProcessing(true); // Start loading spinner in modal

    try {
      await api.post('/api/bookings/', {
        teacher_id: id,
        start_time: pendingSlot.slotStart.toISOString(),
        end_time: pendingSlot.slotEnd.toISOString()
      });

      setBookedKeys(prev => new Set(prev).add(pendingSlot.key));
      // Refetch /api/me/ so credits_reserved and available_credits are correct; sync global auth state for dashboard
      const meRes = await api.get('/api/me/');
      setCurrentUser(meRes.data);
      await refreshUser();

      // Show Success Modal
      setModal({
        isOpen: true,
        type: 'success',
        title: 'Booking Confirmed!',
        message: 'Your lesson has been successfully booked. You can find it in your schedule.'
      });

    } catch (err: unknown) { // FIX: Type-safe error handling
      console.error(err);
      let errorMsg = "Booking failed. The slot might have been taken.";

      // Safe Error Extraction for Axios
      if (err && typeof err === 'object' && 'response' in err) {
        const apiError = err as { response: { data: { error?: string } } };
        if (apiError.response?.data?.error) {
          errorMsg = apiError.response.data.error;
        }
      }

      setModal({ isOpen: true, type: 'error', title: 'Booking Failed', message: errorMsg });

      // Refresh credits in background to be safe
      api.get('/api/me/').then(res => setCurrentUser(res.data)).catch(() => { });
    } finally {
      setIsProcessing(false); // Stop loading
      setPendingSlot(null);
    }
  };

  // --- STEP 3: MODAL BUTTON HANDLER ---
  const handleModalAction = () => {
    if (modal.type === 'confirm') {
      performBooking();
    } else if (modal.type === 'no-credits') {
      navigate('/buy-credits');
    } else {
      setModal({ ...modal, isOpen: false });
    }
  };

  // --- RENDER ---
  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const weekDays = useMemo(() => Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i)), [weekStart]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={48} /></div>;

  if (!teacher) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-400">
      <AlertCircle size={48} className="mb-4 text-slate-300" />
      <h2 className="text-xl font-bold text-slate-700">Teacher not found</h2>
      <button onClick={() => navigate(-1)} className="mt-4 text-indigo-600 hover:underline">Go Back</button>
    </div>
  );

  const videoId = getYouTubeVideoId(teacher.youtube_intro_url || '');

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 pb-20 relative">

      {/* 1. TOP NAV */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 px-6 h-16 flex items-center justify-between shadow-sm">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors font-medium">
          <ChevronLeft size={20} /> <span className="hidden sm:inline">Back to Teachers</span>
        </button>
        <div className="flex items-center gap-4">
          {/* Credit Counter — show spendable (available_credits) */}
          {(() => {
            const available = currentUser?.student_profile?.available_credits ?? currentUser?.student_profile?.lesson_credits ?? 0;
            return (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold border transition-colors ${available > 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                <CreditCard size={14} />
                <span>{available} Credits</span>
              </div>
            );
          })()}

          <div className="flex items-center gap-2">
            <Avatar
              url={teacher.user.profile_picture_url}
              name={teacher.user.full_name}
              size={32}
            />
            <span className="font-bold text-slate-700 text-sm hidden sm:inline">{teacher.user.full_name}</span>
          </div>
        </div>
      </nav>

      {/* MAIN CONTAINER */}
      <main className="max-w-[1200px] mx-auto p-4 md:p-8 space-y-8">

        {/* 2. TEACHER PROFILE CARD (Single Box) */}
        <div className="bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-slate-100">

          {/* Vertical Columns Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_450px] gap-10 items-start">

            {/* LEFT COLUMN: Basic Info, Languages, Subjects, Certificates */}
            <div className="space-y-12">
              {/* Avatar & Basic Info */}
              <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
                <div className="relative shrink-0 mx-auto md:mx-0">
                  <div className="bg-indigo-50 p-2 rounded-full inline-block">
                    <Avatar
                      url={teacher.user.profile_picture_url}
                      name={teacher.user.full_name}
                      size={120}
                      className="shadow-sm"
                    />
                  </div>
                  <div className="absolute bottom-2 right-2 bg-white p-1 rounded-full border-2 border-white">
                    <div className="bg-green-500 h-4 w-4 rounded-full" title="Verified Teacher"></div>
                  </div>
                </div>

                <div className="flex-1 space-y-5 text-center md:text-left w-full min-w-0">
                  <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight truncate">{teacher.user.full_name}</h1>
                    <p className="text-base text-indigo-600 font-medium mt-1 truncate">{teacher.headline}</p>
                  </div>

                  <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-4">
                    <div className="flex items-center gap-1.5 border border-slate-200 px-4 py-1.5 rounded-3xl text-xs font-bold text-slate-700">
                      <Star size={14} className="fill-amber-400 text-amber-400" />
                      <span>{teacher.rating} <span className="text-slate-400 font-medium ml-1">Rating</span></span>
                    </div>
                    <div className="flex items-center gap-1.5 border border-slate-200 px-4 py-1.5 rounded-3xl text-xs font-bold text-slate-700">
                      <Clock size={14} className="text-indigo-400" />
                      <span>{teacher.lessons_taught} <span className="text-slate-400 font-medium ml-1">Lessons</span></span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 px-4 py-1.5 rounded-3xl text-xs font-bold text-green-700">
                      <ShieldCheck size={14} className="text-green-500" /> Verified
                    </div>
                  </div>

                  {/* Not accepting students banner */}
                  {!teacher.is_accepting_students && (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm font-semibold mt-4">
                      <AlertCircle size={16} className="shrink-0 text-amber-500" />
                      This teacher is not currently accepting new students.
                    </div>
                  )}
                </div>
              </div>

              {/* Languages */}
              {teacher.languages.length > 0 && (
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                    <span className="w-6 h-[2px] bg-slate-200"></span> LANGUAGES
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {[...teacher.languages]
                      .sort((a, b) => (PROF_ORDER[b.proficiency] ?? 0) - (PROF_ORDER[a.proficiency] ?? 0))
                      .map((l, i) => {
                        const meta = getProfMeta(l.proficiency);
                        return (
                          <div key={i} className="flex items-center justify-between bg-white rounded-2xl px-4 py-2.5 border border-slate-100 shadow-sm group hover:border-slate-200 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
                              <span className="text-[14px] font-bold text-slate-800 truncate">{l.language}</span>
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border shrink-0 ${meta.pill}`}>
                              {meta.label}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Subjects */}
              {teacher.subjects.length > 0 && (
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                    <span className="w-6 h-[2px] bg-slate-200"></span> SUBJECTS
                  </h3>
                  <div className="flex flex-wrap gap-2.5">
                    {teacher.subjects.map(s => (
                      <span key={s.id} className="inline-flex items-center px-4 py-1.5 rounded-3xl text-[12px] font-bold text-indigo-700 border border-indigo-100 hover:bg-indigo-50 transition-colors">
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Language Certificates */}
              {teacher.language_certificates.length > 0 && (
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                    <span className="w-6 h-[2px] bg-slate-200"></span> CERTIFICATES
                  </h3>
                  <div className="space-y-3">
                    {teacher.language_certificates.map((cert, i) => (
                      <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white rounded-2xl px-5 py-3.5 border border-slate-100 shadow-sm">
                        <div className="min-w-0">
                          <p className="text-[14px] font-bold text-slate-800 truncate">{cert.certificate_name}</p>
                          {cert.issued_date && <p className="text-[11px] font-semibold text-slate-400 mt-1 uppercase tracking-wider">{cert.issued_date}</p>}
                        </div>
                        {cert.score && (
                          <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-100 shrink-0 self-start sm:self-auto">
                            {cert.score}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Video & About Me */}
            <div className="space-y-12">
              {/* Video Introduction */}
              {videoId && (
                <div className="w-full">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-5 flex items-center gap-2">
                    <span className="w-6 h-[2px] bg-slate-200"></span> VIDEO INTRODUCTION
                  </h3>
                  <div className="bg-slate-900 rounded-2xl overflow-hidden aspect-video relative group w-full border border-slate-100">
                    {!isVideoPlaying ? (
                      <button onClick={() => setIsVideoPlaying(true)} className="absolute inset-0 w-full h-full block cursor-pointer">
                        <img src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`} alt="Thumbnail" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="h-16 w-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center pl-1 shadow-[0_0_30px_rgba(0,0,0,0.3)] scale-95 group-hover:scale-110 transition-transform border border-white/30">
                            <Play size={28} className="text-white fill-white" />
                          </div>
                        </div>
                      </button>
                    ) : (
                      <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`} allowFullScreen></iframe>
                    )}
                  </div>
                </div>
              )}

              {/* About Me */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                  <span className="w-6 h-[2px] bg-slate-200"></span> ABOUT ME
                </h3>
                <p className="text-slate-600 leading-relaxed text-[14px] whitespace-pre-wrap">
                  {teacher.bio || "No bio available."}
                </p>
              </div>
            </div>
          </div>


        </div>

        {/* 3. CALENDAR SECTION */}
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden">

          <div className="p-6 border-b border-slate-100 bg-white flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-100 p-3 rounded-2xl text-indigo-600">
                <CalendarIcon size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Book a Lesson</h2>
                <div className="flex items-baseline gap-1 text-slate-500">
                  <span className="font-bold text-slate-900 text-lg">1 Credit</span> / lesson
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between bg-slate-50 p-1.5 rounded-2xl border border-slate-100 w-full md:w-auto">
              <button onClick={() => setCurrentDate(subWeeks(currentDate, 1))} className="p-3 hover:bg-white rounded-xl text-slate-400 hover:text-indigo-600 shadow-sm transition-all"><ChevronLeft size={20} /></button>
              <span className="text-sm font-bold text-slate-800 px-4 min-w-[140px] text-center">
                {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d')}
              </span>
              <button onClick={() => setCurrentDate(addWeeks(currentDate, 1))} className="p-3 hover:bg-white rounded-xl text-slate-400 hover:text-indigo-600 shadow-sm transition-all"><ChevronRight size={20} /></button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Days Header */}
              <div className="grid grid-cols-8 border-b border-slate-100 bg-slate-50/50">
                <div className="p-4 text-xs font-bold text-slate-300 text-center border-r border-slate-100">TIME</div>
                {weekDays.map((day, i) => {
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div key={i} className={`p-3 text-center border-r border-slate-100 ${isToday ? 'bg-indigo-50/50' : ''}`}>
                      <span className="text-xs font-bold text-slate-400 uppercase block mb-1">{format(day, 'EEE')}</span>
                      <div className={`inline-flex items-center justify-center h-8 w-8 rounded-full text-sm font-bold ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-700'}`}>
                        {format(day, 'd')}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Times Grid */}
              <div className="grid grid-cols-8">
                <div className="border-r border-slate-100 bg-white">
                  {HOURS.map(hour => (
                    <div key={hour} className="border-b border-slate-50 text-xs text-slate-400 font-medium relative" style={{ height: ROW_HEIGHT }}>
                      <span className="absolute -top-2.5 right-3">{hour}:00</span>
                    </div>
                  ))}
                </div>

                {weekDays.map((day, dayIndex) => {
                  const jsDay = day.getDay();
                  const apiDay = jsDay === 0 ? 6 : jsDay - 1;

                  return (
                    <div key={dayIndex} className="relative border-r border-slate-100 bg-white">
                      {HOURS.map(hour => {
                        const slotDate = new Date(day);
                        slotDate.setHours(hour, 0, 0, 0);
                        const key = getSlotKey(slotDate);
                        const booked = bookedKeys.has(key);
                        const available = availability.some(rule => {
                          if (rule.day_of_week !== apiDay) return false;
                          const [sH] = rule.start_time.split(':').map(Number);
                          const [eH] = rule.end_time.split(':').map(Number);
                          return hour >= sH && hour < eH;
                        });

                        return (
                          <div
                            key={hour}
                            className="border-b border-slate-50 relative transition-all group"
                            style={{ height: ROW_HEIGHT }}
                          >
                            {booked && (
                              <div className="absolute inset-1 z-10 flex items-center justify-center p-1 cursor-not-allowed">
                                <div className="absolute inset-0 bg-slate-50/80 rounded-lg border border-slate-200"
                                  style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, #f1f5f9 5px, #f1f5f9 10px)' }}>
                                </div>
                                <div className="relative z-20 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md shadow-sm border border-slate-100 flex items-center gap-1">
                                  <Lock size={10} className="text-slate-400" />
                                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Booked</span>
                                </div>
                              </div>
                            )}

                            {available && !booked && (
                              <button
                                disabled={isProcessing}
                                onClick={() => handleGridClick(day, hour)}
                                className="absolute inset-1 bg-indigo-50 hover:bg-indigo-600 border border-indigo-100 hover:border-indigo-600 rounded-lg flex items-center justify-center group/btn transition-all"
                              >
                                <span className="text-xs font-bold text-indigo-600 group-hover/btn:text-white">Book</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-center gap-8 text-xs font-bold text-slate-500 uppercase tracking-wide">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-indigo-50 border border-indigo-200 rounded"></div> Available
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-slate-50 border border-slate-200 rounded" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, #f1f5f9 2px, #f1f5f9 4px)' }}></div> Booked
            </div>
          </div>

        </div>

      </main>

      {/* --- UNIFIED MODAL COMPONENT --- */}
      {modal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center relative border border-slate-100">
            <button
              onClick={() => { if (!isProcessing) setModal({ ...modal, isOpen: false }); }}
              disabled={isProcessing}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-50 rounded-full disabled:opacity-50"
            >
              <X size={20} />
            </button>

            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-md
                      ${modal.type === 'error' ? 'bg-red-100 text-red-500' :
                modal.type === 'success' ? 'bg-green-100 text-green-500' :
                  modal.type === 'no-credits' ? 'bg-amber-100 text-amber-500' :
                    'bg-indigo-100 text-indigo-600'}`}>
              {modal.type === 'error' && <AlertTriangle size={32} />}
              {modal.type === 'success' && <CheckCircle size={32} />}
              {modal.type === 'no-credits' && <CreditCard size={32} />}
              {(modal.type === 'confirm' || modal.type === 'info') && <Info size={32} />}
            </div>

            <h3 className="text-2xl font-black text-slate-900 mb-2">{modal.title}</h3>
            <p className="text-slate-500 mb-6 leading-relaxed whitespace-pre-wrap">{modal.message}</p>

            <div className="space-y-3">
              {/* Confirm Action */}
              {modal.type === 'confirm' && (
                <button
                  onClick={handleModalAction}
                  disabled={isProcessing}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-200 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isProcessing ? <Loader2 size={20} className="animate-spin" /> : 'Confirm Booking'}
                </button>
              )}

              {/* Buy Credits Action */}
              {modal.type === 'no-credits' && (
                <button
                  onClick={handleModalAction}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <CreditCard size={20} /> Buy Credits
                </button>
              )}

              {/* Cancel / Close Action */}
              <button
                onClick={() => setModal({ ...modal, isOpen: false })}
                disabled={isProcessing}
                className={`w-full py-3 text-slate-500 font-bold text-sm hover:text-slate-800 transition-colors ${(modal.type === 'success' || modal.type === 'error' || modal.type === 'info') ? 'bg-slate-100 rounded-xl hover:bg-slate-200' : ''}`}
              >
                {(modal.type === 'confirm' || modal.type === 'no-credits') ? 'Cancel' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}