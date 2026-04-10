import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Platform,
    ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    ArrowLeft,
    Mic,
    MicOff,
    Video,
    VideoOff,
    MessageSquare,
    Hand,
    MoreHorizontal,
    X,
    PhoneOff,
    PenTool,
    Clock,
} from 'lucide-react-native';
import storage from '../../lib/storage';
import { Colors, Shadows, Spacing } from '../../theme';
import client from '../../api/client';

// Activities
import MobileWhiteboard from './MobileWhiteboard';
import QuizMobile from './QuizMobile';
import MatchingGameMobile from './MatchingGameMobile';
import GapFillMobile from './GapFillMobile';
import PdfActivityMobile from './PdfActivityMobile';
import VideoActivityMobile from './VideoActivityMobile';
import ListeningActivityMobile from './ListeningActivityMobile';
import LiveKitVideoRoom from './LiveKitVideoRoom';



const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Simple SVG-like dots pattern component
const DotsPattern = () => (
    <View style={styles.dotsContainer}>
        {[...Array(20)].map((_, i) => (
            <View key={i} style={styles.dotsRow}>
                {[...Array(12)].map((_, j) => (
                    <View key={j} style={styles.dot} />
                ))}
            </View>
        ))}
    </View>
);

interface ClassroomProps {
    navigation: any;
    route: any;
}

