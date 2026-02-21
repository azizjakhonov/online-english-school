import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Save, Image as ImageIcon, Video,
  Puzzle, Trash2, ArrowLeft,
  ListChecks, Type, Layout, Brain, UploadCloud,
  FileText as PdfFileIcon, Loader2,
} from 'lucide-react';
import api from '../../lib/api';

// --- TYPES ---
type BuilderMode = 'lesson' | 'homework';
type ActivityType = 'image' | 'video' | 'matching' | 'gap_fill' | 'quiz' | 'pdf';

interface MatchingPair { id: number; left: string; right: string; }

interface ActivityContent {
  url?: string;
  pairs?: MatchingPair[];
  text?: string;

  // Quiz Fields
  question?: string;
  options?: string[];
  correct_index?: number;

  // Image upload (base64 data URL)
  imageData?: string;

  // PDF activity fields
  pdf_id?: number;
  pdf_title?: string;
}

interface ActivityDraft {
  id: string;
  type: ActivityType;
  title: string;
  content: ActivityContent;
  points?: number;
}

interface Unit { id: number; title: string; }

export default function LessonBuilder() {
  const navigate = useNavigate();
  
  const [mode, setMode] = useState<BuilderMode>('lesson');

  // Lesson State
  const [lessonTitle, setLessonTitle] = useState("");
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState(""); 
  
  // Homework State
  const [hwLevel, setHwLevel] = useState("A1");
  const [hwDescription, setHwDescription] = useState("");

  const [activities, setActivities] = useState<ActivityDraft[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  // Tracks which pdf-activity draft IDs are currently uploading
  const [uploadingPdf, setUploadingPdf] = useState<Set<string>>(new Set());

  useEffect(() => {
      api.get('/api/curriculum/units/')
          .then(res => setUnits(res.data))
          .catch(err => console.error("Failed to fetch units:", err));
  }, []);

  // ── Image: device file → base64 ──────────────────────────────────────────
  const handleFileUpload = (id: string, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      updateContent(id, { imageData: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  // ── PDF: upload to /api/curriculum/pdfs/ then store pdf_id ───────────────
  const handlePdfUpload = async (draftId: string, file: File) => {
    setUploadingPdf(prev => new Set(prev).add(draftId));
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name.replace(/\.pdf$/i, ''));
      const res = await api.post('/api/curriculum/pdfs/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { id: pdf_id, title: pdf_title } = res.data as { id: number; title: string };
      updateContent(draftId, { pdf_id, pdf_title });
    } catch (err) {
      console.error('PDF upload failed', err);
      alert('PDF upload failed. Please try again.');
    } finally {
      setUploadingPdf(prev => { const s = new Set(prev); s.delete(draftId); return s; });
    }
  };

  // --- ACTIONS ---
  const addActivity = (type: ActivityType) => {
    let defaultContent: ActivityContent = {};
    let defaultTitle = "New Activity";

    switch (type) {
        case 'image': defaultTitle = "Image Slide"; defaultContent = { imageData: "" }; break; // Initialize with empty image
        case 'video': defaultTitle = "Video"; defaultContent = { url: "" }; break;
        case 'matching': defaultTitle = "Matching Game"; defaultContent = { pairs: [{ id: Date.now(), left: "", right: "" }] }; break;
        
        case 'quiz': 
            defaultTitle = "Pop Quiz"; 
            defaultContent = { 
                question: "", 
                options: ["", "", "", ""], 
                correct_index: 0 
            }; 
            break;
            
        case 'gap_fill': defaultTitle = "Fill in the Blank"; defaultContent = { text: "The {sky} is blue." }; break;
        case 'pdf':      defaultTitle = "PDF Document";      defaultContent = {};                              break;
    }

    const newActivity: ActivityDraft = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      title: defaultTitle,
      content: defaultContent,
      points: 10
    };
    setActivities([...activities, newActivity]);
  };

  const updateContent = (id: string, newContent: Partial<ActivityContent>) => {
    setActivities(activities.map(a => a.id === id ? { ...a, content: { ...a.content, ...newContent } } : a));
  };

  const updatePoints = (id: string, pts: number) => {
    setActivities(activities.map(a => a.id === id ? { ...a, points: pts } : a));
  };

  // --- SAVE LOGIC ---
  const handleSave = async () => {
    if (!lessonTitle) return alert("Please enter a title");
    if (activities.length === 0) return alert("Please add activities");

    setIsSaving(true);
    try {
      if (mode === 'lesson') {
        // ✅ FIX: Ensure unitId is sent as an Integer (Parsing avoids the 400 Error)
        const res = await api.post('/api/curriculum/lessons/', { 
            title: lessonTitle, 
            unit: parseInt(unitId), 
            order: 1, 
            description: "Lesson" 
        });
        
        for (const act of activities) {
          await api.post('/api/curriculum/activities/', { 
              lesson: res.data.id, 
              title: act.title, 
              activity_type: act.type, 
              order: 1, 
              content: act.content 
          });
        }
      } else {
        // Homework Logic
        const res = await api.post('/api/homework/admin/create/', { 
            title: lessonTitle, 
            level: hwLevel, 
            description: hwDescription 
        });
        
        for (const act of activities) {
          await api.post(`/api/homework/admin/activity/${res.data.id}/add/`, {
            activity_type: act.type,
            points: act.points,
            content: act.content
          });
        }
      }

      alert(`${mode === 'lesson' ? 'Lesson' : 'Homework'} Saved Successfully!`);
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      alert("Failed to save.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 font-sans text-slate-900">
      <div className="max-w-5xl mx-auto">
        
        {/* MODE TOGGLE */}
        <div className="flex justify-center mb-8">
            <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-sm flex gap-1">
                <button 
                    onClick={() => { setMode('lesson'); setActivities([]); }}
                    className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold transition-all ${mode === 'lesson' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
                >
                    <Layout size={18}/> Lesson Builder
                </button>
                <button 
                    onClick={() => { setMode('homework'); setActivities([]); }}
                    className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold transition-all ${mode === 'homework' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
                >
                    <Brain size={18}/> Homework Creator
                </button>
            </div>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"><ArrowLeft size={24} /></button>
            <h1 className="text-3xl font-black text-slate-800">{mode === 'lesson' ? 'Lesson Builder' : 'Homework Creator'}</h1>
          </div>
          <button onClick={handleSave} disabled={isSaving} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 ${mode === 'homework' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' : 'bg-slate-900 hover:bg-black shadow-slate-200'}`}>
            <Save size={20} /> {isSaving ? "Saving..." : `Save ${mode === 'lesson' ? 'Lesson' : 'Homework'}`}
          </button>
        </div>

        {/* Dynamic Metadata Form */}
        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        {mode === 'lesson' ? 'Lesson Title' : 'Homework Title (e.g. Unit 1 Review)'}
                    </label>
                    <input 
                        value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)}
                        placeholder="Type title here..."
                        className="w-full text-2xl font-black text-slate-800 border-b-2 border-slate-100 focus:border-blue-500 outline-none py-2 transition-colors"
                    />
                </div>

                {mode === 'lesson' ? (
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Assign to Unit</label>
                        <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className="w-full p-3 bg-slate-50 border-slate-200 rounded-xl font-bold text-slate-700 outline-none">
                            <option value="">Select a Unit...</option>
                            {units.map(u => <option key={u.id} value={u.id}>{u.title}</option>)}
                        </select>
                    </div>
                ) : (
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Difficulty Level</label>
                        <select value={hwLevel} onChange={(e) => setHwLevel(e.target.value)} className="w-full p-3 bg-blue-50 border-blue-100 rounded-xl font-black text-blue-700 outline-none">
                            {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                        </select>
                    </div>
                )}
            </div>
            
            {mode === 'homework' && (
                <div className="mt-6">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Instructions / Description</label>
                    <textarea 
                        value={hwDescription} onChange={(e) => setHwDescription(e.target.value)}
                        placeholder="Describe the goals of this homework..."
                        className="w-full p-4 bg-slate-50 rounded-2xl border-slate-200 outline-none focus:ring-2 focus:ring-blue-100 font-medium"
                        rows={2}
                    />
                </div>
            )}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 w-full space-y-6">
            {activities.map((activity, index) => (
              <div key={activity.id} className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200 relative group transition-all hover:border-blue-200">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-black text-xs">{index + 1}</span>
                        <span className="font-black text-slate-400 uppercase text-[10px] tracking-widest">{activity.type.replace('_', ' ')}</span>
                    </div>
                    {mode === 'homework' && (
                        <div className="flex items-center gap-2">
                             <span className="text-[10px] font-bold text-slate-400 uppercase">Worth</span>
                             <input 
                                type="number" value={activity.points} 
                                onChange={(e) => updatePoints(activity.id, parseInt(e.target.value))}
                                className="w-16 p-1 bg-slate-50 border border-slate-200 rounded font-bold text-center text-blue-600"
                             />
                             <span className="text-[10px] font-bold text-slate-400 uppercase">pts</span>
                        </div>
                    )}
                </div>

                {/* --- ✅ NEW: DEVICE IMAGE UPLOADER --- */}
                {activity.type === 'image' && (
                    <div className="space-y-4">
                        {!activity.content.imageData ? (
                            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-300 rounded-3xl bg-slate-50 hover:bg-slate-100 cursor-pointer transition-all">
                                <UploadCloud size={40} className="text-slate-400 mb-2" />
                                <span className="text-sm font-bold text-slate-500">Click to upload image from device</span>
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={(e) => e.target.files && handleFileUpload(activity.id, e.target.files[0])} 
                                />
                            </label>
                        ) : (
                            <div className="relative rounded-2xl overflow-hidden group border border-slate-200">
                                <img src={activity.content.imageData} alt="Preview" className="w-full max-h-80 object-contain bg-slate-100" />
                                <button 
                                    onClick={() => updateContent(activity.id, { imageData: "" })} 
                                    className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        )}
                        <input 
                            value={activity.content.url || ""} 
                            onChange={(e) => updateContent(activity.id, { url: e.target.value })} 
                            placeholder="Or paste an image URL (optional)..." 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none text-xs"
                        />
                    </div>
                )}

                {/* --- VIDEO EDITOR (Preserved) --- */}
                {activity.type === 'video' && (
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">YouTube URL</label>
                        <input value={activity.content.url} onChange={(e) => updateContent(activity.id, { url: e.target.value })} placeholder="https://youtube.com/watch?v=..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none" />
                    </div>
                )}

                {/* --- MATCHING EDITOR (Preserved) --- */}
                {activity.type === 'matching' && (
                    <div className="space-y-3">
                        {activity.content.pairs?.map((pair, idx) => (
                            <div key={pair.id} className="flex gap-3">
                                <input placeholder="Left" value={pair.left} onChange={(e) => {
                                    const newPairs = [...(activity.content.pairs || [])];
                                    newPairs[idx].left = e.target.value;
                                    updateContent(activity.id, { pairs: newPairs });
                                }} className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-bold" />
                                <input placeholder="Right" value={pair.right} onChange={(e) => {
                                    const newPairs = [...(activity.content.pairs || [])];
                                    newPairs[idx].right = e.target.value;
                                    updateContent(activity.id, { pairs: newPairs });
                                }} className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-bold" />
                            </div>
                        ))}
                        <button onClick={() => updateContent(activity.id, { pairs: [...(activity.content.pairs || []), { id: Date.now(), left: "", right: "" }] })} className="text-xs font-black text-blue-600">+ Add Pair</button>
                    </div>
                )}

                {/* --- GAP FILL EDITOR (Preserved) --- */}
                {activity.type === 'gap_fill' && (
                    <div className="space-y-2">
                        <textarea value={activity.content.text} onChange={(e) => updateContent(activity.id, { text: e.target.value })} placeholder="Use {word} for gaps..." className="w-full p-4 bg-slate-50 rounded-2xl font-medium border-slate-200" rows={3}/>
                    </div>
                )}

                {/* --- QUIZ EDITOR (Preserved) --- */}
                {activity.type === 'quiz' && (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <input 
                            value={activity.content.question || ""} 
                            onChange={(e) => updateContent(activity.id, { question: e.target.value })}
                            className="w-full p-3 bg-white rounded-xl mb-4 font-bold border-slate-200 focus:border-blue-500 outline-none" 
                            placeholder="Question?" 
                        />
                        <div className="grid grid-cols-2 gap-3">
                            {activity.content.options?.map((opt, oIdx) => (
                                <div key={oIdx} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                    <input 
                                        type="radio" 
                                        name={`correct-${activity.id}`}
                                        checked={activity.content.correct_index === oIdx} 
                                        onChange={() => updateContent(activity.id, { correct_index: oIdx })}
                                        className="w-5 h-5 accent-blue-600"
                                    />
                                    <input 
                                        value={opt} 
                                        onChange={(e) => {
                                            const newOpts = [...(activity.content.options || [])];
                                            newOpts[oIdx] = e.target.value;
                                            updateContent(activity.id, { options: newOpts });
                                        }} 
                                        className="flex-1 outline-none text-sm font-medium bg-transparent" 
                                        placeholder={`Option ${oIdx + 1}`}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* ── PDF UPLOADER ── */}
                {activity.type === 'pdf' && (
                  <div className="space-y-3">
                    {uploadingPdf.has(activity.id) ? (
                      <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl text-blue-600 text-sm font-semibold">
                        <Loader2 size={18} className="animate-spin" />
                        Uploading PDF…
                      </div>
                    ) : activity.content.pdf_id ? (
                      /* PDF already uploaded — show confirmation chip */
                      <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-2xl">
                        <PdfFileIcon size={22} className="text-green-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-green-800 text-sm truncate">
                            {activity.content.pdf_title || `PDF #${activity.content.pdf_id}`}
                          </p>
                          <p className="text-[11px] text-green-600 mt-0.5">
                            Uploaded · ID {activity.content.pdf_id}
                          </p>
                        </div>
                        <button
                          onClick={() => updateContent(activity.id, { pdf_id: undefined, pdf_title: undefined })}
                          className="shrink-0 text-green-400 hover:text-red-500 transition-colors"
                          title="Remove PDF"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : (
                      /* Drop-zone for new PDF */
                      <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-300 rounded-3xl bg-slate-50 hover:bg-slate-100 cursor-pointer transition-all">
                        <PdfFileIcon size={36} className="text-slate-400 mb-2" />
                        <span className="text-sm font-bold text-slate-500">Click to upload PDF</span>
                        <span className="text-xs text-slate-400 mt-1">Teachers control pages; students follow</span>
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={e => e.target.files && handlePdfUpload(activity.id, e.target.files[0])}
                        />
                      </label>
                    )}
                  </div>
                )}

                <button onClick={() => setActivities(activities.filter(a => a.id !== activity.id))} className="absolute top-8 right-8 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={20}/></button>
              </div>
            ))}
          </div>

          <div className="w-full lg:w-72 shrink-0 lg:sticky lg:top-8">
            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200">
              <h3 className="font-black text-slate-800 mb-6 text-lg">Add Activity</h3>
              <div className="space-y-3">
                {mode === 'lesson' && (
                    <>
                        <ToolboxButton icon={<ImageIcon size={18}/>} label="Image Slide" color="bg-blue-100 text-blue-600" onClick={() => addActivity('image')} />
                                <ToolboxButton icon={<Video size={18}/>} label="Video Embed" color="bg-red-100 text-red-600" onClick={() => addActivity('video')} />
                        <ToolboxButton icon={<PdfFileIcon size={18}/>} label="PDF Document" color="bg-rose-100 text-rose-600" onClick={() => addActivity('pdf')} />
                    </>
                )}
                <ToolboxButton icon={<Puzzle size={18}/>} label="Matching Game" color="bg-green-100 text-green-600" onClick={() => addActivity('matching')} />
                <ToolboxButton icon={<Type size={18}/>} label="Gap Fill" color="bg-purple-100 text-purple-600" onClick={() => addActivity('gap_fill')} />
                <ToolboxButton icon={<ListChecks size={18}/>} label="Pop Quiz" color="bg-orange-100 text-orange-600" onClick={() => addActivity('quiz')} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolboxButton({ icon, label, color, onClick }: { icon: React.ReactNode, label: string, color: string, onClick: () => void }) {
    return (
        <button onClick={onClick} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors text-left font-bold text-sm border border-transparent hover:border-slate-200 group">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all group-hover:scale-110 ${color}`}>{icon}</div>
            {label}
        </button>
    )
}