import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    X, Check, AlertCircle, Loader2, Volume2, ChevronRight
} from 'lucide-react';
import api, { resolveApiUrl } from '../../lib/api';

// --- TYPES ---
interface Activity {
    id: number;
    activity_type: 'quiz' | 'gap_fill' | 'matching' | 'image' | 'video' | 'listening';
    points: number;
    content: any;
}

interface AssignmentData {
    id: number;
    title: string;
    description: string;
    activities: Activity[];
    is_completed: boolean;
}

import { usePageTitle } from '../../lib/usePageTitle';

export default function HomeworkPlayer() {
    usePageTitle('Homework');
    const { assignmentId } = useParams<{ assignmentId: string }>();
    const navigate = useNavigate();

    const [data, setData] = useState<AssignmentData | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<number, any>>({});
    const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
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

    const currentActivity = data?.activities[currentIndex];
    const progress = data ? ((currentIndex + (feedback ? 1 : 0)) / data.activities.length) * 100 : 0;

    const handleAnswer = (answer: any) => {
        if (feedback) return;

        // Logical check for immediate feedback
        let isCorrect = false;
        if (currentActivity?.activity_type === 'quiz') {
            isCorrect = String(answer.selected_index) === String(currentActivity.content.correct_index);
        } else if (currentActivity?.activity_type === 'gap_fill') {
            const correctGaps = (currentActivity.content.text.match(/{([^}]+)}/g) || []).map((s: string) => s.slice(1, -1));
            const studentGaps = answer.gaps || [];
            isCorrect = correctGaps.length > 0 &&
                correctGaps.every((cg: string, i: number) =>
                    String(cg).toLowerCase() === String(studentGaps[i] || '').toLowerCase()
                );
        } else if (currentActivity?.activity_type === 'matching') {
            const correctPairs = currentActivity.content.pairs || [];
            const correctDict = Object.fromEntries(correctPairs.map((p: any) => [String(p.left), String(p.right)]));
            const studentDict = Object.fromEntries(Object.entries(answer.pairs || {}).map(([k, v]) => [String(k), String(v)]));
            isCorrect = JSON.stringify(correctDict) === JSON.stringify(studentDict);
        } else if (currentActivity?.activity_type === 'listening') {
            const subType = currentActivity.content.type || currentActivity.content.sub_type || 'quiz';
            if (subType === 'quiz') {
                isCorrect = String(answer.selected_index) === String(currentActivity.content.correct_index);
            } else if (subType === 'true_false') {
                isCorrect = answer.selected_bool === currentActivity.content.correct_bool;
            } else if (subType === 'open') {
                const keywords = currentActivity.content.keywords || [];
                const studentText = (answer.text || '').toLowerCase();
                isCorrect = keywords.length > 0
                    ? keywords.some((kw: string) => studentText.includes(kw.toLowerCase()))
                    : studentText.length > 0;
            }
        } else {
            // Media (image/video) are always "correct" to proceed
            isCorrect = true;
        }

        setAnswers(prev => ({ ...prev, [currentActivity!.id]: answer }));
        setFeedback(isCorrect ? 'correct' : 'wrong');

        // Auto scroll for long pages if needed
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleContinue = () => {
        setFeedback(null);
        if (currentIndex < (data?.activities.length || 0) - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            submitHomework();
        }
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
            alert(`Great Job! \nScore: ${res.data.percentage.toFixed(0)}%`);
            navigate('/student/homework');
        } catch (error) {
            console.error(error);
            alert("Failed to submit homework.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-blue-600 w-10 h-10" /></div>;
    if (!data) return <div className="p-10 text-center">Homework not found.</div>;

    return (
        <div className="min-h-screen bg-white font-sans flex flex-col">
            {/* Header / Progress bar */}
            <div className="sticky top-0 z-50 bg-white px-6 py-6 border-b border-slate-100 flex items-center gap-6">
                <button
                    onClick={() => navigate('/student/homework')}
                    className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X size={28} />
                </button>
                <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <span className="text-blue-500 font-black text-sm w-10 text-right">{Math.round(progress)}%</span>
            </div>

            {/* Content Area */}
            <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12 pb-48">
                {currentActivity && (
                    <ActivityRenderer
                        activity={currentActivity}
                        onAnswer={handleAnswer}
                        disabled={!!feedback}
                    />
                )}
            </main>

            {/* Feedback Banner */}
            <div className={`fixed bottom-0 left-0 right-0 p-8 border-t-2 z-40 transition-transform duration-300 ease-in-out bg-white
                ${feedback ? 'translate-y-0' : 'translate-y-full'}
                ${feedback === 'correct' ? 'border-green-100' : 'border-rose-100 bg-rose-50'}
            `}>
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-sm
                            ${feedback === 'correct' ? 'bg-green-100 text-green-600' : 'bg-rose-200 text-rose-600'}
                        `}>
                            {feedback === 'correct' ? <Check size={32} strokeWidth={3} /> : <AlertCircle size={32} strokeWidth={3} />}
                        </div>
                        <div className="text-center md:text-left">
                            <h2 className={`text-2xl font-black mb-1 ${feedback === 'correct' ? 'text-green-600' : 'text-rose-600'}`}>
                                {feedback === 'correct' ? 'Correct!' : 'Incorrect'}
                            </h2>
                            <p className="text-slate-500 font-bold">
                                {feedback === 'correct' ? 'You got it right! Keep it up.' : 'Don\'t worry, stay focused!'}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleContinue}
                        disabled={submitting}
                        className={`w-full md:w-auto px-12 py-4 rounded-2xl font-black text-lg text-white shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2
                            ${feedback === 'correct' ? 'bg-green-500 hover:bg-green-600 shadow-green-200' : 'bg-rose-500 hover:bg-rose-600 shadow-rose-200'}
                        `}
                    >
                        {currentIndex === data.activities.length - 1 ? 'FINISH' : 'CONTINUE'}
                        <ChevronRight size={20} strokeWidth={3} />
                    </button>
                </div>
            </div>
        </div>
    );
}

const ActivityRenderer = ({ activity, onAnswer, disabled }: any) => {
    switch (activity.activity_type) {
        case 'quiz': return <QuizView activity={activity} onAnswer={onAnswer} disabled={disabled} />;
        case 'gap_fill': return <GapFillView activity={activity} onAnswer={onAnswer} disabled={disabled} />;
        case 'matching': return <MatchingView activity={activity} onAnswer={onAnswer} disabled={disabled} />;
        case 'image': return <ImageView activity={activity} onAnswer={onAnswer} disabled={disabled} />;
        case 'video': return <VideoView activity={activity} onAnswer={onAnswer} disabled={disabled} />;
        case 'listening': return <ListeningView activity={activity} onAnswer={onAnswer} disabled={disabled} />;
        default: return <div className="text-red-500 font-black">Unknown activity: {activity.activity_type}</div>;
    }
};

const QuizView = ({ activity, onAnswer, disabled }: any) => {
    const { question, options } = activity.content;
    const [selected, setSelected] = useState<number | null>(null);

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-black tracking-widest uppercase inline-block mb-6">Quiz</div>
            <h1 className="text-3xl font-black text-slate-900 leading-tight mb-8">{question}</h1>

            <button className="w-14 h-14 rounded-full border-2 border-blue-500 flex items-center justify-center mb-12 text-blue-500 hover:bg-blue-50 transition-colors shadow-sm">
                <Volume2 size={24} />
            </button>

            <div className="grid gap-4">
                {options.map((opt: string, i: number) => {
                    const isActive = selected === i;
                    return (
                        <button
                            key={i}
                            disabled={disabled}
                            onClick={() => { setSelected(i); onAnswer({ selected_index: i }); }}
                            className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left
                                ${isActive
                                    ? 'border-blue-500 bg-blue-50/50 shadow-md ring-1 ring-blue-500'
                                    : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                                }
                                ${disabled && !isActive ? 'opacity-50' : ''}
                            `}
                        >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border-2
                                ${isActive ? 'bg-blue-500 text-white border-blue-500' : 'bg-slate-100 text-slate-400 border-slate-200'}
                            `}>
                                {String.fromCharCode(65 + i)}
                            </div>
                            <span className={`text-lg font-bold ${isActive ? 'text-blue-900' : 'text-slate-700'}`}>{opt}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const GapFillView = ({ activity, onAnswer, disabled }: any) => {
    const text = activity.content.text || "";
    const parts = text.split(/({[^}]+})/g);
    const [userGaps, setUserGaps] = useState<Record<number, string>>({});

    const updateGap = (idx: number, val: string) => {
        setUserGaps(prev => ({ ...prev, [idx]: val }));
    };

    let gapIdx = 0;
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-black tracking-widest uppercase inline-block mb-6">Fill the Gaps</div>
            <h1 className="text-3xl font-black text-slate-900 leading-tight mb-8">Type the missing words</h1>

            <div className="text-2xl leading-[2.5] font-bold text-slate-800 bg-slate-50 p-8 rounded-3xl border border-slate-100">
                {parts.map((p: string, i: number) => {
                    if (p.startsWith('{')) {
                        const currentIdx = gapIdx++;
                        return (
                            <input
                                key={i}
                                type="text"
                                onChange={(e) => updateGap(currentIdx, e.target.value)}
                                disabled={disabled}
                                className="mx-2 w-32 border-b-4 border-slate-200 focus:border-blue-500 outline-none bg-transparent text-center font-black text-blue-600 transition-colors uppercase disabled:text-blue-900 disabled:border-transparent"
                                placeholder="..."
                            />
                        );
                    }
                    return <span key={i}>{p}</span>;
                })}
            </div>
            {!disabled && (
                <button
                    onClick={() => onAnswer({ gaps: Object.keys(userGaps).sort((a, b) => parseInt(a) - parseInt(b)).map(k => userGaps[parseInt(k)]) })}
                    className="mt-12 w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-xl shadow-lg hover:bg-blue-700 transition-all active:scale-95"
                >
                    CHECK ANSWER
                </button>
            )}
        </div>
    );
};

const MatchingView = ({ activity, onAnswer, disabled }: any) => {
    const pairs = activity.content.pairs || [];
    const [leftSelected, setLeftSelected] = useState<string | null>(null);
    const [userMatches, setUserMatches] = useState<Record<string, string>>({});
    const [shuffledRights, setShuffledRights] = useState<string[]>([]);

    useEffect(() => {
        const rights = pairs.map((p: any) => p.right);
        setShuffledRights([...rights].sort(() => Math.random() - 0.5));
    }, [activity]);

    const handleMatch = (right: string) => {
        if (!leftSelected || disabled) return;
        setUserMatches(prev => ({ ...prev, [leftSelected]: right }));
        setLeftSelected(null);
    };

    const isMatchedRight = (right: string) => Object.values(userMatches).includes(right);
    const totalPairs = pairs.length;
    const currentMatches = Object.keys(userMatches).length;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-xs font-black tracking-widest uppercase inline-block mb-6">Matching Pairs</div>
            <h1 className="text-3xl font-black text-slate-900 leading-tight mb-8">Match all terms correctly</h1>

            <div className="grid grid-cols-2 gap-10">
                <div className="space-y-4">
                    {pairs.map((p: any, i: number) => {
                        const matched = !!userMatches[p.left];
                        const active = leftSelected === p.left;
                        return (
                            <button
                                key={i}
                                onClick={() => !disabled && !matched && setLeftSelected(p.left)}
                                disabled={disabled || matched}
                                className={`w-full p-6 h-20 rounded-2xl border-2 font-black text-xl transition-all flex items-center justify-center
                                    ${active ? 'border-blue-500 bg-blue-50 text-blue-700 ring-4 ring-blue-100' : ''}
                                    ${matched ? 'opacity-20 border-slate-100 bg-slate-50 grayscale scale-95' : 'border-slate-100 hover:border-slate-300 hover:shadow-md active:scale-95 bg-white'}
                                `}
                            >
                                {p.left}
                            </button>
                        );
                    })}
                </div>
                <div className="space-y-4">
                    {shuffledRights.map((r: string, i: number) => {
                        const matched = isMatchedRight(r);
                        return (
                            <button
                                key={i}
                                onClick={() => handleMatch(r)}
                                disabled={disabled || !leftSelected || matched}
                                className={`w-full p-6 h-20 rounded-2xl border-2 font-black text-xl transition-all flex items-center justify-center
                                    ${matched ? 'opacity-20 border-slate-100 bg-slate-50 grayscale scale-95' : ''}
                                    ${leftSelected && !matched ? 'border-amber-400 bg-amber-50 text-amber-900 animate-pulse hover:border-amber-500 shadow-lg' : 'border-slate-100 bg-white hover:border-slate-300'}
                                    ${disabled && !matched ? 'opacity-50' : ''}
                                `}
                            >
                                {r}
                            </button>
                        );
                    })}
                </div>
            </div>

            {!disabled && currentMatches === totalPairs && (
                <button
                    onClick={() => onAnswer({ pairs: userMatches })}
                    className="mt-12 w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-xl shadow-lg hover:bg-blue-700 transition-all active:scale-95"
                >
                    CHECK MATCHES
                </button>
            )}
        </div>
    );
};

const ImageView = ({ activity, onAnswer, disabled }: any) => {
    const src = activity.content.imageData || activity.content.url;
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
            <div className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-black tracking-widest uppercase inline-block mb-6 text-left">Reference Image</div>
            <img src={src} className="w-full max-h-[60vh] object-contain rounded-3xl border border-slate-100 shadow-xl mb-10" />
            {!disabled && (
                <button
                    onClick={() => onAnswer({})}
                    className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xl shadow-lg hover:bg-black transition-all"
                >
                    GOT IT
                </button>
            )}
        </div>
    );
};

const ListeningView = ({ activity, onAnswer, disabled }: any) => {
    const subType = activity.content.type || activity.content.sub_type || 'quiz';
    const { question, options, audio_download_url } = activity.content;
    const token = localStorage.getItem('access_token');
    const authenticatedAudioUrl = audio_download_url
        ? `${resolveApiUrl(audio_download_url)}${audio_download_url.includes('?') ? '&' : '?'}token=${token}`
        : '';

    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
    const [selectedBool, setSelectedBool] = useState<boolean | null>(null);
    const [openText, setOpenText] = useState("");
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);

    const audioRef = useRef<HTMLAudioElement>(null);

    const toggleAudio = () => {
        if (!audioRef.current) return;
        if (isPlaying) audioRef.current.pause();
        else audioRef.current.play();
        setIsPlaying(!isPlaying);
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const cyclePlaybackRate = () => {
        const rates = [1.0, 1.25, 1.5, 2.0, 0.5];
        const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length;
        const nextRate = rates[nextIndex];
        setPlaybackRate(nextRate);
        if (audioRef.current) {
            audioRef.current.playbackRate = nextRate;
        }
    };

    const formatTime = (time: number) => {
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const progress = duration ? (currentTime / duration) * 100 : 0;
    const barsCount = 40;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-amber-100 text-amber-700 px-4 py-2 rounded-xl text-xs font-black tracking-widest uppercase inline-block mb-6">Listening Task</div>
            <h1 className="text-3xl font-black text-slate-900 leading-tight mb-8">{question}</h1>

            {/* Premium Audio Player - Photo Style */}
            <div className="mb-12 flex items-center gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm max-w-2xl">
                <div className="relative">
                    {/* Pulsing ring when playing */}
                    {isPlaying && (
                        <div className="absolute inset-0 bg-yellow-400/20 rounded-full animate-ping scale-150" />
                    )}
                    <button
                        onClick={toggleAudio}
                        className="relative w-16 h-16 rounded-full bg-yellow-400 flex items-center justify-center transition-transform active:scale-95 z-10 hover:brightness-105 shadow-lg shadow-yellow-100"
                    >
                        {isPlaying ? (
                            <div className="flex gap-1.5">
                                <div className="w-1.5 h-6 bg-slate-900 rounded-full" />
                                <div className="w-1.5 h-6 bg-slate-900 rounded-full" />
                            </div>
                        ) : (
                            <div className="ml-1 w-0 h-0 border-y-[12px] border-y-transparent border-l-[18px] border-l-slate-900 rounded-sm" />
                        )}
                    </button>
                </div>

                <div className="flex-1 space-y-2">
                    {/* Custom Waveform */}
                    <div className="flex items-end gap-[3px] h-10 px-2 group cursor-pointer"
                        onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = e.clientX - rect.left;
                            const pct = x / rect.width;
                            if (audioRef.current) audioRef.current.currentTime = pct * duration;
                        }}
                    >
                        {Array.from({ length: barsCount }).map((_, i) => {
                            const barProgress = (i / barsCount) * 100;
                            const isActive = progress > barProgress;
                            // Deterministic random-looking heights
                            const height = 40 + Math.sin(i * 0.8) * 15 + Math.cos(i * 0.3) * 10;
                            return (
                                <div
                                    key={i}
                                    className={`flex-1 rounded-full transition-colors duration-300 ${isActive ? 'bg-yellow-400' : 'bg-slate-200'}`}
                                    style={{ height: `${height}%` }}
                                />
                            );
                        })}
                    </div>
                    <div className="flex justify-between items-center px-2">
                        <span className="text-[10px] font-black text-slate-400 tracking-tighter">{formatTime(currentTime)}</span>
                        <span className="text-[10px] font-black text-slate-300 tracking-tighter">{formatTime(duration)}</span>
                    </div>
                </div>

                <button
                    onClick={cyclePlaybackRate}
                    className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-colors border border-slate-100"
                >
                    <span className="text-xs font-black text-slate-600">{playbackRate}x</span>
                </button>

                <audio
                    ref={audioRef}
                    id={`audio-player-${activity.id}`}
                    src={authenticatedAudioUrl}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={() => setIsPlaying(false)}
                    className="hidden"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                />
            </div>

            {subType === 'quiz' && (
                <div className="grid gap-3">
                    {options.map((opt: string, i: number) => {
                        const active = selectedIdx === i;
                        return (
                            <button
                                key={i}
                                disabled={disabled}
                                onClick={() => { setSelectedIdx(i); onAnswer({ selected_index: i }); }}
                                className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left
                                    ${active ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-100 hover:border-slate-200 bg-white'}
                                `}
                            >
                                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold
                                    ${active ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-slate-400'}
                                `}>{String.fromCharCode(65 + i)}</div>
                                <span className={`text-lg font-bold ${active ? 'text-blue-900' : 'text-slate-700'}`}>{opt}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {subType === 'true_false' && (
                <div className="grid grid-cols-2 gap-4">
                    {[true, false].map((val) => {
                        const active = selectedBool === val;
                        return (
                            <button
                                key={String(val)}
                                disabled={disabled}
                                onClick={() => { setSelectedBool(val); onAnswer({ selected_bool: val }); }}
                                className={`p-8 rounded-3xl border-2 flex flex-col items-center gap-4 transition-all
                                    ${active
                                        ? val ? 'border-green-500 bg-green-50 ring-4 ring-green-100' : 'border-rose-500 bg-rose-50 ring-4 ring-rose-100'
                                        : 'border-slate-100 hover:border-slate-200 bg-white'
                                    }
                                `}
                            >
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center
                                    ${active
                                        ? val ? 'bg-green-500 text-white' : 'bg-rose-500 text-white'
                                        : 'bg-slate-100 text-slate-400'
                                    }
                                `}>
                                    {val ? <Check /> : <X />}
                                </div>
                                <span className="font-black text-xl uppercase italic tracking-tighter">
                                    {val ? 'TRUE' : 'FALSE'}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {subType === 'open' && (
                <div className="space-y-4">
                    <textarea
                        disabled={disabled}
                        value={openText}
                        onChange={(e) => setOpenText(e.target.value)}
                        placeholder="Type what you heard..."
                        className="w-full p-6 rounded-3xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none text-xl font-bold min-h-[150px] transition-all"
                    />
                    {!disabled && (
                        <button
                            onClick={() => onAnswer({ text: openText })}
                            className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all"
                        >
                            CHECK
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

const VideoView = ({ activity, onAnswer, disabled }: any) => {
    let embedUrl = activity.content.url || "";
    if (embedUrl.includes("watch?v=")) embedUrl = embedUrl.replace("watch?v=", "embed/");
    else if (embedUrl.includes("youtu.be/")) embedUrl = embedUrl.replace("youtu.be/", "youtube.com/embed/");

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
            <div className="bg-rose-50 text-rose-600 px-4 py-2 rounded-xl text-xs font-black tracking-widest uppercase inline-block mb-6 text-left">Watch & Learn</div>
            <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-2xl mb-10 border-4 border-white">
                <iframe src={embedUrl} className="w-full h-full" allowFullScreen />
            </div>
            {!disabled && (
                <button
                    onClick={() => onAnswer({})}
                    className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xl shadow-lg hover:bg-black transition-all"
                >
                    I WATCHED IT
                </button>
            )}
        </div>
    );
};