import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    RefreshControl,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeft,
    Plus,
    CheckCircle2,
    Calendar as CalendarIcon,
    Sun,
    CloudSun,
    Moon,
    ChevronLeft,
    ChevronRight,
    History,
} from 'lucide-react-native';
import { Colors, Shadows } from '../../theme';
import client from '../../api/client';
import { useAuth } from '../auth/AuthContext';

const { width } = Dimensions.get('window');

interface ScheduleEvent {
    lesson_id: number;
    teacher_name?: string;
    student_name?: string;
    start_time: string;
    end_time: string;
    status: string;
}

export default function TeacherScheduleScreen({ navigation }: any) {
    const { user: authUser } = useAuth();
    const isTeacher = authUser?.role === 'TEACHER';

    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [events, setEvents] = useState<ScheduleEvent[]>([]);
    const [selectedDate, setSelectedDate] = useState(new Date());

    const fetchData = async () => {
        try {
            // 1. Fetch upcoming/active lessons
            const lessonsRes = await client.get('/api/scheduling/my-lessons/').catch(() => ({ data: [] }));
            let allEvents: ScheduleEvent[] = (lessonsRes.data || []).map((e: any) => ({
                ...e,
                lesson_id: parseInt(e.lesson_id, 10),
            }));

            // 2. Fetch history depending on role
            if (isTeacher) {
                const historyRes = await client.get('/api/scheduling/teacher/lesson-history/').catch(() => ({ data: [] }));
                const historyEvents = (historyRes.data || []).map((h: any) => ({
                    ...h,
                    lesson_id: parseInt(h.lesson_id, 10),
                }));

                const existingIds = new Set(allEvents.map(e => e.lesson_id));
                historyEvents.forEach((h: any) => {
                    if (h.lesson_id && !existingIds.has(h.lesson_id)) {
                        allEvents.push(h);
                        existingIds.add(h.lesson_id);
                    }
                });
            } else {
                const profileRes = await client.get('/api/accounts/student/profile/').catch(() => ({ data: { lesson_history: [] } }));
                const historyEvents = (profileRes.data?.lesson_history || []).map((h: any) => ({
                    ...h,
                    lesson_id: parseInt(h.lesson_id, 10),
                }));

                const existingIds = new Set(allEvents.map(e => e.lesson_id));
                historyEvents.forEach((h: any) => {
                    if (h.lesson_id && !existingIds.has(h.lesson_id)) {
                        allEvents.push(h);
                        existingIds.add(h.lesson_id);
                    }
                });
            }

            setEvents(allEvents);

        } catch (error) {
            console.error('Fetch schedule events failed:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [isTeacher]);

    const onRefresh = () => {
        setIsRefreshing(true);
        fetchData();
    };

    // Filter events for the selected date
    const dailyEvents = useMemo(() => {
        return events.filter(e =>
            new Date(e.start_time).toDateString() === selectedDate.toDateString()
        ).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    }, [events, selectedDate]);

    // Grouping logic for the new layout
    const groupedSlots = useMemo(() => {
        const morning: ScheduleEvent[] = [];
        const afternoon: ScheduleEvent[] = [];
        const evening: ScheduleEvent[] = [];

        dailyEvents.forEach(event => {
            const hour = new Date(event.start_time).getHours();
            if (hour < 12) morning.push(event);
            else if (hour < 18) afternoon.push(event);
            else evening.push(event);
        });

        return { morning, afternoon, evening };
    }, [dailyEvents]);

    const formatMonthYear = (date: Date) => {
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    const renderSlot = (event: ScheduleEvent) => {
        const startTime = new Date(event.start_time);
        const timeStr = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isCompleted = event.status === 'COMPLETED';

        return (
            <TouchableOpacity
                key={event.lesson_id}
                style={[
                    styles.slotPill,
                    isCompleted ? styles.slotPillCompleted : styles.slotPillActive
                ]}

                onPress={() => isTeacher && isCompleted && Alert.alert('Lesson Completed', `This lesson with ${event.student_name} is finished.`)}
            >
                <Text style={[
                    styles.slotText,
                    isCompleted ? styles.slotTextCompleted : styles.slotTextActive
                ]}>
                    {timeStr}
                </Text>
                {!isCompleted && <View style={styles.activeDot} />}
                {isCompleted && <CheckCircle2 size={12} color="#94A3B8" style={{ marginLeft: 4 }} />}
            </TouchableOpacity>
        );
    };

    if (isLoading && !isRefreshing) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
                    <ArrowLeft size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{isTeacher ? 'My Schedule' : 'My Lessons'}</Text>
                <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => isTeacher && Alert.alert('Schedule Management', 'You can manage your history and payouts on the web dashboard.')}
                >
                    <History size={24} color="#1E293B" />
                </TouchableOpacity>
            </View>

            {/* Calendar Section */}
            <View style={styles.calendarContainer}>
                <View style={styles.calendarHeader}>
                    <Text style={styles.monthText}>{formatMonthYear(selectedDate)}</Text>
                    <View style={styles.calendarArrows}>
                        <TouchableOpacity style={styles.arrowBtn} onPress={() => {
                            const d = new Date(selectedDate);
                            d.setDate(d.getDate() - 7);
                            setSelectedDate(d);
                        }}>
                            <ChevronLeft size={20} color="#94A3B8" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.arrowBtn} onPress={() => {
                            const d = new Date(selectedDate);
                            d.setDate(d.getDate() + 7);
                            setSelectedDate(d);
                        }}>
                            <ChevronRight size={20} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.dateScroll}
                >
                    {[...Array(28)].map((_, i) => {
                        // Start calendar from 7 days ago to show history
                        const d = new Date();
                        d.setDate(d.getDate() - 7 + i);
                        const isActive = d.toDateString() === selectedDate.toDateString();
                        const isToday = d.toDateString() === new Date().toDateString();

                        return (
                            <TouchableOpacity
                                key={`date-${d.getTime()}`}
                                onPress={() => setSelectedDate(new Date(d))}
                                style={[
                                    styles.dateCard,
                                    isActive && styles.dateCardActive,
                                    isToday && !isActive && styles.dateCardToday
                                ]}
                            >
                                <Text style={[styles.weekdayText, isActive && styles.textWhite]}>
                                    {d.toLocaleDateString([], { weekday: 'short' })}
                                </Text>
                                <Text style={[styles.dayText, isActive && styles.textWhite]}>
                                    {d.getDate()}
                                </Text>
                                {isActive && <View style={styles.activeIndicator} />}
                            </TouchableOpacity>

                        );
                    })}
                </ScrollView>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
                }
            >
                {/* Time Sections */}
                {Object.entries(groupedSlots).map(([key, slots]) => {
                    if (slots.length === 0) return null;

                    const icons: any = {
                        morning: <Sun size={18} color="#F97316" />,
                        afternoon: <CloudSun size={18} color="#F59E0B" />,
                        evening: <Moon size={18} color="#6366F1" />
                    };

                    return (
                        <View key={key} style={styles.section}>
                            <View style={styles.sectionHeader}>
                                {icons[key]}
                                <Text style={styles.sectionTitle}>
                                    {key.charAt(0).toUpperCase() + key.slice(1)}
                                </Text>
                            </View>
                            <View style={styles.slotsGrid}>
                                {slots.map(renderSlot)}
                            </View>
                        </View>
                    );
                })}

                {/* Details Section */}
                <View style={styles.detailsContainer}>
                    <Text style={styles.detailsTitle}>Agenda for today</Text>
                    {dailyEvents.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <CalendarIcon size={48} color="#CBD5E1" />
                            <Text style={styles.emptyText}>No lessons scheduled for this day</Text>
                        </View>
                    ) : (
                        dailyEvents.map((event) => (
                            <View key={event.lesson_id} style={styles.agendaCard}>
                                <View style={styles.agendaTime}>
                                    <Text style={styles.agendaTimeText}>
                                        {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                    <View style={styles.timeDivider} />
                                </View>
                                <View style={styles.agendaContent}>
                                    <View style={styles.agendaHeader}>
                                        <Text style={styles.agendaUser}>
                                            {isTeacher ? event.student_name : event.teacher_name}
                                        </Text>
                                        <View style={[
                                            styles.statusBadge,
                                            {
                                                backgroundColor:
                                                    event.status === 'COMPLETED' ? '#DCFCE7' :
                                                        event.status === 'CANCELLED' ? '#FEE2E2' : '#EFF6FF'
                                            }
                                        ]}>
                                            <Text style={[
                                                styles.statusBadgeText,
                                                {
                                                    color:
                                                        event.status === 'COMPLETED' ? '#16A34A' :
                                                            event.status === 'CANCELLED' ? '#EF4444' : Colors.primary
                                                }
                                            ]}>
                                                {event.status}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={styles.agendaSub}>Individual English Lesson</Text>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>

            {/* Bottom Summary Bar */}
            <View style={styles.footer}>
                <View style={styles.footerInfo}>
                    <View style={styles.totalBox}>
                        <View style={styles.summaryIcon}>
                            <CheckCircle2 size={16} color="#F59E0B" />
                        </View>
                        <View>
                            <Text style={styles.summaryLabel}>Total Lessons</Text>
                            <Text style={styles.summaryValue}>{String(dailyEvents.length)} Sessions</Text>
                        </View>

                    </View>
                </View>
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => navigation.navigate('Dashboard')}
                >
                    <Text style={styles.actionButtonText}>Back to Dashboard</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1E293B',
    },
    calendarContainer: {
        paddingVertical: 16,
    },
    calendarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginBottom: 16,
    },
    monthText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#1E293B',
    },
    calendarArrows: {
        flexDirection: 'row',
        gap: 12,
    },
    arrowBtn: {
        padding: 4,
    },
    dateScroll: {
        paddingHorizontal: 24,
        gap: 12,
        paddingBottom: 4,
    },
    dateCard: {
        width: 62,
        height: 80,
        borderRadius: 16,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    dateCardToday: {
        borderColor: Colors.primary,
        backgroundColor: '#EFF6FF',
    },
    dateCardActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
        ...Shadows.md,
    },
    weekdayText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94A3B8',
        marginBottom: 4,
    },
    dayText: {
        fontSize: 18,
        fontWeight: '900',
        color: '#1E293B',
    },
    textWhite: {
        color: '#FFFFFF',
    },
    activeIndicator: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#FFFFFF',
        marginTop: 6,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 100,
    },
    section: {
        marginTop: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1E293B',
    },
    slotsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    slotPill: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
    },
    slotPillActive: {
        backgroundColor: '#EFF6FF',
        borderColor: Colors.primary,
    },
    slotPillCompleted: {
        backgroundColor: '#F1F5F9',
        borderColor: '#E2E8F0',
    },
    slotText: {
        fontSize: 14,
        fontWeight: '700',
    },
    slotTextActive: {
        color: Colors.primary,
    },
    slotTextCompleted: {
        color: '#94A3B8',
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: Colors.primary,
    },
    detailsContainer: {
        marginTop: 32,
    },
    detailsTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#1E293B',
        marginBottom: 20,
    },
    agendaCard: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    agendaTime: {
        width: 65,
        alignItems: 'flex-start',
    },
    agendaTimeText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#94A3B8',
    },
    timeDivider: {
        width: 2,
        flex: 1,
        backgroundColor: '#F1F5F9',
        marginLeft: 4,
        marginTop: 8,
    },
    agendaContent: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    agendaHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    agendaUser: {
        fontSize: 15,
        fontWeight: '800',
        color: '#1E293B',
    },
    agendaSub: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '600',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 40,
        gap: 12,
    },
    emptyText: {
        color: '#94A3B8',
        fontWeight: '600',
        textAlign: 'center',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 24,
        paddingVertical: 20,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...Shadows.lg,
    },
    footerInfo: {
        flex: 1,
    },
    totalBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    summaryIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FEF3C7',
        justifyContent: 'center',
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '700',
    },
    summaryValue: {
        fontSize: 15,
        fontWeight: '900',
        color: '#1E293B',
    },
    actionButton: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 16,
        ...Shadows.md,
    },
    actionButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
    },
});
