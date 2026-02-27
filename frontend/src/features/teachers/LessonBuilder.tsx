import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  Brain,
  Copy,
  FileText,
  Image as ImageIcon,
  Layout,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  UploadCloud,
  Video,
  Volume2,
  Check,
} from 'lucide-react';

import api from '../../lib/api';

type BuilderMode = 'lesson' | 'homework';
type ActivityType = 'image' | 'video' | 'matching' | 'gap_fill' | 'quiz' | 'pdf' | 'listening';

interface Unit {
  id: number;
  title: string;
}

interface ActivityContent {
  url?: string;
  text?: string;
  pairs?: Array<{ left: string; right: string }>;
  question?: string;
  options?: string[];
  correct_index?: number;
  pdf_id?: number;
  pdf_title?: string;
  audio_id?: number;
  audio_title?: string;
  sub_type?: 'quiz' | 'true_false' | 'open';
  correct_bool?: boolean;
  keywords?: string[];
}

interface ActivityDraft {
  localId: string;
  title: string;
  type: ActivityType;
  points: number;
  content: ActivityContent;
}

interface LessonTemplate {
  id: number;
  title: string;
  unit: number;
  description: string;
  activities: Array<{
    id: number;
    title: string;
    activity_type: ActivityType;
    order: number;
    content: ActivityContent;
  }>;
}

interface HomeworkTemplate {
  id: number;
  title: string;
  level: string;
  description: string;
  activities: Array<{
    id: number;
    activity_type: ActivityType;
    order: number;
    content: ActivityContent;
    points: number;
  }>;
}

interface LibraryItem {
  id: number;
  title: string;
  subtitle: string;
}

const HOMEWORK_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
const LESSON_ACTIVITY_TYPES: ActivityType[] = ['image', 'video', 'pdf', 'listening', 'matching', 'gap_fill', 'quiz'];
const HOMEWORK_ACTIVITY_TYPES: ActivityType[] = ['listening', 'matching', 'gap_fill', 'quiz'];

const CARD_CLASS = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
const FIELD_CLASS =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500';

const ACTIVITY_META: Record<
  ActivityType,
  { label: string; icon: LucideIcon; accent: string; badge: string; helper: string }
> = {
  image: {
    label: 'Image',
    icon: ImageIcon,
    accent: 'bg-blue-50 text-blue-700 border-blue-100',
    badge: 'bg-blue-100 text-blue-700',
    helper: 'Use a direct image URL for best compatibility.',
  },
  video: {
    label: 'Video',
    icon: Video,
    accent: 'bg-rose-50 text-rose-700 border-rose-100',
    badge: 'bg-rose-100 text-rose-700',
    helper: 'Paste a full YouTube or hosted video URL.',
  },
  pdf: {
    label: 'PDF',
    icon: FileText,
    accent: 'bg-amber-50 text-amber-700 border-amber-100',
    badge: 'bg-amber-100 text-amber-700',
    helper: 'Upload a PDF to link a reading activity.',
  },
  matching: {
    label: 'Matching',
    icon: Brain,
    accent: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    badge: 'bg-emerald-100 text-emerald-700',
    helper: 'Create pairs of items that should be matched together.',
  },
  gap_fill: {
    label: 'Gap Fill',
    icon: Layout,
    accent: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    badge: 'bg-indigo-100 text-indigo-700',
    helper: 'Wrap expected answers in braces, for example {word}.',
  },
  quiz: {
    label: 'Quiz',
    icon: Brain,
    accent: 'bg-violet-50 text-violet-700 border-violet-100',
    badge: 'bg-violet-100 text-violet-700',
    helper: 'Create multiple choice questions with options.',
  },
  listening: {
    label: 'Listening',
    icon: Volume2,
    accent: 'bg-cyan-50 text-cyan-700 border-cyan-100',
    badge: 'bg-cyan-100 text-cyan-700',
    helper: 'Upload audio for comprehension tasks.',
  },
};

