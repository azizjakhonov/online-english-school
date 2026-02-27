import { useState, useEffect } from 'react';
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-center gap-4 sticky top-0 z-20">
        <button
          onClick={() => navigate('/dashboard')}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          title="Back to dashboard"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-100 rounded-xl text-blue-600 shrink-0">
            <Target size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Learning Goals</h1>
            <p className="text-xs text-slate-500 font-medium">Set a target to stay motivated</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="animate-spin text-blue-600" size={36} />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">

            {success && (
              <div className="mb-6 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm font-medium px-4 py-3 flex items-center gap-2">
                <CheckCircle size={18} /> {success}
              </div>
            )}

            <div className="space-y-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Target size={16} className="text-blue-600" /> My main goal
              </label>

              <textarea
                rows={6}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium resize-none text-slate-900 placeholder:text-slate-400"
                placeholder="e.g. I want to reach B2 level in English by summer so I can apply for university..."
              />

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Save Goal
                </button>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100">
              <h4 className="text-sm font-bold text-slate-900 mb-2">Tips for setting goals</h4>
              <ul className="text-sm text-slate-500 space-y-1 list-disc list-inside font-medium">
                <li>Be specific (e.g. &quot;Learn 50 new words&quot; vs &quot;Learn words&quot;)</li>
                <li>Set a timeline (e.g. &quot;By next month&quot;)</li>
                <li>Make it measurable</li>
              </ul>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}