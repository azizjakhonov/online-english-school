import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Avatar from '../../components/Avatar';
import { 
  ChevronLeft, 
  ChevronRight,
  Star, 
  Clock, 
  Globe, 
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

// --- CONFIGURATION ---
const START_HOUR = 6; 
const END_HOUR = 23;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR);
const ROW_HEIGHT = 60; 

// --- TYPES ---
interface Teacher {
  id: number;
  user: { full_name: string; profile_picture_url?: string | null };
  headline: string;
  bio: string;
  hourly_rate: string;
  rating: number;
  lessons_taught: number;
  youtube_intro_url?: string;
}

interface CurrentUser {
    id: number;
    student_profile?: {
        lesson_credits: number;
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

export default function TeacherProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  
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

    // 4. Validate: Credits
    const credits = currentUser?.student_profile?.lesson_credits || 0;
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
      
      // Update Local State (Optimistic)
      setBookedKeys(prev => new Set(prev).add(pendingSlot.key));
      setCurrentUser(prev => {
          if (!prev || !prev.student_profile) return prev;
          return {
              ...prev,
              student_profile: {
                  ...prev.student_profile,
                  lesson_credits: prev.student_profile.lesson_credits - 1
              }
          };
      });

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
      api.get('/api/me/').then(res => setCurrentUser(res.data)).catch(() => {});
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

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={48}/></div>;

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
             {/* Credit Counter */}
             <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold border transition-colors ${currentUser?.student_profile?.lesson_credits && currentUser.student_profile.lesson_credits > 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                 <CreditCard size={14}/> 
                 <span>{currentUser?.student_profile?.lesson_credits || 0} Credits</span>
             </div>

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
      <main className="max-w-5xl mx-auto p-4 md:p-8 space-y-8">
        
        {/* 2. TEACHER PROFILE CARD */}
        <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="relative shrink-0 mx-auto md:mx-0">
                  <Avatar
                    url={teacher.user.profile_picture_url}
                    name={teacher.user.full_name}
                    size={128}
                    className="shadow-lg shadow-indigo-200"
                  />
                  <div className="absolute -bottom-2 -right-2 bg-white p-1 rounded-full">
                      <div className="bg-green-500 h-6 w-6 rounded-full border-4 border-white" title="Verified Teacher"></div>
                  </div>
              </div>
              
              <div className="flex-1 space-y-4 text-center md:text-left w-full">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">{teacher.user.full_name}</h1>
                    <p className="text-xl text-indigo-600 font-medium mt-1">{teacher.headline}</p>
                </div>

                <div className="flex flex-wrap justify-center md:justify-start gap-3">
                  <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full text-sm font-bold border border-amber-100">
                    <Star size={16} className="fill-amber-500 text-amber-500" /> {teacher.rating} Rating
                  </div>
                  <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-sm font-bold border border-blue-100">
                    <Globe size={16} /> English, Russian
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full text-sm font-bold border border-slate-200">
                    <Clock size={16} /> {teacher.lessons_taught} Lessons
                  </div>
                  <div className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-sm font-bold border border-green-200">
                    <ShieldCheck size={16} /> Verified
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                    <h3 className="text-sm font-bold uppercase text-slate-400 mb-2">About Me</h3>
                    <p className="text-slate-600 leading-relaxed text-base whitespace-pre-wrap">
                        {teacher.bio || "No bio available."}
                    </p>
                </div>
              </div>
            </div>

            {/* Video */}
            {videoId && (
                <div className="mt-8">
                      <h3 className="text-sm font-bold uppercase text-slate-400 mb-3">Video Introduction</h3>
                      <div className="bg-black rounded-3xl overflow-hidden aspect-video relative shadow-lg group max-w-2xl mx-auto md:mx-0">
                      {!isVideoPlaying ? (
                        <button onClick={() => setIsVideoPlaying(true)} className="absolute inset-0 w-full h-full block cursor-pointer">
                          <img src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`} alt="Thumbnail" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="h-16 w-16 bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center pl-1 shadow-2xl scale-95 group-hover:scale-110 transition-transform">
                                <Play size={32} className="text-white fill-white" />
                            </div>
                          </div>
                        </button>
                      ) : (
                        <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`} allowFullScreen></iframe>
                      )}
                    </div>
                </div>
            )}
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
                    onClick={() => { if(!isProcessing) setModal({ ...modal, isOpen: false }); }}
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