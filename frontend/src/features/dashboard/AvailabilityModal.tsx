import { useState } from 'react';
import { X, Clock, Calendar as CalIcon, Loader2, ShieldCheck } from 'lucide-react';
import api from '../../lib/api';
import { AxiosError } from 'axios';
import { formatDate } from '../../utils/datetime';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  onSuccess: () => void;
}

export default function AvailabilityModal({ isOpen, onClose, selectedDate, onSuccess }: Props) {
  const [time, setTime] = useState("10:00");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAdd = async () => {
    if (!selectedDate) return;
    setIsSubmitting(true);

    try {
      const [hours, minutes] = time.split(':');
      const finalDate = new Date(selectedDate);
      finalDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      await api.post('/api/scheduling/manage-availability/', {
        start_time: finalDate.toISOString()
      });

      onSuccess();
      onClose();
    } catch (err) {
      const error = err as AxiosError<{ detail?: string }>;
      console.error("Django Error:", error.response?.data);
      alert(error.response?.data?.detail || "Failed to add slot.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-[3rem] w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-300">
        <div className="px-8 pt-8 pb-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-slate-900">New Time Slot</h2>
            <p className="text-slate-400 text-sm font-medium">Open your schedule for students</p>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-colors text-slate-400 hover:text-slate-900">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 pt-2 space-y-6">
          <div className="bg-emerald-50 p-5 rounded-[2rem] flex items-center gap-4 border border-emerald-100/50">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm">
              <CalIcon size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-emerald-600/50 uppercase tracking-[0.2em]">Active Date</p>
              <p className="text-lg font-bold text-emerald-900">{selectedDate ? formatDate(selectedDate.toISOString()) : '-'}</p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[11px] font-black text-slate-400 ml-2 uppercase tracking-widest">Select Start Time</label>
            <div className="relative group">
              <Clock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={22} />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-[1.5rem] outline-none font-bold text-2xl text-slate-800 transition-all cursor-pointer"
              />
            </div>
          </div>

          <div className="bg-blue-50/50 p-4 rounded-2xl flex gap-3 border border-blue-100/50">
            <ShieldCheck size={18} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-blue-600 leading-relaxed">This slot will be visible to all students once confirmed.</p>
          </div>

          <div className="flex gap-4 pt-2">
            <button disabled={isSubmitting} onClick={onClose} className="flex-1 py-4 rounded-2xl font-bold text-slate-400 hover:text-slate-600 transition-all">
              Cancel
            </button>
            <button
              disabled={isSubmitting}
              onClick={handleAdd}
              className="flex-1 py-4 rounded-2xl font-bold bg-slate-900 text-white shadow-xl hover:bg-black transition-all active:scale-95 flex items-center justify-center disabled:bg-slate-300"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Confirm Slot"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}