import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Alert,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Phone,
    ArrowLeft,
    PlusCircle,
    BookOpen,
    Camera,
    ChevronRight,
    Trophy,
    Flame,
    ShieldCheck,
    Settings,
    CreditCard,
    Globe,
    Bell,
    LogOut,
    History,
    Calendar,
    CheckCircle2,
    Clock,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Shadows } from '../../theme';
import { useAuth } from '../auth/AuthContext';
import client from '../../api/client';
import Avatar from '../../components/Avatar';

const { width } = Dimensions.get('window');

export default function StudentProfileScreen({ navigation }: any) {
    const { user, refreshUser, logout } = useAuth();

    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'lessons' | 'payments'>('lessons');

    const [profileData, setProfileData] = useState<any>(null);

    const fetchData = async () => {
        if (user?.role !== 'STUDENT') {
            setIsLoading(false);
            return;
        }
        try {
            const profileRes = await client.get('/api/accounts/student/profile/');
            setProfileData(profileRes.data);
        } catch (error) {
            console.error('Failed to fetch profile data', error);
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
        refreshUser();
    };

    const handleAvatarChange = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'We need access to your photos to change your avatar.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            const localUri = result.assets[0].uri;
            const filename = localUri.split('/').pop() || 'profile.jpg';
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : 'image/jpeg';

            const formData = new FormData();
            formData.append('avatar', { uri: localUri, name: filename, type } as any);

            setIsLoading(true);
            try {
                await client.patch('/api/accounts/avatar/', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                await refreshUser();
            } catch (err) {
                console.error('Avatar upload failed', err);
                Alert.alert('Upload Failed', 'Could not update profile picture.');
            } finally {
                setIsLoading(false);
            }
        }
    };

    if (isLoading && !isRefreshing) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    const availableCredits = user?.student_profile?.available_credits ?? user?.student_profile?.lesson_credits ?? 0;
    const userLevel = user?.student_profile?.level || 'Intermediate';
    const completedCount = profileData?.stats?.completed_lessons || 0;

    // Count unlocked badges based on the same milestones as Web
    const milestones = [1, 5, 10, 20, 50];
    const unlockedBadges = milestones.filter(m => completedCount >= m).length;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
                    <ArrowLeft size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile</Text>
                <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => navigation.navigate('EditProfile')}
                >
                    <Settings size={24} color="#1E293B" />
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
                }
            >
                {/* Avatar Section */}
                <View style={styles.avatarSection}>
                    <View style={styles.avatarContainer}>
                        <Avatar
                            url={user?.profile_picture_url}
                            name={user?.full_name}
                            size={110}
                            style={styles.avatarBorder}
                        />
                        <TouchableOpacity style={styles.editPencilContainer} onPress={handleAvatarChange}>
                            <View style={styles.editPencil}>
                                <Camera size={16} color={Colors.white} />
                            </View>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.name}>{user?.full_name || 'Student Name'}</Text>

                    <View style={styles.levelBadge}>
                        <ShieldCheck size={14} color={Colors.primary} fill={Colors.primary + '20'} />
                        <Text style={styles.levelText}>{userLevel}</Text>
                    </View>
                </View>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <View style={[styles.statIconBox, { backgroundColor: '#EEF2FF' }]}>
                            <BookOpen size={20} color={Colors.primary} />
                        </View>
                        <Text style={styles.statValue}>{completedCount}</Text>
                        <Text style={styles.statLabel}>Lessons</Text>
                    </View>

                    <View style={styles.statCard}>
                        <View style={[styles.statIconBox, { backgroundColor: '#FFF7ED' }]}>
                            <Flame size={20} color="#F97316" />
                        </View>
                        <Text style={styles.statValue}>0</Text>
                        <Text style={styles.statLabel}>Day Streak</Text>
                    </View>

                    <View style={styles.statCard}>
                        <View style={[styles.statIconBox, { backgroundColor: '#FEFCE8' }]}>
                            <Trophy size={20} color="#EAB308" />
                        </View>
                        <Text style={styles.statValue}>{unlockedBadges}</Text>
                        <Text style={styles.statLabel}>Badges</Text>
                    </View>
                </View>

                {/* Billing & Credits Section */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Billing & Credits</Text>
                    <View style={styles.billingCard}>
                        <View style={styles.billingHeader}>
                            <View>
                                <Text style={styles.billingLabel}>Current Balance</Text>
                                <Text style={styles.billingValue}>{availableCredits} Credits</Text>
                            </View>
                            <View style={styles.billingIconBox}>
                                <CreditCard size={24} color={Colors.primary} />
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.topUpButton}
                            onPress={() => navigation.navigate('BuyCredits')}
                        >
                            <PlusCircle size={20} color={Colors.white} />
                            <Text style={styles.topUpText}>Top Up Credits</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Menu Section */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Account & Activity</Text>
                    <View style={styles.menuGroup}>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => navigation.navigate('StudentHistory')}
                        >
                            <View style={[styles.menuIconBox, { backgroundColor: '#F0F9FF' }]}>
                                <History size={20} color="#0EA5E9" />
                            </View>
                            <View style={styles.menuTextContainer}>
                                <Text style={styles.menuItemTitle}>Activity History</Text>
                                <Text style={styles.menuItemSub}>Lessons & payment logs</Text>
                            </View>
                            <ChevronRight size={20} color="#CBD5E1" />
                        </TouchableOpacity>

                        <View style={styles.divider} />

                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => navigation.navigate('Leaderboard')}
                        >
                            <View style={[styles.menuIconBox, { backgroundColor: '#F5F3FF' }]}>
                                <ShieldCheck size={20} color="#8B5CF6" />
                            </View>
                            <View style={styles.menuTextContainer}>
                                <Text style={styles.menuItemTitle}>Achievements</Text>
                                <Text style={styles.menuItemSub}>Badges & certificates</Text>
                            </View>
                            <ChevronRight size={20} color="#CBD5E1" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* General Section */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>General</Text>
                    <View style={styles.menuGroup}>
                        <TouchableOpacity style={styles.menuItem}>
                            <View style={[styles.menuIconBox, { backgroundColor: '#F8FAFC' }]}>
                                <Globe size={20} color="#64748B" />
                            </View>
                            <View style={styles.menuTextContainer}>
                                <Text style={styles.menuItemTitle}>Language</Text>
                                <Text style={styles.menuItemSub}>English (US)</Text>
                            </View>
                            <ChevronRight size={20} color="#CBD5E1" />
                        </TouchableOpacity>

                        <View style={styles.divider} />

                        <TouchableOpacity style={styles.menuItem}>
                            <View style={[styles.menuIconBox, { backgroundColor: '#F8FAFC' }]}>
                                <Bell size={20} color="#64748B" />
                            </View>
                            <View style={styles.menuTextContainer}>
                                <Text style={styles.menuItemTitle}>Notifications</Text>
                                <Text style={styles.menuItemSub}>On</Text>
                            </View>
                            <ChevronRight size={20} color="#CBD5E1" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Log Out */}
                <TouchableOpacity style={styles.logoutButton} onPress={logout}>
                    <LogOut size={20} color="#EF4444" />
                    <Text style={styles.logoutText}>Log Out</Text>
                </TouchableOpacity>

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
    scrollContent: {
        paddingBottom: 40,
        paddingHorizontal: 24,
    },
    avatarSection: {
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 32,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 16,
    },
    avatarBorder: {
        borderWidth: 4,
        borderColor: '#FFFFFF',
        ...Shadows.md,
    },
    editPencilContainer: {
        position: 'absolute',
        bottom: 5,
        right: 5,
    },
    editPencil: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#FFFFFF',
    },
    name: {
        fontSize: 24,
        fontWeight: '900',
        color: '#1E293B',
        marginBottom: 8,
    },
    levelBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    levelText: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.primary,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 32,
    },
    statCard: {
        width: (width - 48 - 32) / 3,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 16,
        alignItems: 'center',
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
    statValue: {
        fontSize: 20,
        fontWeight: '900',
        color: '#1E293B',
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '700',
    },
    sectionContainer: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#1E293B',
        marginBottom: 16,
    },
    tabsHeader: {
        flexDirection: 'row',
        marginBottom: 16,
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 4,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 10,
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
    historyList: {
        gap: 12,
    },
    historyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        ...Shadows.sm,
    },
    historyIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    historyTextContainer: {
        flex: 1,
    },
    historyTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#1E293B',
        marginBottom: 2,
    },
    historySub: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '600',
    },
    historySide: {
        alignItems: 'flex-end',
    },
    historyAmount: {
        fontSize: 14,
        fontWeight: '900',
        color: '#EF4444',
        marginBottom: 2,
    },
    historyStatus: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 32,
        gap: 12,
    },
    emptyText: {
        fontSize: 14,
        color: '#94A3B8',
        fontWeight: '600',
    },
    menuGroup: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        overflow: 'hidden',
        ...Shadows.sm,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    menuIconBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    menuTextContainer: {
        flex: 1,
    },
    menuItemTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1E293B',
        marginBottom: 2,
    },
    menuItemSub: {
        fontSize: 13,
        color: '#94A3B8',
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginHorizontal: 16,
    },
    billingCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        ...Shadows.sm,
    },
    billingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    billingLabel: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '700',
        marginBottom: 4,
    },
    billingValue: {
        fontSize: 28,
        fontWeight: '900',
        color: '#1E293B',
    },
    billingIconBox: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    topUpButton: {
        backgroundColor: Colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
        gap: 8,
        ...Shadows.sm,
    },
    topUpText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
    },
    showMoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 8,
    },
    showMoreText: {
        fontSize: 14,
        fontWeight: '800',
        color: Colors.primary,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 20,
        marginTop: 12,
    },
    logoutText: {
        color: '#EF4444',
        fontSize: 16,
        fontWeight: '800',
    },
});
