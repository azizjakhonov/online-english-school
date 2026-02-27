import React, { useState, useEffect } from 'react';
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
    ArrowLeft,
    CheckCircle2,
    Clock,
    PlusCircle,
    Calendar,
    CreditCard,
    ChevronRight,
    PlayCircle,
    Info,
} from 'lucide-react-native';
import { Colors, Shadows } from '../../theme';
import client from '../../api/client';
import { useAuth } from '../auth/AuthContext';

const { width } = Dimensions.get('window');

export default function StudentHistoryScreen({ navigation }: any) {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'lessons' | 'payments'>('lessons');
    const [lessonHistory, setLessonHistory] = useState<any[]>([]);
    const [paymentHistory, setPaymentHistory] = useState<any[]>([]);

    const fetchData = async () => {
        try {
            const profileRes = await client.get('/api/accounts/student/profile/');
            setLessonHistory(profileRes.data.lesson_history || []);
            setPaymentHistory(profileRes.data.payment_history || []);
        } catch (error) {
            console.error('Failed to fetch history data', error);
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
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Activity History</Text>
                <View style={{ width: 44 }} />
            </View>

            {/* Tabs */}
            <View style={styles.tabContainer}>
                <View style={styles.tabsHeader}>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'lessons' && styles.activeTabButton]}
                        onPress={() => setActiveTab('lessons')}
                    >
                        <Text style={[styles.tabButtonText, activeTab === 'lessons' && styles.activeTabButtonText]}>Lessons</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'payments' && styles.activeTabButton]}
                        onPress={() => setActiveTab('payments')}
                    >
                        <Text style={[styles.tabButtonText, activeTab === 'payments' && styles.activeTabButtonText]}>Payments</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
                }
            >
                {activeTab === 'lessons' ? (
                    <View style={styles.historyList}>
                        {lessonHistory.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Calendar size={48} color="#CBD5E1" />
                                <Text style={styles.emptyTitle}>No lessons found</Text>
                                <Text style={styles.emptySubtitle}>Your completed lessons will appear here.</Text>
                            </View>
                        ) : (
                            lessonHistory.map((lesson, idx) => (
                                <TouchableOpacity key={lesson.lesson_id || idx} style={styles.historyCard} activeOpacity={0.7}>
                                    <View style={[styles.historyIconBox, { backgroundColor: lesson.status === 'COMPLETED' ? '#DCFCE7' : '#F8FAFC' }]}>
                                        {lesson.status === 'COMPLETED' ? (
                                            <CheckCircle2 size={22} color="#16A34A" />
                                        ) : (
                                            <Clock size={22} color="#64748B" />
                                        )}
                                    </View>
                                    <View style={styles.historyTextContainer}>
                                        <Text style={styles.historyTitle}>{lesson.teacher_name}</Text>
                                        <Text style={styles.historySub}>
                                            {new Date(lesson.start_time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} • {new Date(lesson.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                        <View style={styles.featureBadges}>
                                            <View style={styles.badge}>
                                                <PlayCircle size={12} color="#64748B" />
                                                <Text style={styles.badgeText}>Recording Available</Text>
                                            </View>
                                        </View>
                                    </View>
                                    <View style={styles.historySide}>
                                        <Text style={styles.historyAmount}>-1 Credit</Text>
                                        <ChevronRight size={18} color="#CBD5E1" />
                                    </View>
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                ) : (
                    <View style={styles.historyList}>
                        {paymentHistory.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <CreditCard size={48} color="#CBD5E1" />
                                <Text style={styles.emptyTitle}>No payments found</Text>
                                <Text style={styles.emptySubtitle}>Your credit purchases will appear here.</Text>
                            </View>
                        ) : (
                            paymentHistory.map((payment, idx) => (
                                <View key={payment.payment_id || idx} style={styles.historyCard}>
                                    <View style={[styles.historyIconBox, { backgroundColor: '#EFF6FF' }]}>
                                        <PlusCircle size={22} color={Colors.primary} />
                                    </View>
                                    <View style={styles.historyTextContainer}>
                                        <Text style={styles.historyTitle}>Credits Purchased</Text>
                                        <Text style={styles.historySub}>
                                            {new Date(payment.date).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                                        </Text>
                                        <Text style={styles.paymentMethod}>via {payment.provider}</Text>
                                    </View>
                                    <View style={styles.historySide}>
                                        <Text style={[styles.historyAmount, { color: '#16A34A' }]}>+{payment.credits_added}</Text>
                                        <View style={[styles.statusTag, { backgroundColor: payment.status === 'succeeded' ? '#DCFCE7' : '#F1F5F9' }]}>
                                            <Text style={[styles.statusTagText, { color: payment.status === 'succeeded' ? '#16A34A' : '#64748B' }]}>
                                                {payment.status}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                )}
            </ScrollView>
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
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#1E293B',
    },
    tabContainer: {
        paddingHorizontal: 24,
        marginTop: 16,
        marginBottom: 8,
    },
    tabsHeader: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 4,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 12,
    },
    activeTabButton: {
        backgroundColor: '#FFFFFF',
        ...Shadows.sm,
    },
    tabButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#94A3B8',
    },
    activeTabButtonText: {
        color: Colors.primary,
    },
    scrollContent: {
        paddingBottom: 40,
        paddingHorizontal: 24,
    },
    historyList: {
        marginTop: 16,
        gap: 16,
    },
    historyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        ...Shadows.sm,
    },
    historyIconBox: {
        width: 48,
        height: 48,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    historyTextContainer: {
        flex: 1,
    },
    historyTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1E293B',
        marginBottom: 4,
    },
    historySub: {
        fontSize: 13,
        color: '#94A3B8',
        fontWeight: '600',
    },
    featureBadges: {
        flexDirection: 'row',
        marginTop: 8,
        gap: 8,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748B',
    },
    paymentMethod: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '500',
        marginTop: 4,
        fontStyle: 'italic',
    },
    historySide: {
        alignItems: 'flex-end',
        gap: 8,
    },
    historyAmount: {
        fontSize: 16,
        fontWeight: '900',
        color: '#EF4444',
    },
    statusTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusTagText: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 80,
        gap: 16,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#1E293B',
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#94A3B8',
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 40,
    },
});
