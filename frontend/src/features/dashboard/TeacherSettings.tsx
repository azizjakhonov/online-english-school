import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Save, ArrowLeft, Loader2, Youtube, AlertCircle,
  User, Briefcase, DollarSign, FileText, CheckCircle2, Camera
} from 'lucide-react';
import api from '../../lib/api';
import Avatar from '../../components/Avatar';
import { useAuth } from '../auth/AuthContext';

// --- TYPES ---
interface TeacherProfileData {
  full_name: string;
  headline: string;
  bio: string;
  hourly_rate: string;
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
    hourly_rate: '',
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
            hourly_rate: data.teacher_profile?.hourly_rate || '15.00',
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
        hourly_rate: formData.hourly_rate,
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

  if (fetching) return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading Profile...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">

        {/* Navigation */}
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold mb-6 transition-colors">
          <ArrowLeft size={20} /> Back to Dashboard
        </button>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* LEFT COLUMN: Profile Preview Card */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 text-center sticky top-6">

              {/* PROFILE PICTURE AREA */}
              <div className="relative w-32 h-32 mx-auto mb-4">
                <Avatar
                  url={previewUrl}
                  name={formData.full_name || 'T'}
                  size={128}
                  className="border-4 border-white shadow-lg"
                />

                {/* Camera Overlay Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full shadow-md transition-transform active:scale-95 border-2 border-white disabled:opacity-60"
                >
                  {avatarUploading
                    ? <Loader2 size={18} className="animate-spin" />
                    : <Camera size={18} />}
                </button>

                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                />
              </div>

              <h2 className="text-xl font-black text-slate-900 break-words">
                {formData.full_name || 'Your Name'}
              </h2>

              <div className="flex items-center justify-center gap-2 text-slate-500 font-medium text-sm mt-1 mb-6">
                <Briefcase size={14} />
                <span className="truncate max-w-[200px]">
                  {formData.headline || 'Your Headline'}
                </span>
              </div>

              {/* Mini Stats / Preview Info */}
              <div className="space-y-3 text-left">
                <div className="flex items-center justify-between text-sm p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-500 flex items-center gap-2"><DollarSign size={16} /> Hourly Rate</span>
                  <span className="font-bold text-slate-900">${formData.hourly_rate}</span>
                </div>

                <div className="flex items-center justify-between text-sm p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-500 flex items-center gap-2"><Youtube size={16} /> Intro Video</span>
                  <span className={`font-bold ${formData.youtube_intro_url ? 'text-green-600' : 'text-slate-400'}`}>
                    {formData.youtube_intro_url ? 'Linked' : 'Not Set'}
                  </span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100">
                <p className="text-xs text-slate-400">This is how students will see your basic info on the teacher listing.</p>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Edit Form */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">

              {/* Header like a Tab */}
              <div className="border-b border-slate-100 p-6 bg-white">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <User size={20} className="text-blue-600" /> Edit Profile Details
                </h3>
                <p className="text-slate-500 text-sm mt-1">Update your personal information and teaching details.</p>
              </div>

              <div className="p-6 md:p-8">
                <form onSubmit={handleSubmit} className="space-y-6">

                  {/* SUCCESS MESSAGE */}
                  {success && (
                    <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 size={18} /> {success}
                    </div>
                  )}

                  {/* ERROR MESSAGE */}
                  {error && (
                    <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 animate-in fade-in">
                      <AlertCircle size={18} /> {error}
                    </div>
                  )}

                  {/* --- Section: Identity --- */}
                  <div className="space-y-4">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Identity</label>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="text-sm font-bold text-slate-700 mb-1 block">Display Name</label>
                        <input
                          name="full_name"
                          value={formData.full_name}
                          onChange={handleChange}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none font-medium transition-all"
                          placeholder="e.g. Mr. Otabek"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-bold text-slate-700 mb-1 block">Headline (Job Title)</label>
                        <input
                          name="headline"
                          value={formData.headline}
                          onChange={handleChange}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none font-medium transition-all"
                          placeholder="e.g. Senior English Teacher | IELTS Expert"
                        />
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-100" />

                  {/* --- Section: Teaching Details --- */}
                  <div className="space-y-4">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Teaching Details</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-sm font-bold text-slate-700 mb-1 block flex items-center gap-2">
                          <DollarSign size={16} /> Hourly Rate ($)
                        </label>
                        <input
                          name="hourly_rate"
                          type="number"
                          value={formData.hourly_rate}
                          onChange={handleChange}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none font-medium transition-all"
                          placeholder="15.00"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-bold text-slate-700 mb-1 block flex items-center gap-2">
                          <Youtube size={18} className="text-red-600" /> Video Introduction
                        </label>
                        <input
                          type="url"
                          name="youtube_intro_url"
                          value={formData.youtube_intro_url}
                          onChange={handleChange}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none font-medium text-slate-600 transition-all placeholder:text-slate-400"
                          placeholder="https://youtu.be/..."
                        />
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-100" />

                  {/* --- Section: About --- */}
                  <div className="space-y-4">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <FileText size={14} /> About Me
                    </label>
                    <div>
                      <textarea
                        name="bio"
                        rows={6}
                        value={formData.bio}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none font-medium resize-none transition-all leading-relaxed"
                        placeholder="Tell students about your experience, certifications, and teaching style..."
                      />
                    </div>
                  </div>

                  {/* SUBMIT BUTTON */}
                  <div className="pt-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
                    >
                      {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
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