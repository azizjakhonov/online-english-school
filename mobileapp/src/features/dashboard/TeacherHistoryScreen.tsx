import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeft,
    Clock,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Search,
    BookOpen,
    Filter,
} from 'lucide-react-native';
import { Colors, Spacing, Shadows } from '../../theme';
import client from '../../api/client';
import Avatar from '../../components/Avatar';

const STATUS_CONFIG: any = {
    COMPLETED: { label: 'Completed', color: '#16A34A', bg: '#DCFCE7', icon: CheckCircle2 },
    STUDENT_ABSENT: { label: 'Absent', color: '#D97706', bg: '#FFFBEB', icon: AlertCircle },
    CANCELLED: { label: 'Cancelled', color: '#DC2626', bg: '#FEE2E2', icon: XCircle },
    PENDING: { label: 'Pending', color: '#2563EB', bg: '#DBEAFE', icon: Clock },
};

export default function TeacherHistoryScreen({ navigation }: any) {
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lessons, setLessons] = useState<any[]>([]);
    const [search, setSearch] = useState('');

    const fetchData = async () => {
        try {
            const res = await client.get('/api/scheduling/teacher/lesson-history/').catch(() => client.get('/api/teacher/lesson-history/'));
            setLessons(res.data);
        } catch (error) {
            console.error('Fetch history failed:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onRefresh = () => {
        setIsRefreshing(true);
        fetchData();
    };

    const filteredLessons = lessons.filter(l =>
        l.student_name.toLowerCase().includes(search.toLowerCase())
    );

    const stats = {
        total: lessons.length,
        completed: lessons.filter(l => l.status === 'COMPLETED').length,
        earned: lessons.reduce((sum, l) => sum + l.payout_amount_uzs, 0),
    };

    if (isLoading && !isRefreshing) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Lesson History</Text>
                <View style={{ width: 48 }} />
            </View>

            {/* Quick Stats */}
            <View style={styles.statsBar}>
                <View style={styles.miniStat}>
                    <Text style={styles.miniStatValue}>{stats.total}</Text>
                    <Text style={styles.miniStatLabel}>Total</Text>
                </View>
                <View style={styles.miniStat}>
                    <Text style={styles.miniStatValue}>{stats.completed}</Text>
                    <Text style={styles.miniStatLabel}>Done</Text>
                </View>
                <View style={[styles.miniStat, { borderRightWidth: 0 }]}>
                    <Text style={styles.miniStatValue}>{(stats.earned / 1000).toFixed(0)}K</Text>
                    <Text style={styles.miniStatLabel}>Earned</Text>
                </View>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchInputWrapper}>
                    <Search size={18} color={Colors.textSecondary} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search student name..."
                        value={search}
                        onChangeText={setSearch}
                        placeholderTextColor={Colors.textSecondary}
                    />
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
                }
            >
                {filteredLessons.length > 0 ? (
                    filteredLessons.map((lesson: any) => {
                        const status = STATUS_CONFIG[lesson.status] || { label: lesson.status, color: '#64748b', bg: '#f1f5f9', icon: Clock };
                        const StatusIcon = status.icon;

                        return (
                            <View key={lesson.lesson_id} style={styles.historyCard}>
                                <View style={styles.cardHeader}>
                                    <View style={styles.studentInfo}>
                                        <Avatar
                                            url={lesson.student_profile_picture_url}
                                            name={lesson.student_name}
                                            size={48}
                                        />
                                        <View style={styles.studentDetails}>
                                            <Text style={styles.studentName}>{lesson.student_name}</Text>
                                            <Text style={styles.lessonDate}>
                                                {new Date(lesson.start_time).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                                        <StatusIcon size={12} color={status.color} />
                                        <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                                    </View>
                                </View>

                                <View style={styles.cardFooter}>
                                    <View style={styles.footerInfo}>
                                        <Clock size={14} color={Colors.textSecondary} />
                                        <Text style={styles.footerText}>60 min</Text>
                                    </View>
                                    <View style={styles.footerInfo}>
                                        <BookOpen size={14} color={Colors.textSecondary} />
                                        <Text style={styles.footerText}>1 Credit</Text>
                                    </View>
                                    <Text style={styles.cardPrice}>
                                        {lesson.payout_amount_uzs > 0 ? `+${(lesson.payout_amount_uzs / 1000).toFixed(0)}K` : '—'}
                                    </Text>
                                </View>
                            </View>
                        );
                    })
                ) : (
                    <View style={styles.emptyState}>
                        <Clock size={48} color={Colors.border} />
                        <Text style={styles.emptyTitle}>No lessons found</Text>
                        <Text style={styles.emptySubtitle}>Try searching for a different name.</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.white,
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
        paddingBottom: Spacing.md,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: Colors.text,
    },
    backButton: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadows.sm,
    },
    statsBar: {
        flexDirection: 'row',
        backgroundColor: Colors.background,
        marginHorizontal: Spacing.lg,
        borderRadius: 20,
        paddingVertical: 12,
        marginBottom: 20,
    },
    miniStat: {
        flex: 1,
        alignItems: 'center',
        borderRightWidth: 1,
        borderRightColor: Colors.border,
    },
    miniStatValue: {
        fontSize: 18,
        fontWeight: '900',
        color: Colors.text,
    },
    miniStatLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.textSecondary,
        textTransform: 'uppercase',
    },
    searchContainer: {
        paddingHorizontal: Spacing.lg,
        marginBottom: 16,
    },
    searchInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.background,
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 52,
    },
    searchInput: {
        flex: 1,
        marginLeft: 12,
        fontSize: 15,
        fontWeight: '600',
        color: Colors.text,
    },
    scrollContent: {
        paddingBottom: Spacing.xxl,
        paddingHorizontal: Spacing.xl,
    },
    historyCard: {
        backgroundColor: Colors.white,
        borderRadius: 24,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Shadows.sm,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    studentInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    studentDetails: {
        marginLeft: 12,
    },
    studentName: {
        fontSize: 16,
        fontWeight: '800',
        color: Colors.text,
    },
    lessonDate: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontWeight: '600',
        marginTop: 2,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '800',
    },
    cardFooter: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    footerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    footerText: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontWeight: '700',
    },
    cardPrice: {
        marginLeft: 'auto',
        fontSize: 16,
        fontWeight: '900',
        color: '#166534',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: Colors.text,
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        fontWeight: '500',
        marginTop: 4,
    },
});
