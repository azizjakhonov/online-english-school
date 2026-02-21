import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Target, ArrowLeft, Loader2, Save, CheckCircle
} from 'lucide-react';
import api from '../../lib/api';

export default function StudentGoals() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [goal, setGoal] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/api/me/');
        // Safely access nested profile data
        setGoal(res.data.student_profile?.goals || '');
      } catch (err) {
        console.error("Failed to load goals", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSuccess('');
    try {
      // Assuming backend accepts { student_profile: { goals: ... } } or flat
      // Adjust structure based on your specific backend serializer
      await api.patch('/api/students/me/', { goals: goal });
      setSuccess('Goal updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error("Failed to save goal", err);
      alert("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 p-8">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <header className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/dashboard')} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900">Learning Goals</h1>
            <p className="text-slate-500 font-medium">Set a target to keep yourself motivated.</p>
          </div>
        </header>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">

            {success && (
              <div className="mb-6 bg-green-50 text-green-700 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 animate-in fade-in">
                <CheckCircle size={18} /> {success}
              </div>
            )}

            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Target size={18} className="text-red-500" /> My Main Goal
              </label>

              <div className="relative">
                <textarea
                  rows={6}
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium resize-none text-lg text-slate-800 placeholder:text-slate-400"
                  placeholder="e.g. I want to reach B2 level in English by summer so I can apply for university..."
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  Save Goal
                </button>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-100">
              <h4 className="font-bold text-slate-900 mb-2">Tips for setting goals:</h4>
              <ul className="text-sm text-slate-500 space-y-1 list-disc list-inside">
                <li>Be specific (e.g., "Learn 50 new words" vs "Learn words")</li>
                <li>Set a timeline (e.g., "By next month")</li>
                <li>Make it measurable</li>
              </ul>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}