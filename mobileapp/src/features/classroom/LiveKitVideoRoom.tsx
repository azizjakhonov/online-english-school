/**
 * LiveKitVideoRoom.tsx — LiveKit video component for React Native
 * ─────────────────────────────────────────────────────────────────
 * Replaces AgoraVideoRoom.tsx.
 *
 * Uses @livekit/react-native for native WebRTC in production builds.
 * Falls back gracefully when native modules are unavailable (Expo Go).
 *
 * Props:
 *   livekitUrl   — wss://livekit.allright.uz  (from backend /api/classroom/enter/)
 *   token        — LiveKit participant token   (from backend)
 *   roomName     — room channel name           (from backend 'channel' field)
 *   micOn        — controlled mic state
 *   cameraOn     — controlled camera state
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    View,
    Text,
    ActivityIndicator,
    StyleSheet,
    Platform,
} from 'react-native';

// ── Safely import LiveKit native module (not available in Expo Go) ─────────────
let LiveKitNative: any = null;
let useParticipant: any = null;
let useRoom: any = null;

if (Platform.OS !== 'web') {
    try {
        const lk = require('@livekit/react-native');
        // Ensure WebRTC globals are registered (idempotent — safe to call multiple times)
        lk.registerGlobals();
        LiveKitNative = lk;
        useParticipant = lk.useParticipant;
        useRoom = lk.useRoom;
    } catch (e) {
        console.warn('[LiveKitVideoRoom] @livekit/react-native not found — video unavailable');
    }
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface LiveKitVideoRoomProps {
    livekitUrl: string;
    token: string;
    roomName: string;
    micOn: boolean;
    cameraOn: boolean;
}

// ── Unsupported fallback ──────────────────────────────────────────────────────
function UnsupportedView({ message }: { message: string }) {
    return (
        <View style={styles.unsupported}>
            <Text style={styles.unsupportedTitle}>Video Unavailable</Text>
            <Text style={styles.unsupportedSub}>{message}</Text>
        </View>
    );
}

// ── Loading view ──────────────────────────────────────────────────────────────
function LoadingView() {
    return (
        <View style={styles.loading}>
            <ActivityIndicator color="#FFFFFF" size="small" />
        </View>
    );
}

// ── Video track renderer ──────────────────────────────────────────────────────
// Uses LiveKit's VideoView component to render a participant's camera track
function ParticipantVideo({ participant, isLocal }: { participant: any; isLocal: boolean }) {
    if (!LiveKitNative) return null;
    const { VideoView } = LiveKitNative;
    const { Track } = require('livekit-client');

    return (
        <VideoView
            style={StyleSheet.absoluteFillObject}
            videoTrack={participant.getTrackPublication(Track.Source.Camera)?.videoTrack ?? undefined}
            mirror={isLocal}
            objectFit="cover"
        />
    );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LiveKitVideoRoom({
    livekitUrl,
    token,
    roomName,
    micOn,
    cameraOn,
}: LiveKitVideoRoomProps) {
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [remoteParticipants, setRemoteParticipants] = useState<any[]>([]);

    const roomRef = useRef<any>(null);

    // ── Check if native module is available ──────────────────────────────────
    if (!LiveKitNative) {
        return (
            <UnsupportedView
                message="LiveKit requires a native build. Run expo prebuild then expo run:android."
            />
        );
    }

    if (!livekitUrl || !token) {
        return <UnsupportedView message="No LiveKit credentials provided." />;
    }

    // ── Connect to LiveKit room ───────────────────────────────────────────────
    useEffect(() => {
        const { Room, RoomEvent } = require('livekit-client');

        let mounted = true;
        const room = new Room({
            adaptiveStream: true,
            dynacast: true,
        });
        roomRef.current = room;

        const refreshRemotes = () => {
            if (!mounted) return;
            const list: any[] = [];
            room.remoteParticipants.forEach((p: any) => list.push(p));
            setRemoteParticipants([...list]);
        };

        room
            .on(RoomEvent.ParticipantConnected, refreshRemotes)
            .on(RoomEvent.ParticipantDisconnected, refreshRemotes)
            .on(RoomEvent.TrackSubscribed, refreshRemotes)
            .on(RoomEvent.TrackUnsubscribed, refreshRemotes)
            .on(RoomEvent.TrackMuted, refreshRemotes)
            .on(RoomEvent.TrackUnmuted, refreshRemotes);

        const connect = async () => {
            try {
                await room.connect(livekitUrl, token, { autoSubscribe: true });
                if (!mounted) return;

                await room.localParticipant.setCameraEnabled(cameraOn);
                await room.localParticipant.setMicrophoneEnabled(micOn);

                if (mounted) {
                    setConnected(true);
                    refreshRemotes();
                }
            } catch (err: any) {
                console.error('[LiveKitVideoRoom] Connection failed:', err);
                if (mounted) setError(err?.message ?? 'Connection failed');
            }
        };

        connect();

        return () => {
            mounted = false;
            room.disconnect();
            roomRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [livekitUrl, token]);

    // ── Mic toggle ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (!connected || !roomRef.current) return;
        roomRef.current.localParticipant
            .setMicrophoneEnabled(micOn)
            .catch(console.error);
    }, [micOn, connected]);

    // ── Camera toggle ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!connected || !roomRef.current) return;
        roomRef.current.localParticipant
            .setCameraEnabled(cameraOn)
            .catch(console.error);
    }, [cameraOn, connected]);

    // ── Render ───────────────────────────────────────────────────────────────
    if (error) return <UnsupportedView message={error} />;
    if (!connected) return <LoadingView />;

    const localParticipant = roomRef.current?.localParticipant;
    const firstRemote = remoteParticipants[0] ?? null;

    return (
        <View style={styles.container}>
            {/* Remote participant (teacher/student on the other end) */}
            {firstRemote ? (
                <View style={styles.remoteVideo}>
                    <ParticipantVideo participant={firstRemote} isLocal={false} />
                    <View style={styles.labelBadge}>
                        <Text style={styles.labelText}>
                            {firstRemote.name || firstRemote.identity || 'Remote'}
                        </Text>
                    </View>
                </View>
            ) : (
                <View style={styles.waitingBox}>
                    <Text style={styles.waitingText}>Waiting for other participant…</Text>
                </View>
            )}

            {/* Local camera (picture-in-picture, bottom-right) */}
            {cameraOn && localParticipant && (
                <View style={styles.localPip}>
                    <ParticipantVideo participant={localParticipant} isLocal={true} />
                </View>
            )}

            {/* Mic-off badge */}
            {!micOn && (
                <View style={styles.mutedBadge}>
                    <Text style={styles.mutedText}>🔇 Muted</Text>
                </View>
            )}
        </View>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A',
    },
    remoteVideo: {
        flex: 1,
        backgroundColor: '#1E293B',
    },
    waitingBox: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1E293B',
    },
    waitingText: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '600',
    },
    localPip: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        width: 72,
        height: 96,
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: '#334155',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    labelBadge: {
        position: 'absolute',
        bottom: 6,
        left: 6,
        backgroundColor: 'rgba(0,0,0,0.55)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    labelText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '700',
    },
    mutedBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    mutedText: {
        color: '#F87171',
        fontSize: 10,
        fontWeight: '700',
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1E293B',
    },
    unsupported: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#334155',
        padding: 12,
    },
    unsupportedTitle: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '900',
        marginBottom: 4,
    },
    unsupportedSub: {
        color: '#64748B',
        fontSize: 10,
        textAlign: 'center',
    },
});
