import React, { useState, useEffect } from 'react';
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
    Settings,
    Camera,
    ShieldCheck,
    Briefcase,
    Star,
    Wallet,
    Globe,
    Bell,
    LogOut,
    ChevronRight,
    History,
    CreditCard,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Shadows } from '../../theme';
import { useAuth } from '../auth/AuthContext';
import client from '../../api/client';
import Avatar from '../../components/Avatar';

const { width } = Dimensions.get('window');

export default function TeacherProfileScreen({ navigation }: any) {
    const { user, refreshUser, logout } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [stats, setStats] = useState({
        completedCount: 0,
        averageRating: 4.9,
        totalEarnings: 0
    });

    const fetchData = async () => {
        if (user?.role !== 'TEACHER') {
            setIsLoading(false);
            return;
        }
        try {
            const [historyRes, earningsRes] = await Promise.all([
                client.get('/api/scheduling/teacher/lesson-history/').catch(() => ({ data: [] })),
                client.get('/api/accounts/earnings/summary/').catch(() => ({ data: { total_earned_uzs: 0 } })),
            ]);

            setStats({
                completedCount: historyRes.data.filter((l: any) => l.status === 'COMPLETED').length,
                averageRating: 4.9, // This would ideally come from the profile API
                totalEarnings: earningsRes.data.total_earned_uzs || 0
            });
        } catch (error) {
            console.error('Failed to fetch teacher profile stats', error);
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

    const formatUZS = (val: number) => {
        if (!val) return '0';
        return val.toLocaleString() + ' UZS';
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
                <View style={{ width: 44 }} />
                <Text style={styles.headerTitle}>Profile</Text>
                <TouchableOpacity
                    style={styles.settingsButton}
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
                    <Text style={styles.name}>{user?.full_name}</Text>
                    <View style={styles.roleBadge}>
                        <ShieldCheck size={14} color={Colors.primary} />
                        <Text style={styles.roleText}>Certified Teacher</Text>
                    </View>
                </View>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <View style={[styles.statIconBox, { backgroundColor: '#EEF2FF' }]}>
                            <Briefcase size={20} color={Colors.primary} />
                        </View>
                        <Text style={styles.statValue}>{stats.completedCount}</Text>
                        <Text style={styles.statLabel}>Lessons</Text>
                    </View>

                    <View style={styles.statCard}>
                        <View style={[styles.statIconBox, { backgroundColor: '#FEFCE8' }]}>
                            <Star size={20} color="#EAB308" fill="#EAB308" />
                        </View>
                        <Text style={styles.statValue}>{stats.averageRating}</Text>
                        <Text style={styles.statLabel}>Rating</Text>
                    </View>

                    <View style={styles.statCard}>
                        <View style={[styles.statIconBox, { backgroundColor: '#ECFDF5' }]}>
                            <Wallet size={20} color="#10B981" />
                        </View>
                        <Text style={styles.statValue}>Varies</Text>
                        <Text style={styles.statLabel}>Level</Text>
                    </View>
                </View>

                {/* Earnings Section */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Earnings Summary</Text>
                    <TouchableOpacity
                        style={styles.earningsCard}
                        onPress={() => navigation.navigate('Earnings')}
                    >
                        <View style={styles.earningsInfo}>
                            <Text style={styles.earningsLabel}>Total Earned</Text>
                            <Text style={styles.earningsValue}>{formatUZS(stats.totalEarnings)}</Text>
                        </View>
                        <View style={styles.earningsAction}>
                            <Text style={styles.viewDetailsText}>Details</Text>
                            <ChevronRight size={16} color={Colors.primary} />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Menu Section */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Account Settings</Text>
                    <View style={styles.menuGroup}>
                        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Schedule')}>
                            <View style={[styles.menuIconBox, { backgroundColor: '#F0F9FF' }]}>
                                <History size={20} color="#0EA5E9" />
                            </View>
                            <View style={styles.menuTextContainer}>
                                <Text style={styles.menuItemTitle}>My Schedule</Text>
                                <Text style={styles.menuItemSub}>Manage your availability</Text>
                            </View>
                            <ChevronRight size={20} color="#CBD5E1" />
                        </TouchableOpacity>

                        <View style={styles.divider} />

                        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Students')}>
                            <View style={[styles.menuIconBox, { backgroundColor: '#F5F3FF' }]}>
                                <History size={20} color="#8B5CF6" />
                            </View>
                            <View style={styles.menuTextContainer}>
                                <Text style={styles.menuItemTitle}>Lesson History</Text>
                                <Text style={styles.menuItemSub}>Completed classes</Text>
                            </View>
                            <ChevronRight size={20} color="#CBD5E1" />
                        </TouchableOpacity>

                        <View style={styles.divider} />

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
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1E293B',
    },
    settingsButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
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
    roleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    roleText: {
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
        fontSize: 18,
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
    earningsCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        ...Shadows.sm,
    },
    earningsInfo: {
        gap: 4,
    },
    earningsLabel: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '700',
    },
    earningsValue: {
        fontSize: 20,
        fontWeight: '900',
        color: '#1E293B',
    },
    earningsAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    viewDetailsText: {
        fontSize: 13,
        color: Colors.primary,
        fontWeight: '700',
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
