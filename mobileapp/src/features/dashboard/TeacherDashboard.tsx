import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Calendar,
    Users,
    TrendingUp,
    Clock,
    ChevronRight,
    ArrowUpRight,
    DollarSign,
    Briefcase,
    History,
    CheckCircle2,
    Bell,
    Star,
    LayoutGrid,
    ChevronLeft,
} from 'lucide-react-native';
import { Colors, Spacing, Shadows } from '../../theme';
import { useAuth } from '../auth/AuthContext';
import client from '../../api/client';
import Avatar from '../../components/Avatar';
import BannerCarousel from './BannerCarousel';


const { width } = Dimensions.get('window');

// Helper to format remaining time
const getRemainingTime = (startTime: Date) => {
    const now = new Date();
    const diff = startTime.getTime() - now.getTime();
    if (diff <= 0) return null;

    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "< 1m";
    if (minutes < 60) return `${minutes}m`;

    const hours = Math.floor(minutes / 60);
    const remMins = minutes % 60;
    return `${hours}h ${remMins}m`;
};

export default function TeacherDashboard({ navigation }: any) {
    const { user, refreshUser } = useAuth();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [data, setData] = useState({
        summary: {
            awaiting_payout_uzs: 0,
            rate_per_lesson_uzs: 0,
            total_earned_uzs: 0,
        },
        lessons: [] as any[],
        completedCount: 0,
        uniqueStudents: 0,
        todayTotal: 0,
        todayDone: 0,
    });

    // Update timer every minute
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const fetchData = useCallback(async () => {
        try {
            // Updated endpoints to be more specific (avoiding 404s)
            const [userRes, lessonsRes, earningsRes, historyRes] = await Promise.all([
                client.get('/api/accounts/me/').catch(() => client.get('/api/me/')),
                client.get('/api/scheduling/my-lessons/').catch(() => client.get('/api/my-lessons/')),
                client.get('/api/accounts/earnings/summary/').catch(() => ({ data: {} })),
                client.get('/api/scheduling/teacher/lesson-history/').catch(() => client.get('/api/teacher/lesson-history/')).catch(() => ({ data: [] })),
            ]);

            const lessons = lessonsRes.data || [];
            const history = historyRes.data || [];

            // For teacher view, unique students from history and upcoming
            const studentIds = new Set();
            lessons.forEach((l: any) => l.student_id && studentIds.add(l.student_id));
            history.forEach((l: any) => l.student_id && studentIds.add(l.student_id));

            const now = new Date();
            const todayStr = now.toDateString();

            const todayLessons = lessons.filter((l: any) => new Date(l.start_time).toDateString() === todayStr);
            const todayHistory = history.filter((l: any) => new Date(l.start_time).toDateString() === todayStr && l.status === 'COMPLETED');

            const completedCount = history.filter((l: any) => l.status === 'COMPLETED').length;

            setData({
                summary: earningsRes.data || { awaiting_payout_uzs: 0, rate_per_lesson_uzs: 0 },
                lessons: lessons,
                completedCount,
                uniqueStudents: studentIds.size,
                todayTotal: todayLessons.length + todayHistory.length,
                todayDone: todayHistory.length,
            });
        } catch (error: any) {
            console.error('Fetch teacher dashboard failed:', error.config?.url, error.message);
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

    const formatUZS = (val: number) => {
        if (!val) return '0';
        if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
        if (val >= 1000) return (val / 1000).toFixed(0) + 'K';
        return val.toString();
    };

    if (isLoading && !isRefreshing) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    const firstName = user?.full_name?.split(' ')[0] || 'Teacher';
    const progress = data.todayTotal > 0 ? (data.todayDone / data.todayTotal) * 100 : 0;
    const remaining = data.todayTotal - data.todayDone;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
                }
            >
                {/* Hero Section: Header + Carousel (which now includes Progress) */}
                <View style={styles.heroSection}>
                    <View style={styles.header}>
                        <View style={styles.userInfo}>
                            <Avatar
                                url={user?.profile_picture_url}
                                name={user?.full_name}
                                size={52}
                                style={styles.avatarBorder}
                            />
                            <View style={styles.userText}>
                                <Text style={styles.greetingText}>Good Morning,</Text>
                                <Text style={styles.userNameText}>{user?.full_name}</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.notificationBtn}
                            onPress={() => navigation.navigate('Notifications')}
                        >
                            <Bell size={24} color={Colors.text} />
                            <View style={styles.dot} />
                        </TouchableOpacity>
                    </View>

                    {/* Campaign Slider with Progress Card as first slide */}
                    <BannerCarousel
                        placement="teacher_home_top"
                        navigation={navigation}
                        headerSlide={
                            <View style={styles.progressCardHero}>
                                <Text style={styles.progressLabel}>Daily Progress</Text>
                                <View style={styles.progressInfo}>
                                    <View>
                                        <Text style={styles.progressValue}>
                                            <Text style={styles.bold}>{data.todayDone} of {data.todayTotal}</Text>
                                        </Text>
                                        <Text style={[styles.remainingText, { textAlign: 'left' }]}>classes done</Text>
                                    </View>
                                    <View style={styles.percentageBadge}>
                                        <Text style={styles.percentageText}>{Math.round(progress)}%</Text>
                                    </View>
                                </View>

                                <View style={styles.progressBarBg}>
                                    <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                                </View>
                                <Text style={styles.remainingText}>{remaining} classes remaining</Text>
                            </View>
                        }
                    />
                </View>




                {/* Stats */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsHorizontal}>
                    <View style={styles.smallStatCard}>
                        <View style={[styles.statIconBox, { backgroundColor: '#F0F7FF' }]}>
                            <Briefcase size={22} color={Colors.primary} />
                        </View>
                        <Text style={styles.smallStatLabel}>Total Lessons</Text>
                        <Text style={styles.smallStatValue}>{data.completedCount.toLocaleString()}</Text>
                    </View>

                    <View style={styles.smallStatCard}>
                        <View style={[styles.statIconBox, { backgroundColor: '#ECFDF5' }]}>
                            <DollarSign size={22} color="#10B981" />
                        </View>
                        <Text style={styles.smallStatLabel}>Next Payout</Text>
                        <Text style={styles.smallStatValue}>{formatUZS(data.summary.awaiting_payout_uzs)}</Text>
                    </View>

                    <View style={styles.smallStatCard}>
                        <View style={[styles.statIconBox, { backgroundColor: '#FFFBEB' }]}>
                            <Star size={22} color="#F59E0B" fill="#F59E0B" />
                        </View>
                        <Text style={styles.smallStatLabel}>Avg Rating</Text>
                        <Text style={styles.smallStatValue}>4.9</Text>
                    </View>
                </ScrollView>

                {/* Upcoming Classes */}
                <View style={styles.classesSection}>
                    <View style={styles.sectionHeaderLine}>
                        <Text style={styles.sectionHeading}>Upcoming Classes</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Schedule')}>
                            <Text style={styles.viewLink}>View Calendar</Text>
                        </TouchableOpacity>
                    </View>

                    {data.lessons.length > 0 ? (
                        data.lessons.slice(0, 5).map((lesson: any) => {
                            const startTime = new Date(lesson.start_time);
                            const now = new Date();

                            const diffMins = (startTime.getTime() - now.getTime()) / 60000;
                            const isStartingSoon = diffMins > 0 && diffMins <= 15;
                            const remainingText = getRemainingTime(startTime);

                            return (
                                <View key={lesson.id} style={styles.classCard}>
                                    <View style={styles.classCardContent}>
                                        <View style={styles.studentDetails}>
                                            <View style={styles.avatarWrapper}>
                                                <Avatar url={lesson.student_profile_picture_url} name={lesson.student_name} size={56} />
                                                <View style={styles.flagEmoji}><Text style={{ fontSize: 10 }}>🇺🇿</Text></View>
                                            </View>
                                            <View style={styles.classInfo}>
                                                <Text style={styles.studentName} numberOfLines={1}>{lesson.student_name || 'Student'}</Text>
                                                <View style={styles.badgeRow}>
                                                    <View style={styles.levelBadge}>
                                                        <Text style={styles.levelText}>B2 Intermediate</Text>
                                                    </View>
                                                </View>
                                                <Text style={styles.dateInfoText}>
                                                    {startTime.toLocaleDateString([], { month: 'short', day: 'numeric' })} • {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={styles.timeInfo}>
                                            {isStartingSoon && remainingText ? (
                                                <View style={styles.timerBadge}>
                                                    <Clock size={12} color="#FFFFFF" />
                                                    <Text style={styles.timerText}>{remainingText}</Text>
                                                </View>
                                            ) : (
                                                <View style={styles.statusBadge}>
                                                    <Text style={styles.statusBadgeText}>CONFIRMED</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>

                                </View>
                            );
                        })
                    ) : (
                        <View style={styles.emptyState}>
                            <View style={styles.emptyIcon}>
                                <Clock size={32} color={Colors.border} />
                            </View>
                            <Text style={styles.emptyTitle}>All caught up!</Text>
                            <Text style={styles.emptySubtitle}>No classes scheduled for the moment.</Text>
                        </View>
                    )}
                </View>
            </ScrollView >
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
        paddingVertical: 12,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatarBorder: {
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    userText: {
        flexShrink: 1,
    },
    greetingText: {
        fontSize: 14,
        color: '#94A3B8',
        fontWeight: '600',
    },
    userNameText: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1E293B',
    },
    notificationBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    dot: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#EF4444',
        borderWidth: 2,
        borderColor: '#F8FAFC',
    },
    scrollContent: {
        paddingBottom: 40,
    },
    progressCardHero: {
        flex: 1,
        backgroundColor: Colors.primary,
        borderRadius: 24,
        padding: 24,
        ...Shadows.sm,
    },


    progressLabel: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '600',
        marginBottom: 8,
    },
    progressInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    progressValue: {
        fontSize: 20,
        color: 'rgba(255,255,255,0.9)',
        fontWeight: '500',
    },
    bold: {
        fontWeight: '900',
        color: '#FFFFFF',
    },
    percentageBadge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    percentageText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
    },
    progressBarBg: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 3,
        marginBottom: 8,
    },
    progressBarFill: {
        height: 6,
        backgroundColor: '#FFFFFF',
        borderRadius: 3,
    },
    remainingText: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '600',
        textAlign: 'right',
    },
    statsHorizontal: {
        paddingLeft: 24,
        paddingRight: 12,
        marginTop: 24,
        gap: 12,
    },
    smallStatCard: {
        width: 130,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        ...Shadows.sm,
    },
    statIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    smallStatLabel: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '700',
        marginBottom: 2,
    },
    smallStatValue: {
        fontSize: 18,
        fontWeight: '900',
        color: '#1E293B',
    },
    classesSection: {
        marginTop: 32,
        paddingHorizontal: 24,
    },
    sectionHeaderLine: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionHeading: {
        fontSize: 20,
        fontWeight: '900',
        color: '#1E293B',
    },
    viewLink: {
        fontSize: 13,
        color: Colors.primary,
        fontWeight: '700',
    },
    classCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        ...Shadows.sm,
    },
    classCardContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    studentDetails: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    avatarWrapper: {
        position: 'relative',
    },
    flagEmoji: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#FFFFFF',
        width: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        ...Shadows.sm,
    },
    classInfo: {
        flex: 1,
        gap: 2,
    },
    studentName: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1E293B',
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    levelBadge: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    levelText: {
        color: '#64748B',
        fontSize: 10,
        fontWeight: '700',
    },
    dateInfoText: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '600',
    },
    timeInfo: {
        alignItems: 'flex-end',
        marginLeft: 8,
    },
    statusBadge: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusBadgeText: {
        fontSize: 9,
        fontWeight: '900',
        color: '#94A3B8',
    },
    timerBadge: {
        backgroundColor: '#EF4444',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        ...Shadows.sm,
    },
    timerText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '900',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
        backgroundColor: '#F8FAFC',
        borderRadius: 24,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: '#E2E8F0',
    },
    emptyIcon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: Colors.white,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        ...Shadows.sm,
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: Colors.text,
    },
    emptySubtitle: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontWeight: '500',
        marginTop: 2,
    },
    cardActions: {
        marginTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 16,
    },
    joinBtn: {
        backgroundColor: '#2563EB',
        flexDirection: 'row',
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadows.sm,
    },
    joinBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
    disabledBtn: {
        backgroundColor: '#CBD5E1',
    },
});
