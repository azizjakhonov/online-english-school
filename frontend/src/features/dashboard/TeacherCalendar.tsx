import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Clock, CheckCircle2 } from 'lucide-react';
import api from '../../lib/api';
import AvailabilityModal from './AvailabilityModal';
import { formatWeekdayShort, formatMonthDay } from '../../utils/datetime';

interface CalendarEvent {
  id: number;
  student_name: string;
  start_time: string;
  is_booked: boolean;
}

export default function TeacherCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeDate, setActiveDate] = useState(new Date());

  // Wrapping in useCallback makes the function stable
  const fetchEvents = useCallback(async () => {
    try {
      const res = await api.get('/api/scheduling/teacher-events/');
      setEvents(res.data);
    } catch (error) {
      console.error("Fetch failed", error);
    }
  }, []);

  // To satisfy the "set-state-in-effect" rule, we use a simple async wrapper
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      if (isMounted) {
        await fetchEvents();
      }
    };
    loadData();
    return () => { isMounted = false; };
  }, [fetchEvents]);

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this slot?")) return;
    try {
      await api.delete(`/api/scheduling/manage-availability/${id}/`);
      fetchEvents();
    } catch (error) {
      console.error("Delete failed", error);
      alert("Cannot delete a booked class.");
    }
  };

  const dailyEvents = events.filter(e =>
    new Date(e.start_time).toDateString() === activeDate.toDateString()
  ).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const hours = Array.from({ length: 14 }, (_, i) => i + 8); // 8 AM to 9 PM

  return (
    <div className="min-h-screen bg-[#FDFDFF] p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Schedule</h1>
            <p className="text-slate-400 font-medium">Manage your daily lessons and availability</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-[1.5rem] font-bold flex items-center gap-3 shadow-lg shadow-emerald-100 transition-all active:scale-95"
          >
            <Plus size={20} /> Add Time Slot
          </button>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-4 bg-white p-4 rounded-[2.5rem] shadow-sm border border-slate-100 overflow-x-auto">
          <button className="p-3 hover:bg-slate-50 rounded-2xl text-slate-400"><ChevronLeft size={24} /></button>
          <div className="flex gap-2">
            {[...Array(7)].map((_, i) => {
              const d = new Date();
              d.setDate(d.getDate() + i - 3);
              const isActive = d.toDateString() === activeDate.toDateString();
              return (
                <button
                  key={i}
                  onClick={() => setActiveDate(new Date(d))}
                  className={`flex flex-col items-center justify-center min-w-[70px] h-24 rounded-[1.8rem] transition-all ${isActive ? 'bg-slate-900 text-white shadow-xl scale-105' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest mb-1">{formatWeekdayShort(d.toISOString())}</span>
                  <span className="text-xl font-black">{d.getDate()}</span>
                </button>
              );
            })}
          </div>
          <button className="p-3 hover:bg-slate-50 rounded-2xl text-slate-400"><ChevronRight size={24} /></button>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-50">
          <div className="p-8 border-b border-slate-50 flex justify-between items-center">
            <h3 className="text-xl font-black text-slate-900">
              {formatMonthDay(activeDate.toISOString())}
            </h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div> Booked
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div> Free
              </div>
            </div>
          </div>

          <div className="p-8 space-y-10 relative">
            {hours.map(hour => {
              const slot = dailyEvents.find(e => new Date(e.start_time).getHours() === hour);
              return (
                <div key={hour} className="flex gap-8 items-start group">
                  <div className="w-16 pt-1 text-right">
                    <span className="text-sm font-black text-slate-300 group-hover:text-slate-900 transition-colors">
                      {hour}:00
                    </span>
                  </div>

                  <div className="flex-1 h-px bg-slate-100 mt-4 relative">
                    {slot && (
                      <div className={`absolute -top-6 left-0 right-0 p-4 rounded-2xl border-l-8 shadow-sm flex justify-between items-center ${slot.is_booked ? 'bg-emerald-50 border-emerald-500 text-emerald-900' : 'bg-blue-50 border-blue-500 text-blue-900'
                        }`}>
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-xl bg-white shadow-sm"><Clock size={18} /></div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-40">
                              {slot.is_booked ? 'Confirmed Lesson' : 'Available'}
                            </p>
                            <p className="font-bold">{slot.student_name || 'Free Slot'}</p>
                          </div>
                        </div>

                        {!slot.is_booked ? (
                          <button onClick={() => handleDelete(slot.id)} className="p-2 hover:bg-red-100 text-red-400 hover:text-red-600 rounded-xl transition-colors">
                            <Trash2 size={18} />
                          </button>
                        ) : <CheckCircle2 className="text-emerald-500" size={20} />}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <AvailabilityModal
        isOpen={isModalOpen}
        selectedDate={activeDate}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchEvents}
      />
    </div>
  );
}