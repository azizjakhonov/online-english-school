import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Loader2, AlertCircle, X, GripVertical, Image as ImageIcon, PlayCircle } from 'lucide-react';
import api from '../../lib/api';

// --- TYPES ---
interface Activity {
    id: number;
    activity_type: 'quiz' | 'gap_fill' | 'matching' | 'image' | 'video'; // ✅ Added image/video support
    points: number;
    content: {
        question?: string;
        options?: string[];
        text?: string;
        pairs?: { id: number; left: string; right: string }[];
        url?: string;       // For URL links
        imageData?: string; // ✅ For Device Uploads
    };
}

interface AssignmentData {
    id: number;
    title: string;
    description: string;
    activities: Activity[];
}

interface QuizProps {
    content: { question?: string; options?: string[] };
    onChange: (idx: number) => void;
}

interface GapFillProps {
    content: { text?: string };
    onChange: (gaps: Record<number, string>) => void;
}

interface MatchingProps {
    content: { pairs?: { id: number; left: string; right: string }[] };
    onChange: (pairs: Record<string, string>) => void;
}

// ✅ New Props for Media
interface MediaProps {
    content: { url?: string; imageData?: string };
}

export default function HomeworkPlayer() {
    const { assignmentId } = useParams<{ assignmentId: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<AssignmentData | null>(null);
    const [answers, setAnswers] = useState<Record<number, unknown>>({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        api.get(`/api/homework/assignment/${assignmentId}/`)
            .then(res => {
                if (res.data.is_completed) {
                    alert("You have already completed this homework!");
                    navigate('/student/homework');
                    return;
                }
                setData(res.data);
            })
            .catch(() => alert("Could not load homework data."))
            .finally(() => setLoading(false));
    }, [assignmentId, navigate]);

    const handleAnswerChange = (activityId: number, answer: unknown) => {
        setAnswers(prev => ({ ...prev, [activityId]: answer }));
    };

    const submitHomework = async () => {
        setSubmitting(true);
        try {
            const payload = {
                answers: Object.keys(answers).map(id => ({
                    activity_id: parseInt(id),
                    answer_data: answers[parseInt(id)]
                }))
            };

            const res = await api.post(`/api/homework/assignment/${assignmentId}/submit/`, payload);
            alert(`Homework submitted! \nScore: ${res.data.score} \nGrade: ${res.data.percentage.toFixed(0)}%`);
            navigate('/student/homework');
        } catch (err: unknown) {
            console.error(err);
            alert("Failed to submit homework.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;
    if (!data) return <div className="p-10 text-center"><AlertCircle className="mx-auto mb-2" /> Homework not found.</div>;

    return (
        <div className="min-h-screen bg-slate-50 p-8 font-sans">
            <div className="max-w-3xl mx-auto">
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-6 transition-colors font-bold">
                    <ArrowLeft size={20} /> Back to List
                </button>

                <h1 className="text-3xl font-black text-slate-900 mb-2">{data.title}</h1>
                <p className="text-slate-500 mb-8">{data.description}</p>

                <div className="space-y-6">
                    {data.activities.map((act, index) => (
                        <div key={act.id} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                            <div className="flex justify-between mb-4">
                                <span className="text-xs font-bold uppercase text-slate-400">Activity {index + 1}</span>
                                {act.activity_type !== 'image' && act.activity_type !== 'video' && (
                                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">{act.points} pts</span>
                                )}
                            </div>

                            {/* --- ACTIVITY RENDERERS --- */}

                            {act.activity_type === 'quiz' && (
                                <QuizComponent
                                    content={act.content}
                                    onChange={(val) => handleAnswerChange(act.id, { selected_index: val })}
                                />
                            )}

                            {act.activity_type === 'gap_fill' && (
                                <GapFillComponent
                                    content={act.content}
                                    onChange={(val) => handleAnswerChange(act.id, { gaps: val })}
                                />
                            )}

                            {act.activity_type === 'matching' && (
                                <MatchingComponent
                                    content={act.content}
                                    onChange={(val) => handleAnswerChange(act.id, { pairs: val })}
                                />
                            )}

                            {/* ✅ ADDED: Image Slide Renderer (Handles Device Uploads) */}
                            {act.activity_type === 'image' && (
                                <ImageComponent content={act.content} />
                            )}

                            {/* ✅ ADDED: Video Renderer */}
                            {act.activity_type === 'video' && (
                                <VideoComponent content={act.content} />
                            )}
                        </div>
                    ))}
                </div>

                <button
                    onClick={submitHomework}
                    disabled={submitting}
                    className="w-full mt-10 bg-slate-900 text-white py-4 rounded-2xl font-bold text-lg hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {submitting ? "Submitting..." : "Finish & Submit"} <Send size={20} />
                </button>
            </div>
        </div>
    );
}

// --- SUB-COMPONENTS ---

// ✅ NEW: Image Viewer (Handles both URL and Base64 Device Data)
function ImageComponent({ content }: MediaProps) {
    // Looks for 'imageData' (device) OR 'url' (internet)
    const src = content.imageData || content.url;

    if (!src) return (
        <div className="flex flex-col items-center justify-center h-48 bg-slate-50 rounded-2xl text-slate-400">
            <ImageIcon size={48} className="mb-2 opacity-50" />
            <span className="text-sm font-bold">No Image Provided</span>
        </div>
    );

    return (
        <div className="flex justify-center">
            <img
                src={src}
                alt="Lesson Content"
                className="max-h-[500px] w-auto rounded-2xl border border-slate-100 shadow-sm object-contain"
            />
        </div>
    );
}

// ✅ NEW: Video Viewer
function VideoComponent({ content }: MediaProps) {
    if (!content.url) return (
        <div className="flex flex-col items-center justify-center h-48 bg-slate-50 rounded-2xl text-slate-400">
            <PlayCircle size={48} className="mb-2 opacity-50" />
            <span className="text-sm font-bold">No Video URL</span>
        </div>
    );

    // Simple YouTube Embed converter
    let embedUrl = content.url;
    if (content.url.includes("watch?v=")) {
        embedUrl = content.url.replace("watch?v=", "embed/");
    } else if (content.url.includes("youtu.be/")) {
        embedUrl = content.url.replace("youtu.be/", "youtube.com/embed/");
    }

    return (
        <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-sm border border-slate-200">
            <iframe
                src={embedUrl}
                className="w-full h-full"
                allowFullScreen
                title="Lesson Video"
            />
        </div>
    );
}

function QuizComponent({ content, onChange }: QuizProps) {
    return (
        <div>
            <h3 className="text-xl font-bold text-slate-800 mb-4">{content.question}</h3>
            <div className="grid gap-3">
                {content.options?.map((opt: string, i: number) => (
                    <label key={i} className="flex items-center gap-3 p-4 border border-slate-100 rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50/50">
                        <input type="radio" name={content.question || 'q'} onChange={() => onChange(i)} className="w-5 h-5 accent-blue-600" />
                        <span className="font-medium text-slate-700">{opt}</span>
                    </label>
                ))}
            </div>
        </div>
    );
}

function GapFillComponent({ content, onChange }: GapFillProps) {
    const text = content.text || "";
    const parts = text.split(/({[^}]+})/g);
    const [userGaps, setUserGaps] = useState<Record<number, string>>({});

    const updateGap = (index: number, val: string) => {
        const next = { ...userGaps, [index]: val };
        setUserGaps(next);
        onChange(next);
    };

    let gapIdx = 0;
    return (
        <div className="text-lg leading-relaxed text-slate-700">
            {parts.map((part: string, i: number) => {
                if (part.startsWith('{') && part.endsWith('}')) {
                    const currentIdx = gapIdx++;
                    return (
                        <input
                            key={i}
                            type="text"
                            placeholder="..."
                            className="mx-1 border-b-2 border-slate-300 bg-slate-50 px-2 py-0.5 outline-none focus:border-blue-500 text-center w-24 rounded-md font-bold text-blue-700 transition-all"
                            onChange={(e) => updateGap(currentIdx, e.target.value)}
                        />
                    );
                }
                return <span key={i}>{part}</span>;
            })}
        </div>
    );
}

// ✅ PRESERVED: Matching Game with Drag & Drop
function MatchingComponent({ content, onChange }: MatchingProps) {
    const pairs = content.pairs || [];
    const [userSelections, setUserSelections] = useState<Record<string, string>>({});
    const [bank, setBank] = useState<string[]>([]);

    useEffect(() => {
        if (pairs.length > 0 && bank.length === 0) {
            const options = pairs.map(p => p.right);
            const shuffled = [...options].sort(() => Math.random() - 0.5);
            // Fix synchronous state update
            setTimeout(() => {
                setBank(shuffled);
            }, 0);
        }
    }, [pairs, bank.length]);

    const handleDragStart = (e: React.DragEvent, answer: string) => {
        e.dataTransfer.setData("text/plain", answer);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e: React.DragEvent, leftItem: string) => {
        e.preventDefault();
        const droppedAnswer = e.dataTransfer.getData("text/plain");
        const previousAnswer = userSelections[leftItem];

        const nextSelections = { ...userSelections, [leftItem]: droppedAnswer };
        setUserSelections(nextSelections);
        onChange(nextSelections);

        setBank(prev => {
            const newBank = prev.filter(item => item !== droppedAnswer);
            if (previousAnswer) {
                newBank.push(previousAnswer);
            }
            return newBank;
        });
    };

    const handleRemove = (leftItem: string) => {
        const answerToRemove = userSelections[leftItem];
        if (!answerToRemove) return;

        const nextSelections = { ...userSelections };
        delete nextSelections[leftItem];
        setUserSelections(nextSelections);
        onChange(nextSelections);

        setBank(prev => [...prev, answerToRemove]);
    };

    const isUsed = (answer: string) => Object.values(userSelections).includes(answer);

    return (
        <div className="space-y-6 select-none">
            <div className="grid gap-3">
                {pairs.map((pair) => {
                    const filledAnswer = userSelections[pair.left];

                    return (
                        <div key={pair.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100 group hover:border-blue-200 transition-colors">
                            <div className="font-bold text-slate-700 px-4 py-2">{pair.left}</div>
                            <div
                                className="flex-1 max-w-[50%]"
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, pair.left)}
                            >
                                {filledAnswer ? (
                                    <div className="w-full flex items-center justify-between bg-white border-2 border-blue-500 text-blue-700 px-4 py-3 rounded-lg shadow-sm font-bold animate-in fade-in zoom-in duration-200 cursor-default">
                                        <span className="truncate">{filledAnswer}</span>
                                        <button
                                            onClick={() => handleRemove(pair.left)}
                                            className="p-1 hover:bg-blue-50 rounded-full transition-colors"
                                        >
                                            <X size={16} className="text-blue-300 hover:text-blue-500" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-full h-12 border-2 border-dashed border-slate-300 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-bold uppercase tracking-wider transition-all group-hover:bg-white group-hover:border-blue-300">
                                        Drop Here
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="bg-slate-100 p-6 rounded-2xl border border-slate-200">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <GripVertical size={14} /> Available Answers (Drag to matching slot)
                </p>
                <div className="flex flex-wrap gap-3">
                    {bank.map((answer, i) => {
                        const used = isUsed(answer);
                        if (used) return null;

                        return (
                            <div
                                key={i}
                                draggable={!used}
                                onDragStart={(e) => handleDragStart(e, answer)}
                                className={`px-5 py-3 rounded-xl font-bold text-sm transition-all shadow-sm cursor-grab active:cursor-grabbing border-b-4
                                    bg-white text-slate-700 border-slate-200 hover:border-blue-500 hover:text-blue-600 hover:-translate-y-1`}
                            >
                                {answer}
                            </div>
                        );
                    })}
                    {bank.length === 0 && (
                        <div className="text-slate-400 text-sm italic w-full text-center py-2">All items placed!</div>
                    )}
                </div>
            </div>
        </div>
    );
}