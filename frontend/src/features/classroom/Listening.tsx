import { useState, useEffect, useRef, memo, useMemo } from 'react';
import { Play, Headphones } from 'lucide-react';
import { API_BASE_URL } from '../../lib/api';

interface ListeningProps {
    content: {
        url?: string;
        audio_id?: number;
        audio_download_url?: string;
        audio_title?: string;
        title?: string;
    };
    isTeacher: boolean;
    gameState?: any;
    onAction: (action: string, data: any) => void;
}

const Listening = ({ content, isTeacher, gameState, onAction }: ListeningProps) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const isSyncingRef = useRef(false);

    const token = localStorage.getItem('access_token');

    const audioUrl = useMemo(() => {
        if (content.url) return content.url;
        if (content.audio_id && token) {
            return `${API_BASE_URL}/api/curriculum/audio/${content.audio_id}/download/?token=${token}`;
        }
        if (content.audio_download_url) {
            if (content.audio_download_url.startsWith('http')) return content.audio_download_url;
            return `${API_BASE_URL}${content.audio_download_url.startsWith('/') ? '' : '/'}${content.audio_download_url}`;
        }
        return '';
    }, [content, token]);

    // Sync Logic (Enhanced for Backend-Authoritative Protocol)
    useEffect(() => {
        if (!audioRef.current || isTeacher || isSyncingRef.current || !gameState) return;

        const { type, payload } = gameState;
        const state = payload?.state ||
            (type === 'AUDIO_PLAY' || (type === 'AUDIO_STATE_UPDATE' && payload?.state === 'playing') ? 'playing' :
                type === 'AUDIO_PAUSE' || (type === 'AUDIO_STATE_UPDATE' && payload?.state === 'paused') ? 'paused' : '');

        const t = payload?.t ?? (type === 'AUDIO_SYNC' ? payload?.t : 0);

        const currentT = audioRef.current.currentTime;
        const drift = Math.abs(currentT - t);

        // Don't interrupt if we are already syncing or if the drift is small
        if (isSyncingRef.current) return;

        // Immediate seek if drift > 2 seconds
        if (drift > 2) {
            isSyncingRef.current = true;
            audioRef.current.currentTime = t;
            setTimeout(() => {
                isSyncingRef.current = false;
            }, 800);
        }

        // Play/Pause sync
        if (state === 'playing' && audioRef.current.paused) {
            audioRef.current.play().catch(console.warn);
            setIsPlaying(true);
        } else if (state === 'paused' && !audioRef.current.paused) {
            audioRef.current.pause();
            setIsPlaying(false);
        }
    }, [gameState, isTeacher]);

    const handlePlayPause = async () => {
        if (!audioRef.current || !isTeacher) return;

        try {
            if (audioRef.current.paused) {
                await audioRef.current.play();
                setIsPlaying(true);
                onAction('AUDIO_PLAY', { t: audioRef.current.currentTime, d: audioRef.current.duration });
            } else {
                audioRef.current.pause();
                setIsPlaying(false);
                onAction('AUDIO_PAUSE', { t: audioRef.current.currentTime, d: audioRef.current.duration });
            }
        } catch (err) {
            console.error('[Audio] Playback failed:', err);
        }
    };

    const lastSyncSentRef = useRef(0);
    const handleTimeUpdate = () => {
        if (!audioRef.current) return;
        const t = audioRef.current.currentTime;
        setCurrentTime(t);

        if (isTeacher && isPlaying && !isSyncingRef.current) {
            const floorT = Math.floor(t);
            // Broadcast sync every 5 seconds, but only once per second-mark
            if (floorT > 0 && floorT % 5 === 0 && lastSyncSentRef.current !== floorT) {
                lastSyncSentRef.current = floorT;
                onAction('AUDIO_SYNC', { t, d: audioRef.current.duration });
            }
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const formatTime = (time: number) => {
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const progress = duration ? (currentTime / duration) : 0;

    return (
        <div className="h-full w-full flex items-center justify-center p-4">
            <div className="w-full max-w-xs bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden relative">
                <div className="p-5">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">
                            <Headphones size={18} />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-slate-800 text-xs truncate">Listening</h3>
                            <p className="text-slate-400 text-[10px] font-medium truncate italic">{content.audio_title || content.title || 'Audio Lesson'}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative">
                            {isPlaying && (
                                <div className="absolute inset-0 bg-amber-400 rounded-full animate-ping opacity-15 scale-110" />
                            )}
                            <button
                                onClick={handlePlayPause}
                                disabled={!isTeacher}
                                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-all active:scale-90 z-10 relative
                    ${isPlaying ? 'bg-amber-400' : 'bg-amber-400 hover:bg-amber-500'}
                    ${!isTeacher ? 'bg-slate-100 cursor-not-allowed' : ''}
                  `}
                            >
                                {isPlaying ? (
                                    <div className="flex gap-1 items-center justify-center">
                                        <div className="w-1.5 h-4 bg-slate-800 rounded-full" />
                                        <div className="w-1.5 h-4 bg-slate-800 rounded-full" />
                                    </div>
                                ) : (
                                    <Play size={20} className={!isTeacher ? 'text-slate-300 ml-0.5' : 'text-slate-800 ml-0.5'} fill={!isTeacher ? 'none' : 'currentColor'} />
                                )}
                            </button>
                        </div>

                        <div className="flex-1 flex flex-col gap-1.5">
                            <div className="relative w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="absolute top-0 left-0 h-full bg-amber-400 transition-all duration-300 rounded-full"
                                    style={{ width: `${progress * 100}%` }}
                                />
                            </div>
                            <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 tabular-nums">
                                <span>{formatTime(currentTime)}</span>
                                <span>{formatTime(duration)}</span>
                            </div>
                        </div>
                    </div>

                    <audio
                        key={audioUrl}
                        ref={audioRef}
                        src={audioUrl}
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        onEnded={() => {
                            setIsPlaying(false);
                            if (isTeacher) onAction('AUDIO_PAUSE', { t: duration });
                        }}
                    />

                    {!isTeacher && (
                        <div className="mt-4 flex items-center justify-center gap-2 py-1.5 px-3 bg-slate-50 rounded-lg">
                            <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest text-center">
                                Teacher Sync Active
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default memo(Listening);
