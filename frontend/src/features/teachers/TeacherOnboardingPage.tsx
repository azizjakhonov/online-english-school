import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, School, User, Briefcase, FileText } from 'lucide-react';
import api from '../../lib/api';

interface ApiError {
  response?: { data?: { error?: string } };
}

export default function TeacherOnboardingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<1 | 2>(1);

  const [fullName, setFullName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Please enter your full name');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!headline.trim()) {
      setError('Please enter your teaching headline');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Set role to teacher + full name
      await api.post('/api/select-role/', { role: 'teacher', full_name: fullName });
      // Update teacher profile fields
      await api.patch('/api/me/', { headline, bio });
      navigate('/teacher/pending-approval', { replace: true });
    } catch (err) {
      const e = err as ApiError;
      setError(e.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
          {/* Progress header */}
          <div className="bg-blue-600 px-8 py-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <School size={22} className="text-white" />
              </div>
              <div>
                <p className="text-blue-100 text-xs font-bold uppercase tracking-widest">Teacher Registration</p>
                <h1 className="text-white text-xl font-black">Set Up Your Profile</h1>
              </div>
            </div>
            {/* Step indicators */}
            <div className="flex items-center gap-2">
              <div className={`h-1.5 flex-1 rounded-full transition-all ${step >= 1 ? 'bg-white' : 'bg-white/30'}`} />
              <div className={`h-1.5 flex-1 rounded-full transition-all ${step >= 2 ? 'bg-white' : 'bg-white/30'}`} />
            </div>
            <p className="text-blue-100 text-xs font-medium mt-2">Step {step} of 2</p>
          </div>

          <div className="p-8">
            {error && (
              <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
                {error}
              </div>
            )}

            {step === 1 ? (
              <form onSubmit={handleStep1} className="space-y-5">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                    <User size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Your Name</h2>
                    <p className="text-xs text-slate-500">This is how students will see you</p>
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="e.g. Mr. Otabek Yusupov"
                  className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white outline-none transition-all font-medium text-slate-900 placeholder:text-slate-300 text-lg"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoFocus
                />

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl transition-colors shadow-lg shadow-blue-100"
                >
                  Next →
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center shrink-0">
                    <Briefcase size={20} className="text-violet-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Teaching Details</h2>
                    <p className="text-xs text-slate-500">Tell students about your expertise</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                      Headline *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Senior English Teacher | IELTS Expert"
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white outline-none transition-all font-medium text-slate-900 placeholder:text-slate-300"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <FileText size={12} /> About You (optional)
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Describe your teaching experience, certifications, and style…"
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white outline-none transition-all font-medium text-slate-900 placeholder:text-slate-300 resize-none"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setError(''); setStep(1); }}
                    className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : 'Complete Setup'}
                  </button>
                </div>

                <p className="text-center text-xs text-slate-400 font-medium">
                  After submission, an admin will review and activate your account
                  before you become visible to students.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
