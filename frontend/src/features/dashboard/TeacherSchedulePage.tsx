import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Clock,
  User,
  X,
  ArrowLeft,
  Video,
  CalendarPlus,
  CheckCircle2,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  isSameDay,
  parseISO
} from 'date-fns';
import api from '../../lib/api';
import { formatTime } from '../../utils/datetime';

// --- Configuration ---
const START_HOUR = 6;
const END_HOUR = 23;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR);
const ROW_HEIGHT = 64;

// --- Types ---
interface AvailabilitySlot {
  id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface Lesson {
  id: number;
  room_sid: string;
  student_name: string;
  start_time: string;
  end_time: string;
}

interface FeedbackState {
  type: 'success' | 'error';
  message: string;
}

import { usePageTitle } from '../../lib/usePageTitle';

export default function TeacherSchedulePage() {
  usePageTitle('My Schedule');
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());

  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Modal States ---
  const [isAdding, setIsAdding] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  // Form States
  const [newSlotDay, setNewSlotDay] = useState(0);
  const [newSlotStart, setNewSlotStart] = useState('09:00');
  const [newSlotEnd, setNewSlotEnd] = useState('10:00');
  const [clickSource, setClickSource] = useState<'button' | 'grid'>('button');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [availRes, lessonsRes] = await Promise.all([
        api.get('/api/my-availability/'),
        api.get('/api/my-lessons/')
      ]);
      setAvailabilitySlots(availRes.data);
      setLessons(lessonsRes.data);
    } catch (err) {
      console.error("Failed to load schedule", err);
      showFeedback('error', 'Failed to load schedule data.');
    } finally {
      setLoading(false);
    }
  };

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    if (type === 'success') {
      setTimeout(() => setFeedback(null), 2500);
    }
  };

  const handleAddSlot = async () => {
    try {
      const { data } = await api.post('/api/my-availability/', {
        day_of_week: newSlotDay,
        start_time: newSlotStart,
        end_time: newSlotEnd
      });
      setAvailabilitySlots([...availabilitySlots, data]);
      setIsAdding(false);
      showFeedback('success', 'Availability slot added!');
    } catch (err) {
      console.error(err);
      setIsAdding(false);
      showFeedback('error', 'Failed to add slot. Check for overlaps.');
    }
  };

  const initiateDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSlotToDelete(id);
  };

  const confirmDelete = async () => {
    if (!slotToDelete) return;
    try {
      await api.delete(`/api/my-availability/${slotToDelete}/`);
      setAvailabilitySlots(availabilitySlots.filter(s => s.id !== slotToDelete));
      setSlotToDelete(null);
      showFeedback('success', 'Slot removed successfully.');
    } catch (err) {
      console.error(err);
      setSlotToDelete(null);
      showFeedback('error', 'Failed to delete slot.');
    }
  };

  // --- NEW: Simplified Slot Click Handler ---
  // No more math! We know exactly which hour was clicked.
  const handleSlotClick = (dayIndex: number, hour: number) => {
    const startH = hour.toString().padStart(2, '0');
    const endH = (hour + 1).toString().padStart(2, '0');

    setNewSlotDay(dayIndex);
    setNewSlotStart(`${startH}:00`);
    setNewSlotEnd(`${endH}:00`);
    setClickSource('grid');
    setIsAdding(true);
  };

  const openManualModal = () => {
    setNewSlotDay(0);
    setNewSlotStart('09:00');
    setNewSlotEnd('10:00');
    setClickSource('button');
    setIsAdding(true);
  }

  // --- Calendar Helpers ---
  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const weekDays = useMemo(() => Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i)), [weekStart]);
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const getPositionFromTime = (timeInput: string | Date) => {
    let dateObj;
    if (typeof timeInput === 'string' && !timeInput.includes('T')) {
      const [h, m] = timeInput.split(':').map(Number);
      return ((h - START_HOUR) * 60 + m) / 60 * ROW_HEIGHT;
    } else {
      dateObj = typeof timeInput === 'string' ? new Date(timeInput) : timeInput;
      const h = dateObj.getHours();
      const m = dateObj.getMinutes();
      return ((h - START_HOUR) * 60 + m) / 60 * ROW_HEIGHT;
    }
  };

  const getDurationHeight = (startStr: string, endStr?: string) => {
    if (endStr && !startStr.includes('T')) {
      const [h1, m1] = startStr.split(':').map(Number);
      const [h2, m2] = endStr.split(':').map(Number);
      return ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60 * ROW_HEIGHT;
    }
    if (startStr.includes('T')) {
      return ROW_HEIGHT;
    }
    return 1 * ROW_HEIGHT;
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">

      {/* Header — same pattern as TeacherLessonHistory */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            title="Back to dashboard"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-xl text-blue-600 shrink-0">
              <CalendarPlus size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">Weekly Schedule</h1>
              <p className="text-xs text-slate-500 font-medium">Availability & booked lessons</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-1.5 flex items-center gap-0.5">
            <button onClick={() => setCurrentDate(subWeeks(currentDate, 1))} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"><ChevronLeft size={18} /></button>
            <span className="text-xs font-bold text-slate-700 min-w-[110px] text-center px-2">
              {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d')}
            </span>
            <button onClick={() => setCurrentDate(addWeeks(currentDate, 1))} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"><ChevronRight size={18} /></button>
          </div>

          <button
            onClick={openManualModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center gap-2"
          >
            <Plus size={18} /> <span className="hidden sm:inline">Add Availability</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col w-full">
        <div className="max-w-6xl mx-auto w-full h-full flex flex-col px-4 sm:px-6 py-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">

            {/* Calendar Header Row */}
            <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50/50 sticky top-0 z-20">
              <div className="py-3 text-[10px] font-extrabold text-slate-400 text-center uppercase tracking-wider border-r border-slate-200 flex items-center justify-center">
                GMT+5
              </div>
              {weekDays.map((day, i) => {
                const isToday = isSameDay(day, new Date());
                return (
                  <div key={i} className={`py-3 text-center border-r border-slate-100 last:border-r-0 ${isToday ? 'bg-blue-50/50' : ''}`}>
                    <div className={`text-[10px] font-bold uppercase mb-0.5 ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>
                      {format(day, 'EEE')}
                    </div>
                    <div className={`text-lg font-bold leading-none ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>
                      {format(day, 'd')}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Calendar Body */}
            <div className="overflow-y-auto flex-1 custom-scrollbar relative bg-white">
              {loading && (
                <div className="absolute inset-0 bg-slate-50/95 z-50 flex flex-col items-center justify-center gap-3">
                  <Loader2 size={36} className="animate-spin text-blue-600" />
                  <p className="text-sm text-slate-500 font-medium">Loading schedule…</p>
                </div>
              )}

              <div className="grid grid-cols-8 relative min-w-[700px]">
                {/* Time Column (Left Side) */}
                <div className="border-r border-slate-200 bg-white sticky left-0 z-10">
                  {HOURS.map(hour => (
                    <div key={hour} className="border-b border-slate-100 text-xs text-slate-400 font-medium relative box-border" style={{ height: ROW_HEIGHT }}>
                      <span className="absolute -top-2.5 right-2 bg-white px-1 z-10 text-[10px]">{hour}:00</span>
                    </div>
                  ))}
                </div>

                {/* Day Columns */}
                {weekDays.map((day, dayIndex) => {
                  const jsDay = day.getDay();
                  const apiDay = jsDay === 0 ? 6 : jsDay - 1;

                  const daysSlots = availabilitySlots.filter(s => s.day_of_week === apiDay);
                  const daysLessons = lessons.filter(l => isSameDay(parseISO(l.start_time), day));

                  return (
                    <div
                      key={dayIndex}
                      className="relative border-r border-slate-100 last:border-r-0"
                    >
                      {/* Background Grid & Interactive Slots 
                                        This replaces the old "Group Hover" logic.
                                    */}
                      {HOURS.map(hour => (
                        <div
                          key={hour}
                          className="border-b border-slate-100 relative group/slot cursor-pointer transition-colors hover:bg-slate-50"
                          style={{ height: ROW_HEIGHT }}
                          onClick={() => handleSlotClick(apiDay, hour)}
                        >
                          {/* Plus Icon: Only shows for THIS specific slot on hover */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/slot:opacity-100 transition-opacity pointer-events-none">
                            <Plus className="text-blue-400" size={20} />
                          </div>
                        </div>
                      ))}

                      {/* Availability Slots (Absolute positioned on top of grid) */}
                      {daysSlots.map(slot => (
                        <div
                          key={`avail-${slot.id}`}
                          className="absolute left-[2px] right-[2px] rounded-md bg-blue-50/90 border border-dashed border-blue-200 z-10 group hover:bg-blue-100 hover:border-blue-300 transition-colors overflow-hidden"
                          style={{
                            top: `${getPositionFromTime(slot.start_time)}px`,
                            height: `${getDurationHeight(slot.start_time, slot.end_time)}px`
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="w-full h-full p-1 flex justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => initiateDelete(slot.id, e)}
                              className="bg-white text-red-500 p-1.5 rounded-full shadow-sm hover:bg-red-50 border border-red-100"
                              title="Remove Availability"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Lesson Slots (Higher Z-Index) */}
                      {daysLessons.map(lesson => {
                        return (
                          <div
                            key={`lesson-${lesson.id}`}
                            className="absolute left-[4px] right-[4px] rounded-lg bg-slate-800 text-white shadow-lg shadow-slate-900/10 z-20 flex flex-col p-2.5 cursor-pointer border border-slate-700 group hover:bg-slate-900 transition-colors"
                            style={{
                              top: `${getPositionFromTime(lesson.start_time)}px`,
                              height: `${getDurationHeight(lesson.start_time)}px`
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/classroom/${lesson.room_sid}`);
                            }}
                          >
                            <div className="flex items-start justify-between mb-1">
                              <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                                <Clock size={10} /> {formatTime(lesson.start_time)}
                              </span>
                              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.5)]"></span>
                            </div>

                            <div className="font-bold text-xs truncate flex items-center gap-1.5 text-white">
                              <User size={12} className="text-blue-400 shrink-0" />
                              <span>{lesson.student_name}</span>
                            </div>

                            <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-[1px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                              <div className="text-[10px] bg-blue-600 text-white px-3 py-1.5 rounded-md font-bold shadow-md flex items-center gap-1.5 transform transition-transform active:scale-95">
                                <Video size={12} /> Start Class
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Add availability modal — same overlay/content style as TeacherLessonHistory */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setIsAdding(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setIsAdding(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors">
              <X size={20} />
            </button>

            <div className="mb-6 pr-8">
              <h2 className="text-xl font-black text-slate-900">
                {clickSource === 'grid' ? 'Confirm Availability' : 'Add Availability'}
              </h2>
              <p className="text-sm text-slate-500 font-medium mt-1">
                {clickSource === 'grid'
                  ? 'Make this time slot available for students?'
                  : 'Set a time when students can book you.'}
              </p>
            </div>

            {clickSource === 'grid' && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
                <div className="p-3 rounded-xl bg-blue-100 text-blue-600 shrink-0">
                  <CalendarPlus size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Selected slot</p>
                  <p className="text-slate-900 font-bold text-sm">{dayNames[newSlotDay]} · {newSlotStart} – {newSlotEnd}</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {clickSource === 'button' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Day</label>
                  <select
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                    value={newSlotDay}
                    onChange={e => setNewSlotDay(Number(e.target.value))}
                  >
                    {dayNames.map((d, i) => (
                      <option key={i} value={i}>{d}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Start</label>
                  <input
                    type="time"
                    value={newSlotStart}
                    onChange={e => setNewSlotStart(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">End</label>
                  <input
                    type="time"
                    value={newSlotEnd}
                    onChange={e => setNewSlotEnd(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button onClick={() => setIsAdding(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">
                  Cancel
                </button>
                <button onClick={handleAddSlot} className="flex-[2] py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors">
                  {clickSource === 'grid' ? 'Yes, Make Available' : 'Save Time Slot'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {slotToDelete !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 relative z-10 text-center">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Trash2 size={28} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">Remove slot?</h3>
            <p className="text-slate-500 text-sm font-medium mb-6">
              Students won&apos;t be able to book this time anymore.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setSlotToDelete(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors"
              >
                Yes, Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback modal (success / error) */}
      {feedback && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xs p-8 relative z-10 text-center">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 ${feedback.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
              {feedback.type === 'success' ? <CheckCircle2 size={28} /> : <AlertTriangle size={28} />}
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">
              {feedback.type === 'success' ? 'Success!' : 'Oops!'}
            </h3>
            <p className="text-slate-500 text-sm font-medium mb-6">
              {feedback.message}
            </p>
            <button
              onClick={() => setFeedback(null)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
            >
              Okay
            </button>
          </div>
        </div>
      )}

    </div>
  );
}