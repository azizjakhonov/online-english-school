import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Dimensions,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeft,
    Star,
    Clock,
    Globe,
    ShieldCheck,
    CreditCard,
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    X,
    Play,
} from 'lucide-react-native';
import { format, startOfWeek, addDays, addHours, isBefore, isSameDay } from 'date-fns';
import { Colors, Spacing, Shadows } from '../../theme';
import client from '../../api/client';
import Avatar from '../../components/Avatar';
import { useAuth } from '../auth/AuthContext';

const START_HOUR = 6;
const END_HOUR = 23;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR);

export default function TeacherProfile({ navigation, route }: any) {
    const { teacher: initialTeacher } = route.params;
    const { refreshUser } = useAuth();

    const [teacher, setTeacher] = useState(initialTeacher);
    const [availability, setAvailability] = useState<any[]>([]);
    const [bookedKeys, setBookedKeys] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [isBooking, setIsBooking] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Modal state
    const [confirmModal, setConfirmModal] = useState<any>(null);

    const fetchData = async () => {
        try {
            const [teacherRes, availRes, meRes, bookingRes] = await Promise.all([
                client.get(`/api/teachers/${initialTeacher.id}/`),
                client.get(`/api/availability/${initialTeacher.id}/`),
                client.get('/api/me/'),
                client.get(`/api/bookings/?teacher_id=${initialTeacher.id}`),
            ]);

            setTeacher(teacherRes.data);
            setAvailability(availRes.data);
            setCurrentUser(meRes.data);

            const takenSet = new Set<string>();
            if (Array.isArray(bookingRes.data)) {
                bookingRes.data.forEach((b: any) => {
                    if (b.status !== 'CANCELLED') {
                        const d = new Date(b.start_time);
                        takenSet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`);
                    }
                });
            }
            setBookedKeys(takenSet);
        } catch (error) {
            console.error('Fetch profile details failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
    const weekDays = useMemo(() => Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i)), [weekStart]);

    const handleSlotPress = (date: Date, hour: number) => {
        const slotStart = new Date(date);
        slotStart.setHours(hour, 0, 0, 0);
        const slotEnd = addHours(slotStart, 1);
        const key = `${slotStart.getFullYear()}-${slotStart.getMonth()}-${slotStart.getDate()}-${slotStart.getHours()}`;

        if (isBefore(slotStart, new Date())) {
            Alert.alert('Invalid Slot', 'You cannot book lessons in the past.');
            return;
        }

        if (bookedKeys.has(key)) {
            Alert.alert('Unavailable', 'This slot is already booked.');
            return;
        }

        const credits = currentUser?.student_profile?.available_credits ?? currentUser?.student_profile?.lesson_credits ?? 0;
        if (credits < 1) {
            Alert.alert('Out of Credits', 'You need at least 1 credit to book a lesson.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Top Up', onPress: () => navigation.navigate('BuyCredits') },
            ]);
            return;
        }

        setConfirmModal({ slotStart, slotEnd, key });
    };

    const performBooking = async () => {
        if (!confirmModal) return;
        setIsBooking(true);
        try {
            await client.post('/api/bookings/', {
                teacher_id: teacher.id,
                start_time: confirmModal.slotStart.toISOString(),
                end_time: confirmModal.slotEnd.toISOString(),
            });

            setBookedKeys(new Set(bookedKeys).add(confirmModal.key));
            await refreshUser();

            Alert.alert('Success!', 'Your lesson has been booked.', [
                { text: 'OK', onPress: () => setConfirmModal(null) }
            ]);
            fetchData(); // Refresh local data
        } catch (error: any) {
            console.error('Booking failed:', error);
            const msg = error.response?.data?.error || 'Booking failed. The slot might have been taken.';
            Alert.alert('Booking Failed', msg);
            setConfirmModal(null);
        } finally {
            setIsBooking(false);
        }
    };

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <View style={styles.headerRight}>
                    <View style={styles.creditBadge}>
                        <CreditCard size={14} color={Colors.primary} />
                        <Text style={styles.creditText}>
                            {currentUser?.student_profile?.available_credits ?? currentUser?.student_profile?.lesson_credits ?? 0} Credits
                        </Text>
                    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Profile Card */}
                <View style={styles.profileCard}>
                    <View style={styles.profileMain}>
                        <Avatar
                            url={teacher.user?.profile_picture_url}
                            name={teacher.user?.full_name}
                            size={100}
                            style={styles.profileAvatar}
                        />
                        <View style={styles.profileInfo}>
                            <Text style={styles.name}>{teacher.user?.full_name}</Text>
                            <Text style={styles.headline}>{teacher.headline || 'Professional Teacher'}</Text>
                            <View style={styles.ratingRow}>
                                <Star size={16} color="#FBBF24" fill="#FBBF24" />
                                <Text style={styles.ratingText}>{teacher.rating} Rating</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Clock size={16} color={Colors.textSecondary} />
                            <Text style={styles.statValue}>{teacher.lessons_taught}</Text>
                            <Text style={styles.statLabel}>Lessons</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Globe size={16} color={Colors.textSecondary} />
                            <Text style={styles.statValue}>English</Text>
                            <Text style={styles.statLabel}>Language</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <ShieldCheck size={16} color={Colors.textSecondary} />
                            <Text style={styles.statValue}>Verified</Text>
                            <Text style={styles.statLabel}>Status</Text>
                        </View>
                    </View>

                    <Text style={styles.sectionTitle}>About Me</Text>
                    <Text style={styles.bio}>{teacher.bio}</Text>
                </View>

                {/* Calendar */}
                <View style={styles.calendarSection}>
                    <View style={styles.calendarHeader}>
                        <Text style={styles.sectionTitle}>Availability</Text>
                        <View style={styles.calendarNav}>
                            <TouchableOpacity onPress={() => setCurrentDate(addDays(currentDate, -7))}>
                                <ChevronLeft size={24} color={Colors.text} />
                            </TouchableOpacity>
                            <Text style={styles.dateLabel}>{format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d')}</Text>
                            <TouchableOpacity onPress={() => setCurrentDate(addDays(currentDate, 7))}>
                                <ChevronRight size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View>
                            <View style={styles.weekHeader}>
                                <View style={styles.timeColHeader} />
                                {weekDays.map((day, i) => (
                                    <View key={i} style={styles.dayColHeader}>
                                        <Text style={styles.dayName}>{format(day, 'EEE')}</Text>
                                        <Text style={[styles.dayDate, isSameDay(day, new Date()) && styles.todayDate]}>
                                            {format(day, 'd')}
                                        </Text>
                                    </View>
                                ))}
                            </View>

                            <View style={styles.grid}>
                                {HOURS.map((hour) => (
                                    <View key={hour} style={styles.hourRow}>
                                        <View style={styles.timeLabel}>
                                            <Text style={styles.timeLabelText}>{hour}:00</Text>
                                        </View>
                                        {weekDays.map((day, i) => {
                                            const jsDay = day.getDay();
                                            const apiDay = jsDay === 0 ? 6 : jsDay - 1;
                                            const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}-${hour}`;
                                            const isPast = isBefore(addHours(day, hour), new Date());
                                            const isBooked = bookedKeys.has(key);

                                            const hasAvail = availability.some(rule => {
                                                if (rule.day_of_week !== apiDay) return false;
                                                const [sH] = rule.start_time.split(':').map(Number);
                                                const [eH] = rule.end_time.split(':').map(Number);
                                                return hour >= sH && hour < eH;
                                            });

                                            return (
                                                <TouchableOpacity
                                                    key={i}
                                                    style={[
                                                        styles.slot,
                                                        hasAvail && !isPast && !isBooked && styles.slotAvailable,
                                                        isBooked && styles.slotBooked,
                                                    ]}
                                                    disabled={!hasAvail || isPast || isBooked}
                                                    onPress={() => handleSlotPress(day, hour)}
                                                >
                                                    {isBooked && <Text style={styles.bookedText}>Taken</Text>}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                ))}
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </ScrollView>

            <Modal
                transparent
                visible={!!confirmModal}
                animationType="fade"
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Confirm Booking</Text>
                            <TouchableOpacity onPress={() => setConfirmModal(null)}>
                                <X size={24} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {confirmModal && (
                            <View style={styles.modalBody}>
                                <View style={styles.confirmRow}>
                                    <Clock size={20} color={Colors.primary} />
                                    <View>
                                        <Text style={styles.confirmLabel}>Date & Time</Text>
                                        <Text style={styles.confirmValue}>
                                            {format(confirmModal.slotStart, 'EEEE, MMM d')}{'\n'}
                                            {format(confirmModal.slotStart, 'h:mm a')} - {format(confirmModal.slotEnd, 'h:mm a')}
                                        </Text>
                                    </View>
                                </View>
                                <View style={[styles.confirmRow, { marginTop: 16 }]}>
                                    <CreditCard size={20} color={Colors.primary} />
                                    <View>
                                        <Text style={styles.confirmLabel}>Cost</Text>
                                        <Text style={styles.confirmValue}>1 Credit</Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        <TouchableOpacity
                            style={styles.bookBtn}
                            onPress={performBooking}
                            disabled={isBooking}
                        >
                            {isBooking ? (
                                <ActivityIndicator color={Colors.white} />
                            ) : (
                                <Text style={styles.bookBtnText}>Confirm Booking</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const { width } = Dimensions.get('window');
const COL_WIDTH = 70;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
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
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        backgroundColor: Colors.white,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    creditBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(37, 99, 235, 0.2)',
    },
    creditText: {
        fontSize: 12,
        fontWeight: '800',
        color: Colors.primary,
    },
    scrollContent: {
        paddingBottom: Spacing.xl,
    },
    profileCard: {
        backgroundColor: Colors.white,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        padding: Spacing.xl,
        ...Shadows.sm,
    },
    profileMain: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    profileAvatar: {
        borderRadius: 32,
        ...Shadows.sm,
    },
    profileInfo: {
        flex: 1,
        marginLeft: 16,
    },
    name: {
        fontSize: 24,
        fontWeight: '900',
        color: Colors.text,
    },
    headline: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.primary,
        marginTop: 2,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: 4,
    },
    ratingText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#92400E',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors.background,
        borderRadius: 20,
        padding: 16,
        marginBottom: 24,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
        gap: 4,
    },
    statValue: {
        fontSize: 15,
        fontWeight: '800',
        color: Colors.text,
    },
    statLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    statDivider: {
        width: 1,
        height: 24,
        backgroundColor: Colors.border,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: Colors.text,
        marginBottom: 12,
    },
    bio: {
        fontSize: 14,
        color: Colors.textSecondary,
        lineHeight: 22,
    },
    calendarSection: {
        marginTop: Spacing.xl,
        paddingHorizontal: Spacing.lg,
    },
    calendarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    calendarNav: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    dateLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.text,
    },
    weekHeader: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    timeColHeader: {
        width: 50,
    },
    dayColHeader: {
        width: COL_WIDTH,
        alignItems: 'center',
    },
    dayName: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.textSecondary,
        textTransform: 'uppercase',
    },
    dayDate: {
        fontSize: 16,
        fontWeight: '800',
        color: Colors.text,
        marginTop: 4,
    },
    todayDate: {
        color: Colors.primary,
    },
    grid: {
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderColor: Colors.border,
    },
    hourRow: {
        flexDirection: 'row',
    },
    timeLabel: {
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingRight: 8,
        backgroundColor: Colors.white,
        borderBottomWidth: 1,
        borderColor: Colors.border,
    },
    timeLabelText: {
        fontSize: 10,
        fontWeight: '700',
        color: Colors.textSecondary,
    },
    slot: {
        width: COL_WIDTH,
        height: 50,
        backgroundColor: Colors.white,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: Colors.border,
    },
    slotAvailable: {
        backgroundColor: 'rgba(37, 99, 235, 0.05)',
    },
    slotBooked: {
        backgroundColor: '#FEE2E2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    bookedText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#B91C1C',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: Colors.white,
        borderRadius: 24,
        padding: 24,
        ...Shadows.sm,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: Colors.text,
    },
    modalBody: {
        backgroundColor: Colors.background,
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
    },
    confirmRow: {
        flexDirection: 'row',
        gap: 12,
    },
    confirmLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.textSecondary,
        marginBottom: 2,
    },
    confirmValue: {
        fontSize: 14,
        fontWeight: '800',
        color: Colors.text,
        lineHeight: 20,
    },
    bookBtn: {
        backgroundColor: Colors.primary,
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadows.sm,
    },
    bookBtnText: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: '800',
    },
});
