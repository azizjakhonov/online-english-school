import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Dimensions,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Bell,
    Plus,
    Clock,
    Flame,
    Play,
    ChevronRight,
    BookOpen,
    Video,
    Calendar,
} from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors, Spacing, Shadows } from '../../theme';
import { useAuth } from '../auth/AuthContext';
import client from '../../api/client';
import Avatar from '../../components/Avatar';
import BannerCarousel from './BannerCarousel';


const { width } = Dimensions.get('window');

// Circular Progress Component
const CircularProgress = ({ size, strokeWidth, percentage, color }: any) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <Svg width={size} height={size}>
                {/* Background Circle */}
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="#E2E8F0"
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                {/* Progress Circle */}
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="none"
                    transform={`rotate(-90, ${size / 2}, ${size / 2})`}
                />
            </Svg>
            <View style={styles.percentageTextContainer}>
                <Text style={styles.percentageText}>{Math.round(percentage)}%</Text>
            </View>
        </View>
    );
};

export default function StudentDashboard({ navigation }: any) {
    const { user, refreshUser } = useAuth();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [data, setData] = useState({
        balance: 0,
        nextLesson: null as any,
        upcoming: [] as any[],
        dailyGoal: {
            current: 20,
            total: 30,
            streak: 5,
        }
    });

    // Update current time every minute for the timer
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const fetchData = useCallback(async () => {
        try {
            const [meRes, lessonsRes] = await Promise.all([
                client.get('/api/accounts/me/').catch(() => client.get('/api/me/')),
                client.get('/api/scheduling/my-lessons/').catch(() => client.get('/api/my-lessons/')),
            ]);

            const lessons = lessonsRes.data || [];
            const now = new Date();

            // Filter future or in-progress lessons
            // The API already filters for end_time__gte=now-grace, but let's be sure
            const sortedLessons = [...lessons].sort((a: any, b: any) =>
                new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
            );

            // Find next lesson: either currently happening or the closest future one
            const next = sortedLessons[0] || null;
            const upcoming = sortedLessons.slice(1, 10);

            setData(prev => ({
                ...prev,
                balance: meRes.data.student_profile?.available_credits ?? 0,
                nextLesson: next,
                upcoming: upcoming,
            }));
        } catch (error: any) {
            console.error('Fetch student dashboard failed:', error.config?.url, error.message);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const onRefresh = () => {
        setIsRefreshing(true);
        fetchData();
        refreshUser();
    };

    // Timer Logic for Next Lesson Badge
    const timerStats = useMemo(() => {
        if (!data.nextLesson) return null;

        const start = new Date(data.nextLesson.start_time);
        const diffMs = start.getTime() - currentTime.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);

        if (diffMins <= 0) return { label: 'In Progress', color: '#EF4444', bgColor: '#FEE2E2' };

        let label = '';
        if (diffHours >= 1) {
            label = `Starts in ${diffHours}h ${diffMins % 60}m`;
        } else {
            label = `Starts in ${diffMins}m`;
        }

        let color = '#10B981'; // Green (> 1h)
        let bgColor = '#D1FAE5';

        if (diffMins < 60) {
            color = '#F59E0B'; // Yellow (< 1h)
            bgColor = '#FEF3C7';
        }

        if (diffMins < 15) {
            color = '#EF4444'; // Red (< 15m)
            bgColor = '#FEE2E2';
        }

        return { label, color, bgColor };
    }, [data.nextLesson, currentTime]);

    if (isLoading && !isRefreshing) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    const firstName = user?.full_name?.split(' ')[0] || 'Student';
    const goalPercentage = (data.dailyGoal.current / data.dailyGoal.total) * 100;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
                }
            >
                {/* Hero Section: Header + Carousel (which now includes Balance) */}
                <View style={styles.heroSection}>
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.greetingTitle}>Good Morning,</Text>
                            <View style={styles.nameRow}>
                                <Text style={styles.userName}>{firstName}!</Text>
                                <Text style={styles.waveEmoji}>👋</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.notificationBtn}
                            onPress={() => navigation.navigate('Notifications')}
                        >
                            <Bell size={24} color={Colors.text} />
                            <View style={styles.notificationDot} />
                        </TouchableOpacity>
                    </View>

                    {/* Campaign Slider with Balance Card as first slide */}
                    <BannerCarousel
                        placement="student_home_top"
                        navigation={navigation}
                        headerSlide={
                            <View style={styles.balanceCardHero}>
                                <View>
                                    <Text style={styles.balanceLabel}>Current Balance</Text>
                                    <View style={styles.balanceRow}>
                                        <Text style={styles.balanceValue}>{data.balance || 0}</Text>
                                        <Text style={styles.balanceUnit}>Credits</Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={styles.topUpBtn}
                                    onPress={() => navigation.navigate('BuyCredits')}
                                >
                                    <Text style={styles.topUpText}>Top Up</Text>
                                </TouchableOpacity>
                            </View>
                        }
                    />
                </View>






                {/* Next Lesson */}
                <View style={styles.sectionHeaderLine}>
                    <Text style={styles.sectionHeading}>Next Lesson</Text>
                    {timerStats && (
                        <View style={[styles.timerBadge, { backgroundColor: timerStats.bgColor }]}>
                            <Text style={[styles.timerText, { color: timerStats.color }]}>{timerStats.label}</Text>
                        </View>
                    )}
                </View>

                {data.nextLesson ? (
                    <View style={styles.nextLessonCard}>
                        <View style={styles.lessonTop}>
                            <Avatar
                                url={data.nextLesson.teacher_profile_picture_url}
                                name={data.nextLesson.teacher_name}
                                size={64}
                                style={styles.lessonAvatar}
                            />
                            <View style={styles.lessonMainInfo}>
                                <Text style={styles.courseTitle} numberOfLines={1}>
                                    {data.nextLesson.teacher_name}'s Class
                                </Text>
                                <View style={styles.teacherRow}>
                                    <Calendar size={14} color="#94A3B8" />
                                    <Text style={styles.lessonDetails}>
                                        {new Date(data.nextLesson.start_time).toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' })}
                                    </Text>
                                    <View style={styles.dotSeparator} />
                                    <Clock size={14} color="#94A3B8" />
                                    <Text style={styles.lessonDetails}>
                                        {new Date(data.nextLesson.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.lessonActions}>
                            <TouchableOpacity style={styles.classBtn}>
                                <Video size={18} color={Colors.primary} />
                                <Text style={styles.classBtnText}>Class</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.joinBtn}
                                onPress={() => setShowJoinModal(true)}
                            >
                                <Text style={styles.joinBtnText}>Join Classroom</Text>
                                <ChevronRight size={18} color={Colors.white} />
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={styles.bookEmpty}
                        onPress={() => navigation.navigate('Teachers')}
                    >
                        <Calendar size={32} color={Colors.border} />
                        <Text style={styles.bookEmptyText}>No upcoming lessons</Text>
                        <Text style={styles.bookEmptyLink}>Book a class</Text>
                    </TouchableOpacity>
                )}

                {/* Daily Goal */}
                <View style={styles.sectionHeaderLine}>
                    <Text style={styles.sectionHeading}>Daily Goal</Text>
                    <View style={styles.streakBadge}>
                        <Flame size={14} color="#F59E0B" fill="#F59E0B" />
                        <Text style={styles.streakText}>{data.dailyGoal.streak} Day Streak</Text>
                    </View>
                </View>

                <View style={styles.goalCard}>
                    <CircularProgress
                        size={80}
                        strokeWidth={8}
                        percentage={goalPercentage}
                        color={Colors.primary}
                    />
                    <View style={styles.goalInfo}>
                        <Text style={styles.goalTitle}>Learning Time</Text>
                        <Text style={styles.goalProgressText}>
                            <Text style={styles.goalCurrent}>{data.dailyGoal.current}</Text>
                            <Text style={styles.goalTotal}>/{data.dailyGoal.total} min</Text>
                        </Text>
                        <Text style={styles.goalInspiration}>Keep it up! You're almost there.</Text>
                    </View>
                </View>

                {/* Upcoming */}
                <View style={styles.sectionHeaderLine}>
                    <Text style={styles.sectionHeading}>Upcoming</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Schedule')}>
                        <Text style={styles.seeAllText}>Schedule</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.upcomingHorizontal}>
                    {data.upcoming.length > 0 ? data.upcoming.map((lesson: any) => {
                        const date = new Date(lesson.start_time);
                        return (
                            <View
                                key={lesson.id}
                                style={styles.upcomingMiniCard}
                            >
                                <View style={styles.miniCardTop}>
                                    <Avatar
                                        url={lesson.teacher_profile_picture_url}
                                        name={lesson.teacher_name}
                                        size={40}
                                    />
                                    <View style={styles.miniTimeBox}>
                                        <Text style={styles.miniDay}>{date.toLocaleDateString([], { weekday: 'short' })}</Text>
                                        <Text style={styles.miniTime}>
                                            {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.miniDivider} />
                                <Text style={styles.miniTeacherName} numberOfLines={1}>{lesson.teacher_name}</Text>
                                <View style={styles.miniBadge}>
                                    <Text style={styles.miniBadgeText}>English Practice</Text>
                                </View>
                            </View>
                        );
                    }) : (
                        <View style={styles.miniCardEmpty}>
                            <Text style={styles.miniEmptyText}>No more today</Text>
                        </View>
                    )}
                </ScrollView>
            </ScrollView>

            <Modal
                visible={showJoinModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowJoinModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalIconContainer}>
                            <Video size={32} color={Colors.primary} />
                        </View>
                        <Text style={styles.modalTitle}>Launch Classroom?</Text>
                        <Text style={styles.modalSubtitle}>
                            Are you ready to join your session with {data.nextLesson?.teacher_name}?
                        </Text>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalBtnCancel]}
                                onPress={() => setShowJoinModal(false)}
                            >
                                <Text style={styles.modalBtnCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalBtnConfirm]}
                                onPress={() => {
                                    setShowJoinModal(false);
                                    navigation.navigate('Classroom', { sessionId: data.nextLesson.room_sid });
                                }}
                            >
                                <Text style={styles.modalBtnConfirmText}>Join Now</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    heroSection: {
        backgroundColor: Colors.white,
        paddingBottom: 12,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        ...Shadows.sm,
        marginBottom: 8,
    },


    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
    },
    greetingTitle: {
        fontSize: 16,
        color: '#64748B',
        fontWeight: '600',
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    userName: {
        fontSize: 24,
        fontWeight: '900',
        color: '#1E293B',
    },
    waveEmoji: {
        fontSize: 22,
    },
    notificationBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    notificationDot: {
        position: 'absolute',
        top: 14,
        right: 14,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#EF4444',
        borderWidth: 2,
        borderColor: '#F8FAFC',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 32,
        padding: 32,
        alignItems: 'center',
        ...Shadows.md,
    },
    modalIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: '#1E293B',
        marginBottom: 12,
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: 16,
        color: '#64748B',
        lineHeight: 24,
        textAlign: 'center',
        marginBottom: 32,
        paddingHorizontal: 8,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    modalBtn: {
        flex: 1,
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalBtnCancel: {
        backgroundColor: '#F1F5F9',
    },
    modalBtnConfirm: {
        backgroundColor: Colors.primary,
        ...Shadows.sm,
    },
    modalBtnCancelText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#64748B',
    },
    modalBtnConfirmText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    scrollContent: {
        paddingBottom: 40,
    },
    balanceCardHero: {
        flex: 1,
        backgroundColor: Colors.primary,
        borderRadius: 24,
        padding: 24,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        ...Shadows.sm,
    },


    balanceLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 4,
    },
    balanceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6,
    },
    balanceValue: {
        color: '#FFFFFF',
        fontSize: 36,
        fontWeight: '900',
    },
    balanceUnit: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 16,
        fontWeight: '700',
    },
    topUpBtn: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        gap: 6,
    },
    topUpText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
    sectionHeaderLine: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginTop: 32,
        marginBottom: 16,
    },
    sectionHeading: {
        fontSize: 20,
        fontWeight: '900',
        color: '#1E293B',
    },
    timerBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    timerText: {
        fontSize: 12,
        fontWeight: '800',
    },
    nextLessonCard: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 24,
        borderRadius: 28,
        padding: 24,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        ...Shadows.sm,
    },
    lessonTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 20,
    },
    lessonAvatar: {
        borderRadius: 20,
    },
    lessonMainInfo: {
        flex: 1,
    },
    courseTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1E293B',
        marginBottom: 4,
    },
    teacherRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    lessonDetails: {
        fontSize: 13,
        color: '#64748B',
        fontWeight: '600',
        marginLeft: 4,
    },
    dotSeparator: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#CBD5E1',
        marginHorizontal: 8,
    },
    lessonActions: {
        flexDirection: 'row',
        gap: 12,
    },
    classBtn: {
        paddingHorizontal: 20,
        height: 52,
        borderRadius: 14,
        backgroundColor: '#EEF2FF',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    classBtnText: {
        color: Colors.primary,
        fontSize: 15,
        fontWeight: '800',
    },
    joinBtn: {
        flex: 1,
        height: 52,
        borderRadius: 14,
        backgroundColor: '#2563EB',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        ...Shadows.sm,
    },
    joinBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
    },
    streakBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    streakText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#F59E0B',
    },
    goalCard: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 24,
        borderRadius: 28,
        padding: 24,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        ...Shadows.sm,
    },
    percentageTextContainer: {
        position: 'absolute',
    },
    percentageText: {
        fontSize: 14,
        fontWeight: '900',
        color: '#1E293B',
    },
    goalInfo: {
        flex: 1,
    },
    goalTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1E293B',
        marginBottom: 4,
    },
    goalProgressText: {
        marginBottom: 4,
    },
    goalCurrent: {
        fontSize: 16,
        fontWeight: '900',
        color: Colors.primary,
    },
    goalTotal: {
        fontSize: 16,
        fontWeight: '700',
        color: '#94A3B8',
    },
    goalInspiration: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '500',
    },
    seeAllText: {
        fontSize: 14,
        color: Colors.primary,
        fontWeight: '700',
    },
    upcomingHorizontal: {
        paddingLeft: 24,
        paddingRight: 12,
        gap: 16,
        paddingBottom: 10,
    },
    upcomingMiniCard: {
        width: 160,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        ...Shadows.sm,
    },
    miniCardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    miniTimeBox: {
        alignItems: 'flex-end',
    },
    miniDay: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.primary,
        textTransform: 'uppercase',
    },
    miniTime: {
        fontSize: 13,
        fontWeight: '800',
        color: '#1E293B',
    },
    miniDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginBottom: 12,
    },
    miniTeacherName: {
        fontSize: 14,
        fontWeight: '800',
        color: '#334155',
        marginBottom: 8,
    },
    miniBadge: {
        backgroundColor: '#F8FAFC',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    miniBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748B',
    },
    bookEmpty: {
        marginHorizontal: 24,
        padding: 32,
        borderRadius: 28,
        backgroundColor: '#F8FAFC',
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: '#E2E8F0',
        alignItems: 'center',
        gap: 8,
    },
    bookEmptyText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#94A3B8',
    },
    bookEmptyLink: {
        fontSize: 14,
        fontWeight: '800',
        color: Colors.primary,
    },
    miniCardEmpty: {
        paddingHorizontal: 20,
        justifyContent: 'center',
    },
    miniEmptyText: {
        color: '#94A3B8',
        fontWeight: '600',
    },
});