function randomId() {
  return Math.random().toString(36).slice(2, 11);
}

function defaultContent(type: ActivityType): ActivityContent {
  if (type === 'quiz') return { question: '', options: ['', '', '', ''], correct_index: 0 };
  if (type === 'matching') return { pairs: [{ left: '', right: '' }] };
  if (type === 'gap_fill') return { text: 'The {sky} is blue.' };
  if (type === 'listening') return { sub_type: 'quiz', question: '', options: ['', ''], correct_index: 0 };
  return {};
}

function defaultTitle(type: ActivityType) {
  switch (type) {
    case 'image':
      return 'Image Slide';
    case 'video':
      return 'Video';
    case 'matching':
      return 'Matching';
    case 'gap_fill':
      return 'Gap Fill';
    case 'quiz':
      return 'Quiz';
    case 'pdf':
      return 'PDF';
    default:
      return 'Activity';
  }
}

export default function LessonBuilder() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id?: string }>();

  const routeMode: BuilderMode = useMemo(
    () => (location.pathname.includes('/builder/homework') ? 'homework' : 'lesson'),
    [location.pathname],
  );
  const editingId = id ? Number(id) : null;
  const isEditing = editingId !== null && Number.isFinite(editingId);

  const [mode, setMode] = useState<BuilderMode>(routeMode);
  const [title, setTitle] = useState('');
  const [unitId, setUnitId] = useState('');
  const [hwLevel, setHwLevel] = useState('A1');
  const [hwDescription, setHwDescription] = useState('');

  const [units, setUnits] = useState<Unit[]>([]);
  const [activities, setActivities] = useState<ActivityDraft[]>([]);

  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryNonce, setLibraryNonce] = useState(0);

  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPdfFor, setUploadingPdfFor] = useState<string | null>(null);
  const [uploadingAudioFor, setUploadingAudioFor] = useState<string | null>(null);

  const activityTypeOptions = mode === 'lesson' ? LESSON_ACTIVITY_TYPES : HOMEWORK_ACTIVITY_TYPES;
  const totalPoints = useMemo(
    () => activities.reduce((sum, activity) => sum + (activity.points || 0), 0),
    [activities],
  );
  const mediaBlocks = useMemo(
    () =>
      activities.filter(
        (activity) =>
          activity.type === 'image' || activity.type === 'video' || activity.type === 'pdf',
      ).length,
    [activities],
  );

  useEffect(() => {
    setMode(routeMode);
  }, [routeMode]);

  useEffect(() => {
    api
      .get<Unit[]>('/api/curriculum/units/')
      .then((res) => setUnits(res.data))
      .catch(() => { });
  }, []);

  const resetForm = (nextMode: BuilderMode) => {
    setTitle('');
    setActivities([]);
    if (nextMode === 'lesson') {
      setUnitId('');
    } else {
      setHwLevel('A1');
      setHwDescription('');
    }
  };

  const fetchLibrary = useCallback(async () => {
    setLibraryLoading(true);
    try {
      if (mode === 'lesson') {
        const res = await api.get<LessonTemplate[]>('/api/curriculum/lessons/', {
          params: { q: libraryQuery || undefined },
        });
        setLibraryItems(
          res.data.map((item) => ({
            id: item.id,
            title: item.title,
            subtitle: `Unit #${item.unit}`,
          })),
        );
      } else {
        const res = await api.get<Array<{ id: number; title: string; level: string }>>(
          '/api/homework/templates/',
          {
            params: { q: libraryQuery || undefined },
          },
        );
        setLibraryItems(
          res.data.map((item) => ({
            id: item.id,
            title: item.title,
            subtitle: item.level || 'Homework',
          })),
        );
      }
    } catch (error) {
      console.error('Library fetch failed', error);
    } finally {
      setLibraryLoading(false);
    }
  }, [mode, libraryQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchLibrary();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [fetchLibrary, libraryNonce]);

  const loadTemplate = async (templateId: number, activeMode: BuilderMode) => {
    setLoadingTemplate(true);
    try {
      if (activeMode === 'lesson') {
        const res = await api.get<LessonTemplate>(`/api/curriculum/lessons/${templateId}/`);
        setTitle(res.data.title || '');
        setUnitId(String(res.data.unit || ''));
        setActivities(
          (res.data.activities || []).map((activity) => ({
            localId: String(activity.id),
            title: activity.title || defaultTitle(activity.activity_type),
            type: activity.activity_type,
            points: 10,
            content: activity.content || {},
          })),
        );
      } else {
        const res = await api.get<HomeworkTemplate>(`/api/homework/templates/${templateId}/`);
        setTitle(res.data.title || '');
        setHwLevel(res.data.level || 'A1');
        setHwDescription(res.data.description || '');
        setActivities(
          (res.data.activities || []).map((activity) => ({
            localId: String(activity.id),
            title: defaultTitle(activity.activity_type),
            type: activity.activity_type,
            points: activity.points || 10,
            content: activity.content || {},
          })),
        );
      }
    } catch (error) {
      console.error('Template load failed', error);
      alert('Failed to load template.');
    } finally {
      setLoadingTemplate(false);
    }
  };

  useEffect(() => {
    if (!isEditing || !editingId) {
      resetForm(mode);
      return;
    }
    void loadTemplate(editingId, mode);
  }, [mode, isEditing, editingId]);

  const goToNew = (nextMode: BuilderMode) => navigate(`/builder/${nextMode}/new`);
  const goToEdit = (nextMode: BuilderMode, templateId: number) =>
    navigate(`/builder/${nextMode}/${templateId}`);

  const addActivity = (type: ActivityType) => {
    setActivities((prev) => [
      ...prev,
      {
        localId: randomId(),
        title: defaultTitle(type),
        type,
        points: 10,
        content: defaultContent(type),
      },
    ]);
  };

  const patchActivity = (localId: string, patch: Partial<ActivityDraft>) => {
    setActivities((prev) =>
      prev.map((activity) => (activity.localId === localId ? { ...activity, ...patch } : activity)),
    );
  };

  const patchActivityContent = (localId: string, patch: Partial<ActivityContent>) => {
    setActivities((prev) =>
      prev.map((activity) =>
        activity.localId === localId
          ? { ...activity, content: { ...activity.content, ...patch } }
          : activity,
      ),
    );
  };

  const removeActivity = (localId: string) => {
    setActivities((prev) => prev.filter((activity) => activity.localId !== localId));
  };

  const uploadPdf = async (localId: string, file: File) => {
    setUploadingPdfFor(localId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name.replace(/\.pdf$/i, ''));
      const res = await api.post('/api/curriculum/pdfs/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      patchActivityContent(localId, { pdf_id: res.data.id, pdf_title: res.data.title });
    } catch (error) {
      console.error('PDF upload failed', error);
      alert('PDF upload failed.');
    } finally {
      setUploadingPdfFor(null);
    }
  };

  const uploadAudio = async (localId: string, file: File) => {
    setUploadingAudioFor(localId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name.replace(/\.(mp3|wav|m4a|ogg)$/i, ''));
      const res = await api.post('/api/curriculum/audio/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      patchActivityContent(localId, { audio_id: res.data.id, audio_title: res.data.title });
    } catch (error) {
      console.error('Audio upload failed', error);
      alert('Audio upload failed.');
    } finally {
      setUploadingAudioFor(null);
    }
  };

  const save = async () => {
    if (!title.trim()) {
      alert('Please provide title.');
      return;
    }
    if (mode === 'lesson' && !unitId) {
      alert('Please choose unit.');
      return;
    }
    if (activities.length === 0) {
      alert('Please add at least one activity.');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'lesson') {
        const payload = {
          title,
          unit: Number(unitId),
          order: 1,
          description: 'Lesson',
          activities: activities.map((activity, idx) => ({
            title: activity.title || defaultTitle(activity.type),
            activity_type: activity.type,
            order: idx + 1,
            content: activity.content,
          })),
        };

        const res =
          isEditing && editingId
            ? await api.patch<LessonTemplate>(`/api/curriculum/lessons/${editingId}/`, payload)
            : await api.post<LessonTemplate>('/api/curriculum/lessons/', payload);

        if (!isEditing) navigate(`/builder/lesson/${res.data.id}`);
      } else {
        const payload = {
          title,
          level: hwLevel,
          description: hwDescription,
          activities: activities.map((activity, idx) => ({
            activity_type: activity.type,
            order: idx + 1,
            points: activity.points || 10,
            content: activity.content,
          })),
        };

        const res =
          isEditing && editingId
            ? await api.patch<HomeworkTemplate>(`/api/homework/templates/${editingId}/`, payload)
            : await api.post<HomeworkTemplate>('/api/homework/templates/', payload);

        if (!isEditing) navigate(`/builder/homework/${res.data.id}`);
      }

      setLibraryNonce((prev) => prev + 1);
      alert('Saved successfully.');
    } catch (error) {
      console.error('Save failed', error);
      alert('Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (templateId: number) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      if (mode === 'lesson') {
        await api.delete(`/api/curriculum/lessons/${templateId}/`);
      } else {
        await api.delete(`/api/homework/templates/${templateId}/`);
      }
      if (editingId === templateId) goToNew(mode);
      setLibraryNonce((prev) => prev + 1);
    } catch (error) {
      console.error('Delete failed', error);
      alert('Delete failed.');
    }
  };

  const duplicateTemplate = async (templateId: number) => {
    try {
      if (mode === 'lesson') {
        const res = await api.post<LessonTemplate>(`/api/curriculum/lessons/${templateId}/duplicate/`);
        navigate(`/builder/lesson/${res.data.id}`);
      } else {
        const res = await api.post<HomeworkTemplate>(`/api/homework/templates/${templateId}/duplicate/`);
        navigate(`/builder/homework/${res.data.id}`);
      }
      setLibraryNonce((prev) => prev + 1);
    } catch (error) {
      console.error('Duplicate failed', error);
      alert('Duplicate failed.');
    }
  };

  const switchMode = (nextMode: BuilderMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setLibraryQuery('');
    resetForm(nextMode);
    goToNew(nextMode);
  };

  const renderActivityEditor = (activity: ActivityDraft) => {
    if (activity.type === 'video') {
      return (
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Video URL</label>
          <input
            value={activity.content.url || ''}
            onChange={(e) => patchActivityContent(activity.localId, { url: e.target.value })}
            placeholder="https://www.youtube.com/watch?v=..."
            className={FIELD_CLASS}
          />
        </div>
      );
    }

    if (activity.type === 'image') {
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Image URL</label>
            <input
              value={activity.content.url || ''}
              onChange={(e) => patchActivityContent(activity.localId, { url: e.target.value })}
              placeholder="https://example.com/image.jpg"
              className={FIELD_CLASS}
            />
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
            <UploadCloud size={14} /> Upload image from device (preview only)
            <input type="file" accept="image/*" className="hidden" />
          </label>
        </div>
      );
    }

    if (activity.type === 'pdf') {
      return (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {activity.content.pdf_id
              ? `PDF linked: ${activity.content.pdf_title || activity.content.pdf_id}`
              : 'No PDF linked yet.'}
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
            <UploadCloud size={14} />
            {uploadingPdfFor === activity.localId ? 'Uploading...' : 'Upload PDF'}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void uploadPdf(activity.localId, file);
                }
              }}
            />
          </label>
        </div>
      );
    }

    if (activity.type === 'gap_fill') {
      return (
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gap Text</label>
          <textarea
            value={activity.content.text || ''}
            onChange={(e) => patchActivityContent(activity.localId, { text: e.target.value })}
            rows={3}
            placeholder="Use braces around answers, for example: The {sky} is blue."
            className={FIELD_CLASS}
          />
        </div>
      );
    }

    if (activity.type === 'matching') {
      const pairs = activity.content.pairs || [{ left: '', right: '' }];
      const addPair = () => {
        patchActivityContent(activity.localId, { pairs: [...pairs, { left: '', right: '' }] });
      };
      const removePair = (idx: number) => {
        if (pairs.length <= 1) return;
        patchActivityContent(activity.localId, {
          pairs: pairs.filter((_, i) => i !== idx),
        });
      };
      const updatePair = (idx: number, patch: { left?: string; right?: string }) => {
        patchActivityContent(activity.localId, {
          pairs: pairs.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
        });
      };

      return (
        <div className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Matching Pairs</label>
          <div className="space-y-2">
            {pairs.map((pair, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={pair.left}
                  onChange={(e) => updatePair(i, { left: e.target.value })}
                  placeholder="Left item"
                  className={FIELD_CLASS}
                />
                <input
                  value={pair.right}
                  onChange={(e) => updatePair(i, { right: e.target.value })}
                  placeholder="Right item"
                  className={FIELD_CLASS}
                />
                <button
                  onClick={() => removePair(i)}
                  className="rounded-xl border border-red-200 bg-red-50 p-2 text-red-600 transition-colors hover:bg-red-100"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addPair}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            <Plus size={14} /> Add Pair
          </button>
        </div>
      );
    }

    if (activity.type === 'listening') {
      const subType = activity.content.sub_type || 'quiz';
      const options = activity.content.options || ['', ''];

      const updateOption = (idx: number, val: string) => {
        patchActivityContent(activity.localId, {
          options: options.map((opt, i) => (i === idx ? val : opt)),
        });
      };

      return (
        <div className="space-y-6">
          {/* Audio Upload Section */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500">Audio Source</label>
              {activity.content.audio_id && (
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                  <Check size={12} strokeWidth={3} /> {activity.content.audio_title || 'Audio Linked'}
                </span>
              )}
            </div>
            <label className="flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-6 transition-colors hover:border-blue-300 hover:bg-blue-50/30">
              <UploadCloud size={24} className="mb-2 text-slate-400" />
              <span className="text-sm font-bold text-slate-600">
                {uploadingAudioFor === activity.localId ? 'Uploading File...' : 'Click to upload audio (MP3, WAV)'}
              </span>
              <span className="mt-1 text-xs text-slate-400">Max size: 10MB</span>
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadAudio(activity.localId, file);
                }}
              />
            </label>
          </div>

          {/* Sub-type Selection */}
          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500">Task Style</label>
            <div className="grid grid-cols-3 gap-2">
              {(['quiz', 'true_false', 'open'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => patchActivityContent(activity.localId, {
                    sub_type: t,
                    // Reset fields based on type if needed
                    options: t === 'quiz' ? ['', '', '', ''] : t === 'true_false' ? ['True', 'False'] : [],
                    correct_index: 0,
                    correct_bool: t === 'true_false' ? true : undefined,
                    keywords: t === 'open' ? [] : undefined
                  })}
                  className={`rounded-xl border-2 py-2.5 text-xs font-black uppercase tracking-tight transition-all
                    ${subType === t
                      ? 'border-blue-500 bg-blue-50 text-blue-600 shadow-sm'
                      : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                    }
                  `}
                >
                  {t.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Configuration based on sub-type */}
          <div className="space-y-4 rounded-2xl bg-white p-5 border border-slate-100">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Question / Prompt</label>
              <input
                value={activity.content.question || ''}
                onChange={(e) => patchActivityContent(activity.localId, { question: e.target.value })}
                placeholder="e.g. What did the speaker buy?"
                className={FIELD_CLASS}
              />
            </div>

            {subType === 'quiz' && (
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700">Options</label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={activity.content.correct_index === i}
                        onChange={() => patchActivityContent(activity.localId, { correct_index: i })}
                        className="h-4 w-4 accent-blue-600"
                      />
                      <input
                        value={opt}
                        onChange={(e) => updateOption(i, e.target.value)}
                        placeholder={`Option ${i + 1}`}
                        className={FIELD_CLASS}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {subType === 'true_false' && (
              <div className="flex items-center gap-4">
                <label className="text-xs font-bold text-slate-700">Correct Answer:</label>
                <div className="flex gap-2">
                  {[true, false].map((val) => (
                    <button
                      key={String(val)}
                      onClick={() => patchActivityContent(activity.localId, { correct_bool: val })}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all
                        ${activity.content.correct_bool === val
                          ? val ? 'bg-green-100 text-green-700 ring-1 ring-green-500' : 'bg-red-100 text-red-700 ring-1 ring-red-500'
                          : 'bg-slate-100 text-slate-500'
                        }
                      `}
                    >
                      {val ? 'TRUE' : 'FALSE'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {subType === 'open' && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Target Keywords (Comma-separated)</label>
                <input
                  value={(activity.content.keywords || []).join(', ')}
                  onChange={(e) => patchActivityContent(activity.localId, {
                    keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean)
                  })}
                  placeholder="e.g. water, glass, table"
                  className={FIELD_CLASS}
                />
                <p className="text-[10px] font-medium text-slate-400 italic">
                  Student must mention at least one of these to be marked correct.
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activity.type === 'quiz') {
      const options = activity.content.options || ['', '', '', ''];
      const updateOption = (idx: number, val: string) => {
        patchActivityContent(activity.localId, {
          options: options.map((opt, i) => (i === idx ? val : opt)),
        });
      };
      const addOption = () => {
        patchActivityContent(activity.localId, {
          options: [...options, ''],
        });
      };
      const removeOption = (idx: number) => {
        if (options.length <= 2) return;
        let nextCorrect = activity.content.correct_index || 0;
        if (nextCorrect === idx) nextCorrect = 0;
        else if (nextCorrect > idx) nextCorrect--;

        patchActivityContent(activity.localId, {
          options: options.filter((_, i) => i !== idx),
          correct_index: nextCorrect,
        });
      };

      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Question</label>
            <input
              value={activity.content.question || ''}
              onChange={(e) => patchActivityContent(activity.localId, { question: e.target.value })}
              placeholder="Enter a question"
              className={FIELD_CLASS}
            />
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Options (Check the circle for the correct answer)
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name={`correct-${activity.localId}`}
                    checked={activity.content.correct_index === i}
                    onChange={() => patchActivityContent(activity.localId, { correct_index: i })}
                    className="h-4 w-4 accent-blue-600"
                  />
                  <div className="relative flex-1">
                    <input
                      value={opt}
                      onChange={(e) => updateOption(i, e.target.value)}
                      placeholder={`Option ${i + 1}`}
                      className={FIELD_CLASS}
                    />
                    {options.length > 2 && (
                      <button
                        onClick={() => removeOption(i)}
                        className="absolute right-2 top-1.5 p-1 text-slate-300 hover:text-red-500"
                        title="Remove Option"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={addOption}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            <Plus size={14} /> Add Option
          </button>
        </div>
      );
    }

    return null;
  };

  const modeTitle = mode === 'lesson' ? 'Lesson Library + Builder' : 'Homework Library + Builder';
  const modeSubtitle =
    mode === 'lesson'
      ? 'Manage reusable lesson templates with media and interactive activities.'
      : 'Build homework templates with levels, points, and structured tasks.';

  const stats = [
    {
      label: 'Library Items',
      value: libraryItems.length,
      icon: mode === 'lesson' ? Layout : Brain,
      tone: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Activities',
      value: activities.length,
      icon: FileText,
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: mode === 'lesson' ? 'Media Blocks' : 'Total Points',
      value: mode === 'lesson' ? mediaBlocks : totalPoints,
      icon: mode === 'lesson' ? ImageIcon : Brain,
      tone: 'bg-indigo-50 text-indigo-700',
    },
    {
      label: 'Template State',
      value: isEditing && editingId ? `#${editingId}` : 'New Draft',
      icon: Save,
      tone: 'bg-slate-100 text-slate-700',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="rounded-xl bg-slate-100 p-2 text-slate-600 transition-colors hover:bg-slate-200"
              aria-label="Back"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
              <div
                className={`rounded-xl p-2.5 ${mode === 'lesson' ? 'bg-blue-100 text-blue-600' : 'bg-indigo-100 text-indigo-600'
                  }`}
              >
                {mode === 'lesson' ? <Layout size={20} /> : <Brain size={20} />}
              </div>
              <div>
                <h1 className="text-lg font-black sm:text-xl">{modeTitle}</h1>
                <p className="text-xs font-medium text-slate-500">{modeSubtitle}</p>
              </div>
            </div>
          </div>

          <button
            onClick={save}
            disabled={saving || loadingTemplate}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving...' : isEditing ? 'Update Template' : 'Create Template'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className={`${CARD_CLASS} flex items-center gap-4 p-4`}>
                <div className={`rounded-xl p-3 ${stat.tone}`}>
                  <Icon size={18} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{stat.label}</p>
                  <p className="text-xl font-black text-slate-900">{stat.value}</p>
                </div>
              </div>
            );
          })}
        </section>

        <section className="mb-6 flex justify-center sm:justify-start">
          <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              onClick={() => switchMode('lesson')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${mode === 'lesson' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              <Layout size={15} /> Lesson Templates
            </button>
            <button
              onClick={() => switchMode('homework')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${mode === 'homework' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              <Brain size={15} /> Homework Templates
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
          <aside className={`${CARD_CLASS} h-fit p-4 lg:sticky lg:top-24`}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-900">Template Library</h2>
                <p className="text-xs font-medium text-slate-500">Search, edit, duplicate, or remove templates.</p>
              </div>
              <button
                onClick={() => setLibraryNonce((prev) => prev + 1)}
                className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Refresh templates"
              >
                <RefreshCw size={15} />
              </button>
            </div>

            <div className="relative mb-3">
              <Search size={14} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
              <input
                value={libraryQuery}
                onChange={(e) => setLibraryQuery(e.target.value)}
                placeholder="Search templates"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-8 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={() => goToNew(mode)}
              className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700"
            >
              <Plus size={14} /> New {mode === 'lesson' ? 'Lesson' : 'Homework'}
            </button>

            {libraryLoading ? (
              <div className="py-10 text-center text-slate-500">
                <Loader2 size={18} className="mx-auto animate-spin" />
              </div>
            ) : libraryItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <p className="text-sm font-semibold text-slate-700">No templates found</p>
                <p className="mt-1 text-xs text-slate-500">Try another search or create a new template.</p>
              </div>
            ) : (
              <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                {libraryItems.map((item) => {
                  const active = editingId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-3 transition-colors ${active
                        ? 'border-blue-300 bg-blue-50/70 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                    >
                      <p className="truncate text-sm font-bold text-slate-900">{item.title}</p>
                      <p className="mb-3 truncate text-xs font-medium text-slate-500">{item.subtitle}</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => goToEdit(mode, item.id)}
                          className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => duplicateTemplate(item.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          <Copy size={11} /> Copy
                        </button>
                        <button
                          onClick={() => deleteTemplate(item.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>

          <section className="space-y-6">
            {loadingTemplate ? (
              <div className={`${CARD_CLASS} p-16 text-center text-slate-500`}>
                <Loader2 size={24} className="mx-auto animate-spin" />
                <p className="mt-3 text-sm font-medium">Loading template...</p>
              </div>
            ) : (
              <>
                <div className={`${CARD_CLASS} p-6`}>
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-black text-slate-900">Template Details</h2>
                      <p className="text-xs font-medium text-slate-500">
                        Configure the template header and metadata before adding activities.
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {isEditing && editingId ? `Editing #${editingId}` : 'New Template'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-bold text-slate-700">Title</label>
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Enter template title"
                        className={FIELD_CLASS}
                      />
                    </div>

                    {mode === 'lesson' ? (
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700">Unit</label>
                        <select
                          value={unitId}
                          onChange={(e) => setUnitId(e.target.value)}
                          className={FIELD_CLASS}
                        >
                          <option value="">Select unit</option>
                          {units.map((unit) => (
                            <option key={unit.id} value={unit.id}>
                              {unit.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700">Level</label>
                        <select
                          value={hwLevel}
                          onChange={(e) => setHwLevel(e.target.value)}
                          className={FIELD_CLASS}
                        >
                          {HOMEWORK_LEVELS.map((level) => (
                            <option key={level} value={level}>
                              {level}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {mode === 'homework' && (
                    <div className="mt-4">
                      <label className="mb-2 block text-sm font-bold text-slate-700">Description</label>
                      <textarea
                        value={hwDescription}
                        onChange={(e) => setHwDescription(e.target.value)}
                        rows={4}
                        placeholder="Describe what learners should complete."
                        className={FIELD_CLASS}
                      />
                    </div>
                  )}
                </div>

                <div className={`${CARD_CLASS} p-5`}>
                  <div className="mb-4">
                    <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">Add Activity</h3>
                    <p className="text-xs font-medium text-slate-500">
                      Select an activity type and then customize its content below.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {activityTypeOptions.map((type) => {
                      const meta = ACTIVITY_META[type];
                      const Icon = meta.icon;
                      return (
                        <button
                          key={type}
                          onClick={() => addActivity(type)}
                          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition-colors hover:brightness-95 ${meta.accent}`}
                        >
                          <Icon size={14} /> {meta.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {activities.length === 0 ? (
                  <div className={`${CARD_CLASS} p-10 text-center`}>
                    <FileText size={30} className="mx-auto text-slate-300" />
                    <h3 className="mt-3 text-base font-bold text-slate-900">No activities added yet</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Start by adding at least one activity from the panel above.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activities.map((activity, idx) => {
                      const meta = ACTIVITY_META[activity.type];
                      const Icon = meta.icon;
                      return (
                        <article key={activity.localId} className={`${CARD_CLASS} p-4 sm:p-5`}>
                          <div className="mb-4 flex flex-wrap items-center gap-2">
                            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">
                              #{idx + 1}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${meta.badge}`}
                            >
                              <Icon size={12} /> {meta.label}
                            </span>
                            <p className="text-xs font-medium text-slate-500">{meta.helper}</p>
                          </div>

                          <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
                            <input
                              value={activity.title}
                              onChange={(e) => patchActivity(activity.localId, { title: e.target.value })}
                              placeholder="Activity title"
                              className="min-w-[200px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />

                            <select
                              value={activity.type}
                              onChange={(e) => {
                                const nextType = e.target.value as ActivityType;
                                patchActivity(activity.localId, {
                                  type: nextType,
                                  content: defaultContent(nextType),
                                  title: defaultTitle(nextType),
                                });
                              }}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {activityTypeOptions.map((type) => (
                                <option key={type} value={type}>
                                  {ACTIVITY_META[type].label}
                                </option>
                              ))}
                            </select>

                            {mode === 'homework' && (
                              <input
                                type="number"
                                value={activity.points}
                                onChange={(e) =>
                                  patchActivity(activity.localId, {
                                    points: parseInt(e.target.value, 10) || 0,
                                  })
                                }
                                className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                aria-label="Points"
                              />
                            )}

                            <button
                              onClick={() => removeActivity(activity.localId)}
                              className="rounded-xl border border-red-200 bg-red-50 p-2 text-red-600 transition-colors hover:bg-red-100"
                              aria-label="Delete activity"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">{renderActivityEditor(activity)}</div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
