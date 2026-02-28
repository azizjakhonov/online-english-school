import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Save, ArrowLeft, Loader2, Youtube, AlertCircle,
  User, Briefcase, CheckCircle2, Camera
} from 'lucide-react';
import api from '../../lib/api';
import Avatar from '../../components/Avatar';
import { useAuth } from '../auth/AuthContext';

// --- TYPES ---
interface TeacherProfileData {
  full_name: string;
  headline: string;
  bio: string;
  youtube_intro_url: string;
}

export default function TeacherSettings() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Form State
  const [formData, setFormData] = useState<TeacherProfileData>({
    full_name: '',
    headline: '',
    bio: '',
    youtube_intro_url: '',
  });

  // State for immediate preview URL (either loaded from API or local blob)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Tracks whether an avatar upload is in progress
  const [avatarUploading, setAvatarUploading] = useState(false);

  // 1. Fetch Current Data
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const { data } = await api.get('/api/me/');
        if (isMounted) {
          setFormData({
            full_name: data.full_name || '',
            headline: data.teacher_profile?.headline || '',
            bio: data.teacher_profile?.bio || '',
            youtube_intro_url: data.teacher_profile?.youtube_intro_url || '',
          });

          // profile_picture_url is already an absolute URL from the API
          if (data.profile_picture_url) {
            setPreviewUrl(data.profile_picture_url);
          }
        }
      } catch (err) {
        console.error("Failed to load settings", err);
      } finally {
        if (isMounted) setFetching(false);
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, []);

  // 2. Handle Text Changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (e.target.name === 'youtube_intro_url') setError('');
  };

  // 3. Handle File Selection — upload immediately to the dedicated avatar endpoint
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Optimistic local preview
    setPreviewUrl(URL.createObjectURL(file));
    setError('');
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      // DO NOT set Content-Type manually — axios sets it automatically
      // for FormData, including the required multipart boundary.
      const res = await api.patch('/api/accounts/avatar/', formData);

      // Replace blob URL with the permanent server URL
      setPreviewUrl(res.data.profile_picture_url);

      // Sync the global AuthContext so the new avatar persists across
      // navigation and after page refresh.
      await refreshUser();
    } catch (err: unknown) {
      let msg = 'Upload failed. Please try again.';
      if (err && typeof err === 'object' && 'response' in err) {
        const apiErr = err as { response?: { data?: { error?: string } } };
        if (apiErr.response?.data?.error) msg = apiErr.response.data.error;
      }
      setError(msg);
      // Revert preview to last known good URL
      setPreviewUrl(null);
    } finally {
      setAvatarUploading(false);
      // Reset file input so the same file can be re-selected if needed
      if (e.target) e.target.value = '';
    }
  };

  // 4. Save Changes (Updated for Multipart/Form-Data)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');

    // VALIDATION: Check YouTube URL format
    if (formData.youtube_intro_url &&
      !formData.youtube_intro_url.includes('youtube.com') &&
      !formData.youtube_intro_url.includes('youtu.be')) {
      setError('Please enter a valid YouTube link (e.g., https://youtu.be/...)');
      setLoading(false);
      return;
    }

    try {
      // Send only text fields — avatar is uploaded separately via handleFileChange
      await api.patch('/api/me/', {
        full_name: formData.full_name,
        headline: formData.headline,
        bio: formData.bio,
        youtube_intro_url: formData.youtube_intro_url,
      });

      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error("Failed to update", err);
      setError("Failed to save changes. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 size={36} className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header — same pattern as TeacherLessonHistory */}
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
            <User size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Profile Settings</h1>
            <p className="text-xs text-slate-500 font-medium">Update your personal information and teaching details</p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left: Profile preview card — rounded-2xl, same card style */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 text-center sticky top-24">
              <div className="relative w-32 h-32 mx-auto mb-4">
                <Avatar
                  url={previewUrl}
                  name={formData.full_name || 'T'}
                  size={128}
                  className="border-2 border-slate-200 shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full shadow-md border-2 border-white disabled:opacity-60 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                >
                  {avatarUploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} />
              </div>
              <h2 className="text-xl font-black text-slate-900 break-words">{formData.full_name || 'Your Name'}</h2>
              <div className="flex items-center justify-center gap-2 text-slate-500 font-medium text-sm mt-1 mb-6">
                <Briefcase size={14} />
                <span className="truncate max-w-[200px]">{formData.headline || 'Your Headline'}</span>
              </div>
              <div className="space-y-3 text-left">
                <div className="flex items-center justify-between text-sm p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-500 font-medium flex items-center gap-2"><Youtube size={16} /> Intro Video</span>
                  <span className={`font-bold ${formData.youtube_intro_url ? 'text-green-600' : 'text-slate-400'}`}>
                    {formData.youtube_intro_url ? 'Linked' : 'Not set'}
                  </span>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-slate-100">
                <p className="text-xs text-slate-500 font-medium">This is how students see your info on the teacher listing.</p>
              </div>
            </div>
          </div>

          {/* Right: Edit form — rounded-2xl, same inputs as History */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="border-b border-slate-100 px-6 py-4">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <User size={20} className="text-blue-600" /> Edit Profile Details
                </h3>
                <p className="text-slate-500 text-sm font-medium mt-0.5">Update your personal information and teaching details.</p>
              </div>

              <div className="p-6 md:p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {success && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium flex items-center gap-2">
                      <CheckCircle2 size={18} /> {success}
                    </div>
                  )}
                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium flex items-center gap-2">
                      <AlertCircle size={18} /> {error}
                    </div>
                  )}

                  <div className="space-y-4">
                    <label className="block text-sm font-bold text-slate-700">Identity</label>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Display Name</label>
                        <input
                          name="full_name"
                          value={formData.full_name}
                          onChange={handleChange}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="e.g. Mr. Otabek"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Headline (Job Title)</label>
                        <input
                          name="headline"
                          value={formData.headline}
                          onChange={handleChange}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="e.g. Senior English Teacher | IELTS Expert"
                        />
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-100" />

                  <div className="space-y-4">
                    <label className="block text-sm font-bold text-slate-700">Teaching Details</label>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Video Introduction</label>
                      <input
                        type="url"
                        name="youtube_intro_url"
                        value={formData.youtube_intro_url}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="https://youtu.be/..."
                      />
                    </div>
                  </div>

                  <hr className="border-slate-100" />

                  <div className="space-y-4">
                    <label className="block text-sm font-bold text-slate-700">About Me</label>
                    <textarea
                      name="bio"
                      rows={5}
                      value={formData.bio}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      placeholder="Tell students about your experience, certifications, and teaching style…"
                    />
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => navigate('/dashboard')}
                      className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 md:flex-initial px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                    >
                      {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}