import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Save, ArrowLeft, Loader2, Youtube, AlertCircle,
  User, Briefcase, CheckCircle2, Camera, Plus, X,
  BookOpen, Globe
} from 'lucide-react';
import api from '../../lib/api';
import Avatar from '../../components/Avatar';
import { useAuth } from '../auth/AuthContext';

// --- TYPES ---
interface Subject {
  id: number;
  name: string;
}

interface TeacherSubjectLink {
  id: number;         // TeacherSubject.id (for DELETE)
  subject_id: number;
  name: string;
}

interface Language {
  language: string;
  proficiency: string;
}

interface TeacherProfileData {
  full_name: string;
  headline: string;
  bio: string;
  youtube_intro_url: string;
}

const PROFICIENCY_OPTIONS = ['Native', 'Fluent', 'Intermediate', 'Basic'];

import { usePageTitle } from '../../lib/usePageTitle';

export default function TeacherSettings() {
  usePageTitle('Profile & Settings');
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Basic form fields
  const [formData, setFormData] = useState<TeacherProfileData>({
    full_name: '',
    headline: '',
    bio: '',
    youtube_intro_url: '',
  });

  // Subject management
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [teacherSubjectLinks, setTeacherSubjectLinks] = useState<TeacherSubjectLink[]>([]);
  const [subjectSaving, setSubjectSaving] = useState<number | null>(null); // subject id being toggled

  // Language management
  const [languages, setLanguages] = useState<Language[]>([]);
  const [newLang, setNewLang] = useState<Language>({ language: '', proficiency: 'Fluent' });

  // Avatar
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Derived set of subject IDs the teacher already has + map to link ID
  const teacherSubjectIds = new Set(teacherSubjectLinks.map(ts => ts.subject_id));
  const subjectIdToLinkId = new Map(teacherSubjectLinks.map(ts => [ts.subject_id, ts.id]));

  // 1. Fetch Current Data
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const [meRes, subjectsRes, teacherSubjectsRes] = await Promise.all([
          api.get('/api/me/'),
          api.get('/api/accounts/subjects/'),
          api.get('/api/accounts/teacher-subjects/'),
        ]);

        if (!isMounted) return;

        const data = meRes.data;
        setFormData({
          full_name: data.full_name || '',
          headline: data.teacher_profile?.headline || '',
          bio: data.teacher_profile?.bio || '',
          youtube_intro_url: data.teacher_profile?.youtube_intro_url || '',
        });
        setLanguages(data.teacher_profile?.languages || []);
        if (data.profile_picture_url) setPreviewUrl(data.profile_picture_url);

        setAllSubjects(subjectsRes.data || []);
        setTeacherSubjectLinks(teacherSubjectsRes.data || []);
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

  // 3. Avatar upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setError('');
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const res = await api.patch('/api/accounts/avatar/', fd);
      setPreviewUrl(res.data.profile_picture_url);
      await refreshUser();
    } catch (err: unknown) {
      let msg = 'Upload failed. Please try again.';
      if (err && typeof err === 'object' && 'response' in err) {
        const apiErr = err as { response?: { data?: { error?: string } } };
        if (apiErr.response?.data?.error) msg = apiErr.response.data.error;
      }
      setError(msg);
      setPreviewUrl(null);
    } finally {
      setAvatarUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  // 4. Toggle subject (add / remove)
  const handleSubjectToggle = useCallback(async (subject: Subject) => {
    setSubjectSaving(subject.id);
    try {
      if (teacherSubjectIds.has(subject.id)) {
        // Remove
        const linkId = subjectIdToLinkId.get(subject.id)!;
        await api.delete(`/api/accounts/teacher-subjects/${linkId}/`);
        setTeacherSubjectLinks(prev => prev.filter(ts => ts.id !== linkId));
      } else {
        // Add
        const res = await api.post('/api/accounts/teacher-subjects/', { subject_id: subject.id });
        setTeacherSubjectLinks(prev => [...prev, res.data]);
      }
    } catch {
      setError('Failed to update subject. Please try again.');
    } finally {
      setSubjectSaving(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherSubjectLinks]);

  // 5. Language management
  const addLanguage = () => {
    if (!newLang.language.trim()) return;
    if (languages.some(l => l.language.toLowerCase() === newLang.language.toLowerCase())) return;
    setLanguages(prev => [...prev, { language: newLang.language.trim(), proficiency: newLang.proficiency }]);
    setNewLang({ language: '', proficiency: 'Fluent' });
  };

  const removeLanguage = (index: number) => {
    setLanguages(prev => prev.filter((_, i) => i !== index));
  };

  // 6. Save basic fields + languages
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');

    if (
      formData.youtube_intro_url &&
      !formData.youtube_intro_url.includes('youtube.com') &&
      !formData.youtube_intro_url.includes('youtu.be')
    ) {
      setError('Please enter a valid YouTube link (e.g., https://youtu.be/...)');
      setLoading(false);
      return;
    }

    try {
      await api.patch('/api/me/', {
        full_name: formData.full_name,
        headline: formData.headline,
        bio: formData.bio,
        youtube_intro_url: formData.youtube_intro_url,
        languages,
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
      {/* Header */}
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

          {/* Left: Preview card */}
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
                  <span className="text-slate-500 font-medium flex items-center gap-2"><BookOpen size={16} /> Subjects</span>
                  <span className="font-bold text-blue-600">{teacherSubjectLinks.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-500 font-medium flex items-center gap-2"><Globe size={16} /> Languages</span>
                  <span className="font-bold text-blue-600">{languages.length}</span>
                </div>
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

          {/* Right: Edit form */}
          <div className="md:col-span-2 space-y-6">

            {/* ── BASIC INFO FORM ── */}
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

            {/* ── SUBJECTS SECTION ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="border-b border-slate-100 px-6 py-4">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <BookOpen size={20} className="text-blue-600" /> Subjects You Teach
                </h3>
                <p className="text-slate-500 text-sm font-medium mt-0.5">Select the subjects you teach. Students can search by subject.</p>
              </div>
              <div className="p-6">
                {allSubjects.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No subjects available. Ask an admin to add subjects.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {allSubjects.map(subject => {
                      const isSelected = teacherSubjectIds.has(subject.id);
                      const isSaving = subjectSaving === subject.id;
                      return (
                        <button
                          key={subject.id}
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleSubjectToggle(subject)}
                          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                            } disabled:opacity-60`}
                        >
                          {isSaving ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : isSelected ? (
                            <CheckCircle2 size={14} />
                          ) : (
                            <Plus size={14} />
                          )}
                          {subject.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── LANGUAGES SECTION ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="border-b border-slate-100 px-6 py-4">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Globe size={20} className="text-blue-600" /> Languages
                </h3>
                <p className="text-slate-500 text-sm font-medium mt-0.5">Languages you speak. Saved with the main form.</p>
              </div>
              <div className="p-6 space-y-4">
                {/* Existing languages */}
                {languages.length > 0 && (
                  <div className="space-y-2">
                    {languages.map((lang, i) => (
                      <div key={i} className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                        <Globe size={16} className="text-blue-500 shrink-0" />
                        <span className="text-sm font-bold text-slate-800 flex-1">{lang.language}</span>
                        <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                          {lang.proficiency}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeLanguage(i)}
                          className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new language */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newLang.language}
                    onChange={e => setNewLang(n => ({ ...n, language: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLanguage())}
                    placeholder="Language (e.g. English)"
                    className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <select
                    value={newLang.proficiency}
                    onChange={e => setNewLang(n => ({ ...n, proficiency: e.target.value }))}
                    className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {PROFICIENCY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={addLanguage}
                    disabled={!newLang.language.trim()}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <Plus size={16} /> Add
                  </button>
                </div>
                <p className="text-xs text-slate-400">Click <strong>Save Changes</strong> above to persist language changes.</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}