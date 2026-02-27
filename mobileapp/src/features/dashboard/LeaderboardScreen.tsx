import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    StatusBar,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Trophy,
    Search,
    ChevronUp,
    Star,
    Crown,
    CheckCircle,
} from 'lucide-react-native';
import { Colors, Shadows } from '../../theme';
import Avatar from '../../components/Avatar';
import client from '../../api/client';
import { useAuth } from '../auth/AuthContext';

const { width } = Dimensions.get('window');

interface LeaderboardEntry {
    student_id: number;
    student_name: string;
    profile_picture: string | null;
    total_xp: number;
    tasks_done: number;
}

type Period = 'weekly' | 'monthly' | 'all_time';

export default function LeaderboardScreen() {
    const { user: currentUser } = useAuth();
    const [data, setData] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<Period>('weekly');

    const fetchLeaderboard = useCallback(async (selectedPeriod: Period) => {
        setLoading(true);
        try {
            const res = await client.get(`/api/homework/leaderboard/?period=${selectedPeriod}`);
            setData(res.data);
        } catch (err) {
            console.error("Leaderboard error:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLeaderboard(period);
    }, [period, fetchLeaderboard]);

    const topThree = data.slice(0, 3);
    const others = data.slice(3);
    const myEntry = data.find(e => e.student_id === currentUser?.id);
    const myRank = myEntry ? data.indexOf(myEntry) + 1 : null;

    if (loading && data.length === 0) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Leaderboard</Text>
                <TouchableOpacity style={styles.searchButton}>
                    <Search size={22} color="#94A3B8" strokeWidth={2.5} />
                </TouchableOpacity>
            </View>

            {/* Filter Tabs */}
            <View style={styles.tabContainer}>
                {(['weekly', 'monthly', 'all_time'] as Period[]).map((p) => (
                    <TouchableOpacity
                        key={p}
                        style={[styles.tab, period === p && styles.activeTab]}
                        onPress={() => setPeriod(p)}
                    >
                        <Text style={[styles.tabText, period === p && styles.activeTabText]}>
                            {p.charAt(0).toUpperCase() + p.slice(1).replace('_', ' ')}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Podium Section */}
                <View style={styles.podiumContainer}>
                    {/* 2nd Place */}
                    {topThree[1] && (
                        <View style={styles.podiumItem}>
                            <View style={styles.avatarContainer}>
                                <View style={[styles.avatarRing, { borderColor: '#E2E8F0' }]}>
                                    <Avatar
                                        url={topThree[1].profile_picture}
                                        name={topThree[1].student_name}
                                        size={72}
                                    />
                                </View>
                                <View style={[styles.rankBadge, { backgroundColor: '#CBD5E1' }]}>
                                    <Text style={styles.rankBadgeText}>2</Text>
                                </View>
                                <View style={styles.trophyBadge}>
                                    <Crown size={12} color="#94A3B8" fill="#94A3B8" />
                                </View>
                            </View>
                            <Text style={styles.podiumName} numberOfLines={1}>
                                {topThree[1].student_name.split(' ')[0]}
                            </Text>
                            <Text style={styles.podiumXP}>{topThree[1].total_xp.toLocaleString()} XP</Text>
                        </View>
                    )}

                    {/* 1st Place */}
                    {topThree[0] && (
                        <View style={[styles.podiumItem, { transform: [{ translateY: -15 }] }]}>
                            <View style={styles.avatarContainer}>
                                <View style={[styles.avatarRing, { borderColor: '#F59E0B', borderWidth: 3 }]}>
                                    <Avatar
                                        url={topThree[0].profile_picture}
                                        name={topThree[0].student_name}
                                        size={90}
                                    />
                                </View>
                                <View style={[styles.rankBadge, { backgroundColor: '#F59E0B', width: 28, height: 28, borderRadius: 14 }]}>
                                    <Text style={[styles.rankBadgeText, { fontSize: 13 }]}>1</Text>
                                </View>
                                <View style={[styles.trophyBadge, { width: 34, height: 34, borderRadius: 17 }]}>
                                    <Trophy size={18} color="#F59E0B" fill="#F59E0B" />
                                </View>
                            </View>
                            <Text style={[styles.podiumName, { fontSize: 16 }]} numberOfLines={1}>
                                {topThree[0].student_name.split(' ')[0]}
                            </Text>
                            <Text style={[styles.podiumXP, { color: Colors.primary }]}>
                                {topThree[0].total_xp.toLocaleString()} XP
                            </Text>
                        </View>
                    )}

                    {/* 3rd Place */}
                    {topThree[2] && (
                        <View style={styles.podiumItem}>
                            <View style={styles.avatarContainer}>
                                <View style={[styles.avatarRing, { borderColor: '#FFEDD5' }]}>
                                    <Avatar
                                        url={topThree[2].profile_picture}
                                        name={topThree[2].student_name}
                                        size={72}
                                    />
                                </View>
                                <View style={[styles.rankBadge, { backgroundColor: '#FDBA74' }]}>
                                    <Text style={styles.rankBadgeText}>3</Text>
                                </View>
                                <View style={styles.trophyBadge}>
                                    <Crown size={12} color="#FDBA74" fill="#FDBA74" />
                                </View>
                            </View>
                            <Text style={styles.podiumName} numberOfLines={1}>
                                {topThree[2].student_name.split(' ')[0]}
                            </Text>
                            <Text style={styles.podiumXP}>{topThree[2].total_xp.toLocaleString()} XP</Text>
                        </View>
                    )}
                </View>

                {/* Main Content Area */}
                <View style={styles.listSection}>
                    {/* Your Position */}
                    {myEntry && (
                        <View style={styles.meSection}>
                            <Text style={styles.sectionTitle}>YOUR POSITION</Text>
                            <View style={styles.meCard}>
                                <View style={styles.meRankContainer}>
                                    <Text style={styles.meRankText}>{myRank}</Text>
                                </View>
                                <Avatar
                                    url={myEntry.profile_picture}
                                    name={myEntry.student_name}
                                    size={50}
                                />
                                <View style={styles.meInfo}>
                                    <Text style={styles.meName}>{myEntry.student_name}</Text>
                                    <Text style={styles.meLabel}>Language Enthusiast</Text>
                                </View>
                                <View style={styles.mePointsContainer}>
                                    <Text style={styles.mePoints}>{myEntry.total_xp.toLocaleString()} XP</Text>
                                    <View style={styles.rankChange}>
                                        <ChevronUp size={14} color="#10B981" />
                                        <Text style={styles.rankChangeText}>2</Text>
                                    </View>
                                </View>
                                <View style={styles.youBadge}>
                                    <Text style={styles.youBadgeText}>YOU</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Top Learners List */}
                    <View style={styles.othersSection}>
                        <Text style={[styles.sectionTitle, { marginTop: 32, marginBottom: 16 }]}>TOP LEARNERS</Text>
                        {others.map((item, index) => (
                            <View key={item.student_id} style={styles.leaderRow}>
                                <Text style={styles.rowRank}>{index + 4}</Text>
                                <Avatar url={item.profile_picture} name={item.student_name} size={44} />
                                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 16 }}>
                                    <Text style={styles.rowName} numberOfLines={1}>{item.student_name}</Text>
                                    <CheckCircle size={12} color="#3B82F6" />
                                </View>
                                <Text style={styles.rowXP}>{item.total_xp.toLocaleString()} XP</Text>
                            </View>
                        ))}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    center: {
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
    headerTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: '#1E293B',
    },
    searchButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        marginHorizontal: 24,
        borderRadius: 25,
        padding: 6,
        marginVertical: 12,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 20,
    },
    activeTab: {
        backgroundColor: '#FFFFFF',
        ...Shadows.sm,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#94A3B8',
    },
    activeTabText: {
        color: Colors.primary,
        fontWeight: '800',
    },
    scrollContent: {
        paddingBottom: 40,
    },
    podiumContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 40,
        paddingBottom: 20,
    },
    podiumItem: {
        alignItems: 'center',
        width: width * 0.3,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 12,
    },
    avatarRing: {
        padding: 4,
        borderRadius: 100,
        borderWidth: 2,
    },
    rankBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    rankBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '900',
    },
    trophyBadge: {
        position: 'absolute',
        bottom: -6,
        left: '50%',
        marginLeft: -15,
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadows.sm,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    podiumName: {
        fontSize: 14,
        fontWeight: '800',
        color: '#1E293B',
        marginTop: 4,
    },
    podiumXP: {
        fontSize: 12,
        fontWeight: '800',
        color: '#64748B',
    },
    listSection: {
        paddingHorizontal: 24,
        marginTop: 20,
    },
    meSection: {
        marginBottom: 12,
    },
    othersSection: {
        // paddingVertical: 10,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: '#94A3B8',
        letterSpacing: 1.5,
        marginBottom: 12,
    },
    meCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F7FF',
        borderRadius: 30,
        padding: 16,
        borderWidth: 1.5,
        borderColor: '#DBEAFE',
        position: 'relative',
    },
    meRankContainer: {
        width: 40,
        alignItems: 'center',
    },
    meRankText: {
        fontSize: 20,
        fontWeight: '900',
        color: Colors.primary,
    },
    meInfo: {
        flex: 1,
        marginLeft: 12,
    },
    meName: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1E293B',
    },
    meLabel: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '600',
    },
    mePointsContainer: {
        alignItems: 'flex-end',
    },
    mePoints: {
        fontSize: 18,
        fontWeight: '900',
        color: Colors.primary,
    },
    rankChange: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rankChangeText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#10B981',
    },
    youBadge: {
        position: 'absolute',
        top: -1,
        right: 12,
        backgroundColor: Colors.primary,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    youBadgeText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '900',
    },
    leaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    rowRank: {
        width: 32,
        fontSize: 14,
        fontWeight: '800',
        color: '#CBD5E1',
        textAlign: 'center',
    },
    rowName: {
        flex: 1,
        marginLeft: 16,
        fontSize: 15,
        fontWeight: '700',
        color: '#334155',
    },
    rowXP: {
        fontSize: 16,
        fontWeight: '900',
        color: '#1E293B',
    },
});
