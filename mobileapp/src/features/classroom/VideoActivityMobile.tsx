import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus, AVPlaybackStatusSuccess } from 'expo-av';
import YoutubePlayer from 'react-native-youtube-iframe';
import { Shadows } from '../../theme';
import * as SecureStore from 'expo-secure-store';
import { BRIDGE_BASE_URL } from '../../api/client';

interface VideoProps {
    content: {
        url?: string;
        title?: string;
        video_download_url?: string;
    };
    onAction: (action: string, data?: any) => void;
    gameState?: any;
    videoSyncState?: { playing: boolean; currentTime: number; type?: string; payload?: any; timestamp?: number };
    isTeacher?: boolean;
}

const extractYouTubeId = (url: string): string | null => {
    const patterns = [/[?&]v=([^&]+)/, /youtu\.be\/([^?]+)/, /embed\/([^?]+)/];
    for (const re of patterns) {
        const m = url.match(re);
        if (m) return m[1];
    }
    return null;
};

export default function VideoActivityMobile({ content, onAction, gameState, videoSyncState, isTeacher }: VideoProps) {
    const videoRef = useRef<Video>(null);
    const ytRef = useRef<any>(null);
    const [status, setStatus] = useState<AVPlaybackStatus>({} as AVPlaybackStatus);
    const [loading, setLoading] = useState(true);
    const [playing, setPlaying] = useState(false);
    const [token, setToken] = useState<string | null>(null);
    const isSyncingRef = useRef(false);
    const lastSyncSentRef = useRef(0);

    const ytId = content.url ? extractYouTubeId(content.url) : null;

    useEffect(() => {
        SecureStore.getItemAsync('access_token').then(setToken);
    }, []);

    // Sync Student with Teacher Actions
    useEffect(() => {
        if (isTeacher || !videoSyncState) return;

        const { type, payload, playing: remotePlaying } = videoSyncState;
        const targetT = payload?.t ?? videoSyncState.currentTime ?? 0;

        // Strictly determine playing state
        // If type is VIDEO_PAUSE, it MUST be false.
        let targetPlaying = playing;
        if (type === 'VIDEO_PAUSE') targetPlaying = false;
        else if (type === 'VIDEO_PLAY') targetPlaying = true;
        else if (type === 'VIDEO_STATE') targetPlaying = (payload?.state === 'playing');
        else if (type === 'VIDEO_SYNC') targetPlaying = remotePlaying;

        const sync = async () => {
            if (ytId) {
                // 1. Command-based playback toggling (Prop change)
                if (playing !== targetPlaying) {
                    console.log(`[Video] Syncing play state to: ${targetPlaying}`);
                    setPlaying(targetPlaying);
                    return; // Let the render apply the play prop
                }

                if (!ytRef.current) return;

                try {
                    // 2. Immediate Seek for Play/Seek/State updates
                    if (type === 'VIDEO_PLAY' || type === 'VIDEO_SEEK' || type === 'VIDEO_STATE') {
                        isSyncingRef.current = true;
                        ytRef.current.seekTo(targetT, true);
                        setTimeout(() => { isSyncingRef.current = false; }, 1000);
                    }
                    // 3. Periodic Sync DRIFT (Only if playing)
                    else if (type === 'VIDEO_SYNC' && playing) {
                        const currentT = await ytRef.current.getCurrentTime();
                        const drift = Math.abs(currentT - targetT);
                        if (drift > 2.0 && !isSyncingRef.current) {
                            isSyncingRef.current = true;
                            ytRef.current.seekTo(targetT, true);
                            setTimeout(() => { isSyncingRef.current = false; }, 1500);
                        }
                    }
                } catch (e) { }
            } else {
                // Native Video Logic (Fallback)
                if (!videoRef.current) return;
                const currentStatus = await videoRef.current.getStatusAsync();
                if (!currentStatus.isLoaded) return;
                const currentT = currentStatus.positionMillis / 1000;
                const drift = Math.abs(currentT - targetT);

                if (drift > 2.0 && !isSyncingRef.current) {
                    isSyncingRef.current = true;
                    await videoRef.current.setPositionAsync(Math.floor(targetT * 1000));
                    setTimeout(() => { isSyncingRef.current = false; }, 1000);
                }

                if (targetPlaying && !currentStatus.isPlaying) {
                    await videoRef.current.playAsync();
                } else if (!targetPlaying && currentStatus.isPlaying) {
                    await videoRef.current.pauseAsync();
                }
            }
        };
        sync();
    }, [videoSyncState, ytId, isTeacher, playing]);

    // Teacher Broadcasting
    useEffect(() => {
        if (!isTeacher || !ytId) return;
        const interval = setInterval(async () => {
            if (ytRef.current && playing && !isSyncingRef.current) {
                try {
                    const t = await ytRef.current.getCurrentTime();
                    const floorT = Math.floor(t);
                    if (floorT > 0 && floorT % 5 === 0 && lastSyncSentRef.current !== floorT) {
                        lastSyncSentRef.current = floorT;
                        onAction('VIDEO_SYNC', { t });
                    }
                } catch (e) { }
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [isTeacher, ytId, playing]);

    const onPlaybackStatusUpdate = (s: AVPlaybackStatus) => {
        setStatus(s);
        if (!s.isLoaded) return;
        const ps = s as AVPlaybackStatusSuccess;
        if (isTeacher && ps.isPlaying && !isSyncingRef.current) {
            const t = ps.positionMillis / 1000;
            const floorT = Math.floor(t);
            if (floorT > 0 && floorT % 5 === 0 && lastSyncSentRef.current !== floorT) {
                lastSyncSentRef.current = floorT;
                onAction('VIDEO_SYNC', { t });
            }
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <View style={styles.videoContainer}>
                    {ytId ? (
                        <YoutubePlayer
                            ref={ytRef}
                            height="100%"
                            width="100%"
                            play={isTeacher ? undefined : playing}
                            videoId={ytId}
                            initialPlayerParams={{
                                controls: isTeacher,
                                modestbranding: true,
                                rel: false,
                            }}
                            onChangeState={async (event: string) => {
                                if (isTeacher) {
                                    if (event === 'playing') {
                                        setPlaying(true);
                                        const t = await ytRef.current?.getCurrentTime() || 0;
                                        onAction('VIDEO_PLAY', { t });
                                    }
                                    if (event === 'paused') {
                                        setPlaying(false);
                                        const t = await ytRef.current?.getCurrentTime() || 0;
                                        onAction('VIDEO_PAUSE', { t });
                                    }
                                }
                            }}
                            onReady={() => setLoading(false)}
                        />
                    ) : (
                        <Video
                            ref={videoRef}
                            style={styles.video}
                            source={{
                                uri: (content as any).video_download_url && token
                                    ? ((content as any).video_download_url.startsWith('http')
                                        ? `${(content as any).video_download_url}${((content as any).video_download_url).includes('?') ? '&' : '?'}token=${token}`
                                        : `${BRIDGE_BASE_URL}${(content as any).video_download_url.startsWith('/') ? '' : '/'}${(content as any).video_download_url}?token=${token}`)
                                    : (content.url?.startsWith('http')
                                        ? content.url
                                        : content.url
                                            ? `${BRIDGE_BASE_URL}${content.url.startsWith('/') ? '' : '/'}${content.url}`
                                            : '')
                            }}
                            useNativeControls={isTeacher}
                            resizeMode={ResizeMode.CONTAIN}
                            onPlaybackStatusUpdate={onPlaybackStatusUpdate}
                            onLoadStart={() => setLoading(true)}
                            onLoad={() => setLoading(false)}
                            onError={(e) => {
                                console.error('Video Load Error:', e);
                                setLoading(false);
                            }}
                        />
                    )}
                    {loading && (
                        <View style={styles.loaderOverlay}>
                            <ActivityIndicator color="#3B82F6" size="large" />
                        </View>
                    )}
                </View>

                {!isTeacher && (
                    <View style={styles.remoteIndicator}>
                        <Text style={styles.indicatorText}>
                            {playing ? 'Teacher is playing video' : 'Video paused by teacher'}
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 16,
        ...Shadows.md,
    },
    videoContainer: {
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: '#000',
        borderRadius: 16,
        overflow: 'hidden',
    },
    video: {
        flex: 1,
    },
    loaderOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    remoteIndicator: {
        marginTop: 15,
        padding: 12,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        alignItems: 'center',
    },
    indicatorText: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '600',
    }
});
