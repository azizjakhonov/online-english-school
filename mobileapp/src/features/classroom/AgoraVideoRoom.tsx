import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    View,
    StyleSheet,
    Platform,
    PermissionsAndroid,
    Text,
    ActivityIndicator
} from 'react-native';

// We wrap the imports to prevent Expo Go and Web from crashing if native modules are missing
let AgoraEngine: any = null;

if (Platform.OS !== 'web') {
    try {
        AgoraEngine = require('react-native-agora');
    } catch (e) {
        console.warn('Agora Native Package not found');
    }
}

export default function AgoraVideoRoom({
    appId,
    channelName,
    token,
    uid,
    micOn,
    cameraOn,
    activePlayer
}: any) {
    const engine = useRef<any>(null);
    const [remoteUsers, setRemoteUsers] = useState<number[]>([]);
    const [isJoined, setIsJoined] = useState(false);
    const [loading, setLoading] = useState(true);
    const [unsupported, setUnsupported] = useState(!AgoraEngine);

    const init = useCallback(async () => {
        if (!AgoraEngine) return;

        try {
            if (Platform.OS === 'android') {
                await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                    PermissionsAndroid.PERMISSIONS.CAMERA,
                ]);
            }

            engine.current = AgoraEngine.createAgoraRtcEngine();
            const rtcEngine = engine.current;

            rtcEngine.initialize({
                appId,
                channelProfile: AgoraEngine.ChannelProfileType.ChannelProfileCommunication,
            });

            rtcEngine.registerEventHandler({
                onJoinChannelSuccess: (connection: any, elapsed: number) => {
                    console.log('Joined successfully', connection.channelId);
                    setIsJoined(true);
                    setLoading(false);
                },
                onUserJoined: (connection: any, remoteUid: number, elapsed: number) => {
                    console.log('Remote user joined', remoteUid);
                    setRemoteUsers(prev => [...prev, remoteUid]);
                },
                onUserOffline: (connection: any, remoteUid: number, reason: number) => {
                    console.log('Remote user offline', remoteUid);
                    setRemoteUsers(prev => prev.filter(id => id !== remoteUid));
                },
                onError: (err: number, msg: string) => {
                    console.error('Agora Error:', err, msg);
                    if (err === 17) { // Error code for "not supported" or similar in some environments
                        setUnsupported(true);
                    }
                }
            });

            rtcEngine.enableVideo();
            rtcEngine.startPreview();

            // Join Channel
            rtcEngine.joinChannel(token, channelName, uid, {
                clientRoleType: AgoraEngine.ClientRoleType.ClientRoleBroadcaster,
            });

        } catch (e) {
            console.error('Agora Init Error', e);
            setUnsupported(true);
        }
    }, [appId, channelName, token, uid]);

    useEffect(() => {
        init();
        return () => {
            if (engine.current) {
                engine.current.leaveChannel();
                engine.current.release();
            }
        };
    }, [init]);

    // Handle Mic/Camera Toggles
    useEffect(() => {
        if (!engine.current || !isJoined) return;
        engine.current.muteLocalAudioStream(!micOn);
    }, [micOn, isJoined]);

    useEffect(() => {
        if (!engine.current || !isJoined) return;
        engine.current.muteLocalVideoStream(!cameraOn);
    }, [cameraOn, isJoined]);

    if (unsupported) {
        return (
            <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>Video Unavailable</Text>
                <Text style={styles.subText}>Expo Go does not support native video modules.</Text>
            </View>
        );
    }

    if (loading) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator color="#FFFFFF" />
            </View>
        );
    }

    const remoteUid = remoteUsers.length > 0 ? remoteUsers[0] : null;
    const { RtcSurfaceView } = AgoraEngine;

    return (
        <View style={styles.container}>
            {activePlayer === 'student' ? (
                // Local Student View
                cameraOn ? (
                    <RtcSurfaceView
                        canvas={{ uid: 0 }}
                        style={styles.videoView}
                    />
                ) : (
                    <View style={styles.placeholder}>
                        <Text style={styles.placeholderText}>Camera Off</Text>
                    </View>
                )
            ) : (
                // Remote Teacher View
                remoteUid ? (
                    <RtcSurfaceView
                        canvas={{ uid: remoteUid }}
                        style={styles.videoView}
                    />
                ) : (
                    <View style={styles.placeholder}>
                        <Text style={styles.placeholderText}>Teacher Offline</Text>
                    </View>
                )
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    videoView: {
        flex: 1,
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1E293B',
    },
    placeholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#334155',
        padding: 10,
    },
    placeholderText: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '900',
    },
    subText: {
        color: '#64748B',
        fontSize: 10,
        textAlign: 'center',
        marginTop: 4,
    }
});
