import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeft,
    TrendingUp,
    BadgeDollarSign,
    Wallet,
    Calendar,
    CheckCircle2,
    Clock,
} from 'lucide-react-native';
import { Colors, Spacing, Shadows } from '../../theme';
import client from '../../api/client';

export default function TeacherEarningsScreen({ navigation }: any) {
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [summary, setSummary] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);

    const fetchData = async () => {
        try {
            const [summaryRes, historyRes] = await Promise.all([
                client.get('/api/accounts/earnings/summary/'),
                client.get('/api/accounts/earnings/history/'),
            ]);
            setSummary(summaryRes.data);
            setHistory(historyRes.data);
        } catch (error) {
            console.error('Fetch earnings failed:', error);
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

    const formatUZS = (val: number) => {
        return val?.toLocaleString('uz-UZ') + ' UZS';
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
                <Text style={styles.headerTitle}>Earnings</Text>
                <View style={{ width: 48 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
                }
            >
                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    <View style={styles.statLine}>
                        <View style={styles.statCard}>
                            <View style={[styles.iconBox, { backgroundColor: '#F0F7FF' }]}>
                                <BadgeDollarSign size={20} color={Colors.primary} />
                            </View>
                            <Text style={styles.statLabel}>Per Lesson</Text>
                            <Text style={styles.statValue}>{(summary?.rate_per_lesson_uzs / 1000).toFixed(0)}K</Text>
                        </View>
                        <View style={styles.statCard}>
                            <View style={[styles.iconBox, { backgroundColor: '#F0FDF4' }]}>
                                <TrendingUp size={20} color="#16A34A" />
                            </View>
                            <Text style={styles.statLabel}>This Period</Text>
                            <Text style={styles.statValue}>{(summary?.current_period_earned_uzs / 1000).toFixed(0)}K</Text>
                        </View>
                    </View>

                    <View style={styles.statLine}>
                        <View style={styles.statCard}>
                            <View style={[styles.iconBox, { backgroundColor: '#FFFBEB' }]}>
                                <Wallet size={20} color="#D97706" />
                            </View>
                            <Text style={styles.statLabel}>Awaiting</Text>
                            <Text style={styles.statValue}>{(summary?.awaiting_payout_uzs / 1000).toFixed(0)}K</Text>
                        </View>
                        <View style={styles.statCard}>
                            <View style={[styles.iconBox, { backgroundColor: '#F5F3FF' }]}>
                                <Calendar size={20} color="#7C3AED" />
                            </View>
                            <Text style={styles.statLabel}>Next Payout</Text>
                            <Text style={styles.statValue}>
                                {Math.max(0, Math.ceil((new Date(summary?.next_payout_date).getTime() - Date.now()) / 86400000))}d
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Total Paid Card */}
                <View style={styles.totalPaidCard}>
                    <View>
                        <Text style={styles.totalPaidLabel}>Total Paid Out (All Time)</Text>
                        <Text style={styles.totalPaidValue}>{formatUZS(summary?.total_paid_uzs)}</Text>
                    </View>
                    <CheckCircle2 size={32} color="#16A34A" />
                </View>

                {/* History List */}
                <View style={styles.historySection}>
                    <Text style={styles.sectionTitle}>Event History</Text>
                    {history.length > 0 ? (
                        history.map((event: any) => (
                            <View key={event.id} style={styles.historyItem}>
                                <View style={styles.eventInfo}>
                                    <View style={[styles.eventTypeBadge, { backgroundColor: event.amount_uzs >= 0 ? '#DCFCE7' : '#FEE2E2' }]}>
                                        <Text style={[styles.eventTypeText, { color: event.amount_uzs >= 0 ? '#166534' : '#991B1B' }]}>
                                            {event.event_label}
                                        </Text>
                                    </View>
                                    <Text style={styles.eventDate}>
                                        {new Date(event.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                    </Text>
                                </View>
                                <View style={styles.eventDetails}>
                                    <Text style={styles.eventReason} numberOfLines={1}>{event.reason}</Text>
                                    <Text style={[styles.eventAmount, { color: event.amount_uzs >= 0 ? '#16A34A' : '#DC2626' }]}>
                                        {event.amount_uzs >= 0 ? '+' : ''}{formatUZS(event.amount_uzs)}
                                    </Text>
                                </View>
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Clock size={40} color={Colors.border} />
                            <Text style={styles.emptyText}>No history records found</Text>
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

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
        paddingBottom: Spacing.md,
        backgroundColor: Colors.white,
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
    scrollContent: {
        padding: Spacing.lg,
        paddingBottom: Spacing.xxl,
    },
    statsGrid: {
        gap: 12,
        marginBottom: 20,
    },
    statLine: {
        flexDirection: 'row',
        gap: 12,
    },
    statCard: {
        flex: 1,
        backgroundColor: Colors.white,
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Shadows.sm,
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    statLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '900',
        color: Colors.text,
        marginTop: 4,
    },
    totalPaidCard: {
        backgroundColor: Colors.white,
        borderRadius: 24,
        padding: 24,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 32,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Shadows.sm,
    },
    totalPaidLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.textSecondary,
    },
    totalPaidValue: {
        fontSize: 22,
        fontWeight: '900',
        color: Colors.text,
        marginTop: 4,
    },
    historySection: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: Colors.text,
        marginBottom: 16,
    },
    historyItem: {
        backgroundColor: Colors.white,
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    eventInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    eventTypeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    eventTypeText: {
        fontSize: 11,
        fontWeight: '800',
    },
    eventDate: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    eventDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    eventReason: {
        flex: 1,
        fontSize: 14,
        fontWeight: '700',
        color: Colors.text,
        marginRight: 10,
    },
    eventAmount: {
        fontSize: 16,
        fontWeight: '900',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 14,
        color: Colors.textSecondary,
        fontWeight: '600',
    },
});
