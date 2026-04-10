import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    Dimensions,
    Platform,
} from 'react-native';
import { Audio, AVPlaybackStatus, AVPlaybackStatusSuccess } from 'expo-av';
import { Play, Headphones } from 'lucide-react-native';
import { Colors, Shadows } from '../../theme';
import storage from '../../lib/storage';
import { BRIDGE_BASE_URL } from '../../api/client';

interface ListeningProps {
    content: {
        audio_id?: number;
        audio_download_url?: string;
        audio_title?: string;
        url?: string;
        title?: string;
    };
    onAction: (action: string, data?: any) => void;
    gameState?: any;
    isTeacher?: boolean;
}

export default function ListeningActivityMobile({ content, onAction, gameState, isTeacher }: ListeningProps) {
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const isSyncingRef = useRef(false);

    useEffect(() => {
        storage.getItemAsync('access_token').then(setToken);
    }, []);

    const audioUrl = useMemo(() => {
        if (content.url) return content.url;
        if (content.audio_id && token) {
            return `${BRIDGE_BASE_URL}/api/curriculum/audio/${content.audio_id}/download/?token=${token}`;
        }
        if (content.audio_download_url) {
            if (content.audio_download_url.startsWith('http')) return content.audio_download_url;
            return `${BRIDGE_BASE_URL}${content.audio_download_url.startsWith('/') ? '' : '/'}${content.audio_download_url}`;
        }
        return '';
    }, [content, token]);

    // Cleanup logic
    const unloadSound = async () => {
        if (sound) {
            try {
                await sound.unloadAsync();
            } catch (e) { }
        }
    };

    useEffect(() => {
        if (!audioUrl) return;

        async function loadSound() {
            try {
                setLoading(true);
                await unloadSound();

                const { sound: newSound } = await Audio.Sound.createAsync(
                    { uri: audioUrl },
                    { shouldPlay: false, progressUpdateIntervalMillis: 500 },
                    onPlaybackStatusUpdate
                );
                setSound(newSound);
                setLoading(false);
            } catch (error) {
                console.error('[Audio Mobile] Load Error:', error);
                setLoading(false);
            }
        }

        loadSound();
        return () => { unloadSound(); };
    }, [audioUrl]);

    // Real-Time Sync Logic (Backend-Authoritative)
    useEffect(() => {
        if (!sound || isTeacher || isSyncingRef.current || !gameState) return;

        const { type, payload } = gameState;
        // Map types or use explicit state from payload
        const state = payload?.state ||
            (type === 'AUDIO_PLAY' || type === 'AUDIO_STATE_UPDATE' && payload?.state === 'playing' ? 'playing' :
                type === 'AUDIO_PAUSE' || type === 'AUDIO_STATE_UPDATE' && payload?.state === 'paused' ? 'paused' : '');

        // If it's just a sync or state update, we focus on 't'
        const t = payload?.t ?? (type === 'AUDIO_SYNC' ? payload?.t : 0);
        const d = payload?.d ?? 0;

        if (d > 0 && duration === 0) {
            setDuration(d);
        }

        if (state || typeof t === 'number') {
            syncPlayer(state, t);
        }
    }, [gameState]);

    const syncPlayer = async (state: string, t: number) => {
        if (!sound) return;

        try {
            const status = await sound.getStatusAsync();
            if (!status.isLoaded) return;

            const currentT = status.positionMillis / 1000;
            const drift = Math.abs(currentT - t);

            // Avoid double-syncing or syncing within small drift (2.5s for audio)
            if (isSyncingRef.current) return;

            const shouldSeek = drift > 2.5;

            if (shouldSeek) {
                isSyncingRef.current = true;
                await sound.setPositionAsync(Math.floor(t * 1000));
                // Wait a bit for seek to settle
                setTimeout(() => { isSyncingRef.current = false; }, 800);
            }

            // Sync Playback State
            if (state === 'playing' && !status.isPlaying) {
                await sound.playAsync();
                setIsPlaying(true);
            } else if (state === 'paused' && status.isPlaying) {
                await sound.pauseAsync();
                setIsPlaying(false);
            }
        } catch (e) {
            console.warn('[Sync] Failed:', e);
            isSyncingRef.current = false;
        }
    };

    const lastSyncSentRef = useRef(0);
    const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
        if (!status.isLoaded) {
            if (status.error) {
                console.error('[Audio Mobile] Runtime Error:', status.error);
            }
            return;
        }
        const s = status as AVPlaybackStatusSuccess;

        setIsPlaying(s.isPlaying);
        setCurrentTime(s.positionMillis / 1000);
        if (s.durationMillis) setDuration(s.durationMillis / 1000);

        // Teacher periodic update to keep students aligned
        if (isTeacher && s.isPlaying && !isSyncingRef.current) {
            const t = s.positionMillis / 1000;
            const floorT = Math.floor(t);
            // Send sync every 5 seconds, but only once per second-mark
            if (floorT > 0 && floorT % 5 === 0 && lastSyncSentRef.current !== floorT) {
                lastSyncSentRef.current = floorT;
                onAction('AUDIO_SYNC', { t });
            }
        }
    };

    const handleTogglePlay = async () => {
        if (!sound || !isTeacher) return;

        try {
            if (isPlaying) {
                await sound.pauseAsync();
                onAction('AUDIO_PAUSE', { t: currentTime });
            } else {
                await sound.playAsync();
                onAction('AUDIO_PLAY', { t: currentTime });
            }
        } catch (e) { }
    };

    const formatTime = (time: number) => {
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const progress = duration > 0 ? currentTime / duration : 0;
    const title = content.audio_title || content.title || 'Audio Recording';

    return (
        <View style={styles.container}>
            <View style={styles.pillCard}>
                <View style={styles.row}>
                    <TouchableOpacity
                        style={[
                            styles.playBtn,
                            loading && { opacity: 0.5 },
                            !isTeacher && { backgroundColor: '#F1F5F9' }
                        ]}
                        onPress={handleTogglePlay}
                        disabled={loading || !isTeacher}
                    >
                        {loading ? (
                            <ActivityIndicator color="#1E293B" size="small" />
                        ) : isPlaying ? (
                            <View style={styles.pauseBars}>
                                <View style={styles.pBar} />
                                <View style={styles.pBar} />
                            </View>
                        ) : (
                            <Play size={18} color={!isTeacher ? "#CBD5E1" : "#1E293B"} fill={!isTeacher ? "transparent" : "#1E293B"} style={{ marginLeft: 2 }} />
                        )}
                    </TouchableOpacity>

                    <View style={styles.progressCol}>
                        <View style={styles.headerRow}>
                            <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
                            <Text style={styles.timeLabel}>{formatTime(currentTime)} / {formatTime(duration)}</Text>
                        </View>
                        <View style={styles.barBg}>
                            <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
                        </View>
                    </View>
                </View>

                {!isTeacher && (
                    <View style={styles.syncFooter}>
                        <View style={styles.blueDot} />
                        <Text style={styles.syncLabel}>SYNCHRONIZED BY TEACHER</Text>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    pillCard: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        padding: 16,
        paddingBottom: 12,
        ...Shadows.md,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    playBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FBBF24',
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadows.sm,
    },
    pauseBars: {
        flexDirection: 'row',
        gap: 2.5,
    },
    pBar: {
        width: 3,
        height: 14,
        backgroundColor: '#1E293B',
        borderRadius: 2,
    },
    progressCol: {
        flex: 1,
        gap: 6,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingRight: 4,
    },
    titleText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#1E293B',
        flex: 1,
        marginRight: 10,
    },
    timeLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: '#94A3B8',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    barBg: {
        height: 6,
        backgroundColor: '#F1F5F9',
        borderRadius: 3,
        overflow: 'hidden',
    },
    barFill: {
        height: '100%',
        backgroundColor: '#FBBF24',
        borderRadius: 3,
    },
    syncFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 12,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F8FAFC',
    },
    blueDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#3B82F6',
    },
    syncLabel: {
        fontSize: 8,
        fontWeight: '800',
        color: '#CBD5E1',
        letterSpacing: 0.8,
    }
});