export default function MobileClassroom({ navigation, route }: ClassroomProps) {
    const { sessionId } = route.params;
    const insets = useSafeAreaInsets();

    // Connection State
    const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
    const [errorMessage, setErrorMessage] = useState('');
    const socketRef = useRef<WebSocket | null>(null);

    // Lesson State
    const [lessonData, setLessonData] = useState<any>(null);
    const [activeLesson, setActiveLesson] = useState<any>(null);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [gameState, setGameState] = useState<any>(null);
    const [videoSyncState, setVideoSyncState] = useState<any>(null);
    const [audioSyncState, setAudioSyncState] = useState<any>(null);

    // Media State
    const [isMicOn, setIsMicOn] = useState(true);
    const [isVideoOn, setIsVideoOn] = useState(true);
    const [activeVideo, setActiveVideo] = useState<'teacher' | 'student'>('teacher');

    // Timer (Simulated for UI like in photo)
    const [timer, setTimer] = useState("14:30");

    useEffect(() => {
        const connect = async () => {
            try {
                // 1. Fetch Entry Credentials
                const entryUrl = `/api/classroom/enter/${sessionId}/`;
                const entryRes = await client.get(entryUrl);
                setLessonData(entryRes.data);

                // 2. Setup WebSocket
                const token = await storage.getItemAsync('access_token');
                const wsBase = (process.env.EXPO_PUBLIC_API_URL ?? 'https://api.allright.uz')
                    .replace('http://', 'ws://')
                    .replace('https://', 'wss://');
                const wsUrl = `${wsBase}/ws/lesson/${sessionId}/?token=${token}`;

                const socket = new WebSocket(wsUrl);
                socketRef.current = socket;

                socket.onopen = () => {
                    console.log('Mobile Classroom Connected');
                    setStatus('connected');
                };

                socket.onmessage = (event) => {
                    const data = JSON.parse(event.data);

                    if (data.type === 'lesson_update' || data.type === 'lesson_state') {
                        if (data.payload.lesson) setActiveLesson(data.payload.lesson);
                        if (typeof data.payload.slideIndex === 'number') {
                            setCurrentSlide(data.payload.slideIndex);
                        }
                    } else if (data.type === 'ZONE_STATE_UPDATE') {
                        setGameState(data.payload);
                    } else if (['VIDEO_PLAY', 'VIDEO_PAUSE', 'VIDEO_SEEK', 'VIDEO_SYNC', 'VIDEO_STATE'].includes(data.type)) {
                        setVideoSyncState((prev: any) => {
                            const type = data.type;
                            let isPlaying = prev?.playing ?? false;

                            if (type === 'VIDEO_PLAY') isPlaying = true;
                            else if (type === 'VIDEO_PAUSE') isPlaying = false;
                            else if (type === 'VIDEO_STATE') isPlaying = data.payload?.state === 'playing';
                            // VIDEO_SYNC & VIDEO_SEEK only update time, preserving current play/pause status

                            return {
                                type,
                                playing: isPlaying,
                                currentTime: data.payload?.t ?? prev?.currentTime ?? 0,
                                payload: data.payload,
                                timestamp: Date.now()
                            };
                        });
                    } else if (['AUDIO_PLAY', 'AUDIO_PAUSE', 'AUDIO_SYNC', 'AUDIO_STATE'].includes(data.type)) {
                        setAudioSyncState({
                            type: data.type,
                            payload: data.payload,
                            action: data.type === 'AUDIO_STATE' ? 'AUDIO_STATE_UPDATE' : data.type
                        });
                    } else if (data.type === 'history_dump') {
                        const history = data.data || [];
                        const lastUpdate = [...history].reverse().find((i: any) => i.type === 'lesson_update' || i.type === 'lesson_state');
                        if (lastUpdate) {
                            setActiveLesson(lastUpdate.payload.lesson);
                            setCurrentSlide(lastUpdate.payload.slideIndex || 0);
                        }
                    }
                };

                socket.onerror = (e) => {
                    console.error('WS Error:', e);
                    setStatus('error');
                    setErrorMessage('Failed to connect to class');
                };

                socket.onclose = () => {
                    console.log('WS Closed');
                    if (status === 'connected') setStatus('connecting');
                };

            } catch (err: any) {
                console.error('Setup failed:', err.config?.url, err.message);
                setStatus('error');
                setErrorMessage(err.response?.data?.error || 'Connection error');
            }
        };

        connect();
        return () => socketRef.current?.close();
    }, [sessionId]);

    const sendAction = (action: string, data: any = {}) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                type: 'ZONE_ACTION',
                payload: {
                    activity_type: activeLesson?.activities[currentSlide]?.activity_type || 'whiteboard',
                    action,
                    ...data
                }
            }));
        }
    };

    // Render logic for different activities
    const renderActivity = () => {
        if (!activeLesson) return (
            <View style={styles.waitingContainer}>
                <ActivityIndicator color={Colors.primary} />
                <Text style={styles.waitingText}>Waiting for teacher...</Text>
            </View>
        );



        const activity = activeLesson.activities[currentSlide];
        if (!activity) return (
            <View style={styles.placeholderContainer}>
                <Text style={styles.placeholderTitle}>End of Lesson</Text>
                <Text style={styles.placeholderSub}>Thank you for participating!</Text>
            </View>
        );

        const type = activity.activity_type || 'whiteboard';
        const content = typeof activity.content === 'string' ? JSON.parse(activity.content) : activity.content;

        switch (type) {
            case 'image':
            case 'whiteboard':
                return (
                    <MobileWhiteboard
                        gameState={gameState}
                        backgroundImage={content?.url || content?.image}
                        onAction={(action, data) => sendAction(action, data)}
                    />
                );
            case 'quiz':
                return (
                    <QuizMobile
                        content={content}
                        gameState={gameState}
                        onAction={(action, data) => sendAction(action, data)}
                        isTeacher={lessonData?.role === 'teacher'}
                    />
                );
            case 'matching':
                return (
                    <MatchingGameMobile
                        content={content}
                        gameState={gameState}
                        onAction={(action, data) => sendAction(action, data)}
                        isTeacher={lessonData?.role === 'teacher'}
                    />
                );
            case 'gap_fill':
                return (
                    <GapFillMobile
                        content={content}
                        gameState={gameState}
                        onAction={(action, data) => sendAction(action, data)}
                        isTeacher={lessonData?.role === 'teacher'}
                    />
                );
            case 'pdf':
                return (
                    <PdfActivityMobile
                        content={content}
                        gameState={gameState}
                        onAction={(action, data) => sendAction(action, data)}
                        isTeacher={lessonData?.role === 'teacher'}
                    />
                );
            case 'video':
                return (
                    <VideoActivityMobile
                        content={content}
                        gameState={gameState}
                        videoSyncState={videoSyncState}
                        onAction={(action, data) => sendAction(action, data)}
                        isTeacher={lessonData?.role === 'teacher'}
                    />
                );
            case 'listening':
                return (
                    <ListeningActivityMobile
                        content={content}
                        gameState={audioSyncState}
                        onAction={(action, data) => sendAction(action, data)}
                        isTeacher={lessonData?.role === 'teacher'}
                    />
                );
            default:
                return (
                    <View style={styles.activityPlaceholder}>
                        <Text style={styles.placeholderTitle}>{activity.title}</Text>
                        <Text style={styles.placeholderSub}>Activity "{type}" coming soon to mobile</Text>
                    </View>
                );
        }
    };

    if (status === 'connecting') {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Synchronizing classroom...</Text>
            </View>
        );
    }

    if (status === 'error') {
        return (
            <View style={styles.centered}>
                <View style={styles.errorIcon}>
                    <X size={32} color={Colors.error} />
                </View>
                <Text style={styles.errorText}>{errorMessage}</Text>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.backBtnText}>Exit Classroom</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.root}>
            {/* 1. Header (Glassmorphism layer) */}
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerCircleBtn}>
                        <ArrowLeft size={22} color="#FFFFFF" />
                    </TouchableOpacity>

                    <View style={styles.headerInfo}>
                        <Text style={styles.lessonName}>
                            {activeLesson?.title || lessonData?.lesson?.title || 'English Session'}
                        </Text>
                        <View style={styles.teacherIndicator}>
                            <View style={styles.liveDot} />
                            <Text style={styles.teacherName}>{lessonData?.teacher_name || 'Teacher'}</Text>
                        </View>
                    </View>

                    <View style={styles.timerContainer}>
                        <Clock size={14} color="#FFFFFF" />
                        <Text style={styles.timerText}>{timer}</Text>
                    </View>
                </View>

                {/* Slide Tracker Pill */}
                {activeLesson && (
                    <View style={styles.slideTracker}>
                        <Text style={styles.slideTrackerText}>
                            SLIDE {currentSlide + 1}/{activeLesson.activities.length}: {activeLesson.activities[currentSlide]?.title || ''}
                        </Text>
                    </View>
                )}
            </View>

            {/* 2. Dotted Board Area */}
            <View style={styles.boardArea}>
                <DotsPattern />
                <View style={styles.activityContainer}>
                    {renderActivity()}
                </View>

                {/* Interaction Feedback (Maria is typing style) */}
                <View style={[styles.feedbackPill, { bottom: 180 }]}>
                    <View style={styles.checkCircle}>
                        <Image
                            source={{ uri: lessonData?.teacher_profile_picture_url || 'https://i.pravatar.cc/100?u=teacher' }}
                            style={styles.miniAvatar}
                        />
                    </View>
                    <View>
                        <Text style={styles.feedbackTitle}>{lessonData?.teacher_name || 'Teacher'} is typing...</Text>
                        <Text style={styles.feedbackText}>"Very good! How are you today?"</Text>
                    </View>
                </View>
            </View>

            {/* 3. Video Overlay (PiP WhatsApp Style) */}
            <View style={[styles.videoOverlay, { bottom: 110, right: 20 }]}>
                <TouchableOpacity
                    style={styles.mainVideo}
                    onPress={() => setActiveVideo(activeVideo === 'teacher' ? 'student' : 'teacher')}
                    activeOpacity={0.9}
                >
                    {lessonData && (
                        <LiveKitVideoRoom
                            livekitUrl={lessonData.livekitUrl}
                            token={lessonData.token}
                            roomName={lessonData.channel}
                            micOn={isMicOn}
                            cameraOn={isVideoOn}
                        />
                    )}
                    <View style={styles.videoLabel}>
                        <Text style={styles.videoLabelText}>
                            {activeVideo === 'teacher' ? (lessonData?.teacher_name || 'Teacher') : 'You'}
                        </Text>
                        <Mic size={10} color="#FFFFFF" style={{ marginLeft: 4 }} />
                    </View>
                </TouchableOpacity>
            </View>

            {/* 4. Control Bar */}
            <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
                <View style={styles.controlsBar}>
                    <TouchableOpacity
                        style={[styles.controlBtn, !isMicOn && styles.controlBtnOff]}
                        onPress={() => setIsMicOn(!isMicOn)}
                    >
                        {isMicOn ? <Mic size={22} color="#FFFFFF" /> : <MicOff size={22} color="#FFFFFF" />}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.controlBtn, isVideoOn ? styles.controlBtnActive : styles.controlBtnOff]}
                        onPress={() => setIsVideoOn(!isVideoOn)}
                    >
                        {isVideoOn ? <Video size={22} color="#FFFFFF" /> : <VideoOff size={22} color="#FFFFFF" />}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.controlBtn}>
                        <PenTool size={22} color="#FFFFFF" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.controlBtn}>
                        <Hand size={22} color="#FFFFFF" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.controlBtn}>
                        <MoreHorizontal size={22} color="#FFFFFF" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.controlBtn, styles.endSessionBtn]}
                        onPress={() => {
                            Alert.alert('Leave Session', 'Are you sure you want to exit the classroom?', [
                                { text: 'Stay', style: 'cancel' },
                                { text: 'Leave', onPress: () => navigation.goBack(), style: 'destructive' }
                            ]);
                        }}
                    >
                        <PhoneOff size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        paddingHorizontal: 20,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerCircleBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerInfo: {
        flex: 1,
        marginHorizontal: 15,
    },
    lessonName: {
        fontSize: 14,
        fontWeight: '800',
        color: '#FFFFFF',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    teacherIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#EF4444',
        marginRight: 6,
    },
    teacherName: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '600',
    },
    timerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    timerText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
    },
    slideTracker: {
        alignSelf: 'center',
        marginTop: 15,
        backgroundColor: 'rgba(0,0,0,0.05)',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
    },
    slideTrackerText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#64748B',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    boardArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    activityContainer: {
        flex: 1,
        paddingTop: 150, // Clearance for header
        paddingBottom: 150, // Clearance for footer
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
    },
    controlsBar: {
        flexDirection: 'row',
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        padding: 12,
        borderRadius: 40,
        justifyContent: 'space-between',
        alignItems: 'center',
        ...Shadows.lg,
    },
    controlBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    controlBtnActive: {
        backgroundColor: '#3B82F6',
    },
    controlBtnOff: {
        backgroundColor: '#EF4444',
    },
    endSessionBtn: {
        backgroundColor: '#EF4444',
    },
    videoOverlay: {
        position: 'absolute',
        zIndex: 20,
        width: 100,
        height: 140,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#000',
        ...Shadows.md,
        borderWidth: 2,
        borderColor: '#F8FAFC',
    },
    mainVideo: {
        flex: 1,
    },
    videoStream: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    videoLabel: {
        position: 'absolute',
        bottom: 8,
        left: 8,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
    },
    videoLabelText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
    },
    feedbackPill: {
        position: 'absolute',
        left: 20,
        right: 20,
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#BBF7D0',
        padding: 12,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    checkCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        overflow: 'hidden',
    },
    miniAvatar: {
        width: '100%',
        height: '100%',
    },
    feedbackTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#166534',
    },
    feedbackText: {
        fontSize: 12,
        color: '#15803D',
        fontStyle: 'italic',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    loadingText: {
        marginTop: 15,
        fontSize: 14,
        color: '#64748B',
        fontWeight: '600',
    },
    errorIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FEE2E2',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    errorText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 30,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    backBtn: {
        backgroundColor: '#3B82F6',
        paddingHorizontal: 25,
        paddingVertical: 12,
        borderRadius: 15,
    },
    backBtnText: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    waitingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    waitingText: {
        marginTop: 10,
        color: '#64748B',
        fontWeight: '600',
    },
    activityPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    dotsContainer: {
        ...StyleSheet.absoluteFillObject,
        padding: 5,
        justifyContent: 'space-around',
    },
    dotsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    dot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#E2E8F0',
    },
    placeholderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: '#1E293B',
        textAlign: 'center',
    },
    placeholderSub: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 10,
    }
});
