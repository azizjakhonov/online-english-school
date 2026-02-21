import React, { useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import api from '../../lib/api';

interface LessonData {
  id: number;
  start_datetime: string;
  status: 'scheduled' | 'completed' | 'canceled';
}

interface EditModalProps {
  lesson: LessonData;
  onClose: () => void;
  onUpdate: () => void;
}

export default function AdminLessonEditModal({ lesson, onClose, onUpdate }: EditModalProps) {
  // slice(0, 16) formats the ISO string to YYYY-MM-DDTHH:mm for the input
  const [date, setDate] = useState(lesson.start_datetime.slice(0, 16));
  const [status, setStatus] = useState(lesson.status);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/lessons/${lesson.id}/update/`, {
        start_datetime: new Date(date).toISOString(),
        status: status
      });
      onUpdate();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-slate-900">Edit Session</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <X size={20} className="text-slate-400" />
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1 tracking-widest">Reschedule</label>
              <input 
                type="datetime-local" 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1 tracking-widest">Status</label>
              <select 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
                value={status}
                onChange={(e) => setStatus(e.target.value as LessonData['status'])}
              >
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="canceled">Canceled</option>
              </select>
            </div>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold flex items-center justify-center gap-2 mt-4 transition-all active:scale-[0.98] disabled:opacity-70 shadow-lg shadow-slate-200"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              Update Lesson
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}