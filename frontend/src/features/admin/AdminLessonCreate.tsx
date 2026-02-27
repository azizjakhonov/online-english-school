import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, ArrowLeft, Loader2 } from 'lucide-react';
import api from '../../lib/api';

export default function AdminLessonCreate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    teacher_id: '',
    student_id: '',
    start_datetime: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  try {
    await api.post('/api/lessons/create/', formData);
    alert('Lesson created successfully');
    
    // FIX: Change this from '/dashboard' to '/admin/lessons'
    navigate('/admin/lessons'); 
  } catch (error) {
    console.error(error);
    alert('Failed to create lesson');
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-6 font-bold">
        <ArrowLeft size={18} /> Back
      </button>

      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
        <h1 className="text-2xl font-black mb-6">Create New Lesson</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Start Date & Time</label>
            <input 
              type="datetime-local" 
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"
              onChange={(e) => setFormData({...formData, start_datetime: e.target.value})}
              required
            />
          </div>
          {/* Add select dropdowns for Teacher and Student IDs here */}
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
            Save Lesson
          </button>
        </form>
      </div>
    </div>
  );
}