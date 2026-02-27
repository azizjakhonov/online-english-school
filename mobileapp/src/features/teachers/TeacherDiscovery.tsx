import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    RefreshControl,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Search,
    SlidersHorizontal,
    Star,
    CheckCircle2,
    ChevronDown,
    X,
    ArrowLeft,
    ChevronRight,
    Filter
} from 'lucide-react-native';
import { Colors, Spacing, Shadows } from '../../theme';
import client from '../../api/client';
import Avatar from '../../components/Avatar';

const { width } = Dimensions.get('window');

export default function TeacherDiscovery({ navigation }: any) {
    const [search, setSearch] = useState('');
    const [teachers, setTeachers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchTeachers = async () => {
        try {
            const response = await client.get('/api/teachers/');
            setTeachers(response.data);
        } catch (error) {
            console.error('Fetch teachers failed:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchTeachers();
    }, []);

    const onRefresh = () => {
        setIsRefreshing(true);
        fetchTeachers();
    };

    const filteredTeachers = teachers.filter((t: any) =>
        t.user.full_name.toLowerCase().includes(search.toLowerCase()) ||
        (t.headline && t.headline.toLowerCase().includes(search.toLowerCase()))
    );

    const renderTeacher = ({ item }: any) => (
        <TouchableOpacity
            style={styles.card}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('TeacherProfile', { teacher: item })}
        >
            <View style={styles.cardContent}>
                <View style={styles.avatarWrapper}>
                    <Avatar
                        url={item.user?.profile_picture_url}
                        name={item.user?.full_name}
                        size={72}
                        style={styles.avatar}
                    />
                    <View style={styles.flagIcon}>
                        <Text style={{ fontSize: 10 }}>🇬🇧</Text>
                    </View>
                </View>

                <View style={styles.details}>
                    <View style={styles.nameRow}>
                        <Text style={styles.name} numberOfLines={1}>{item.user?.full_name}</Text>
                        <CheckCircle2 size={16} color={Colors.primary} fill={Colors.primary + '10'} />
                    </View>

                    <Text style={styles.specialty} numberOfLines={1}>
                        {item.headline || 'General English Coach'}
                    </Text>

                    <View style={styles.ratingRow}>
                        <Star size={14} color="#F59E0B" fill="#F59E0B" />
                        <Text style={styles.ratingText}>{item.rating || '4.9'}</Text>
                        <Text style={styles.reviewCount}>({item.lessons_taught || 0} lessons)</Text>
                    </View>
                </View>
            </View>

            <View style={styles.cardAction}>
                <View style={styles.placeholder} />
                <TouchableOpacity
                    style={styles.viewProfileBtn}
                    onPress={() => navigation.navigate('TeacherProfile', { teacher: item })}
                >
                    <Text style={styles.viewProfileBtnText}>View Profile</Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Find Teachers</Text>
                <TouchableOpacity style={styles.filterMenuBtn}>
                    <SlidersHorizontal size={22} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            <View style={styles.searchSection}>
                <View style={styles.searchBar}>
                    <Search size={20} color="#94A3B8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by name or language..."
                        value={search}
                        onChangeText={setSearch}
                        placeholderTextColor="#94A3B8"
                    />
                </View>
            </View>

            <View style={styles.filtersContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
                    <TouchableOpacity style={styles.filterChip}>
                        <Text style={styles.filterChipText}>Price</Text>
                        <ChevronDown size={14} color="#64748B" />
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.filterChip, styles.activeFilterChip]}>
                        <Text style={styles.activeFilterChipText}>Native Speaker</Text>
                        <X size={14} color={Colors.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.filterChip}>
                        <Text style={styles.filterChipText}>Level</Text>
                        <ChevronDown size={14} color="#64748B" />
                    </TouchableOpacity>
                </ScrollView>
            </View>

            <View style={styles.resultsSummary}>
                <Text style={styles.resultsCount}>{filteredTeachers.length} teachers found</Text>
                <TouchableOpacity style={styles.sortBtn}>
                    <Text style={styles.sortText}>Sort by: Recommended</Text>
                    <Filter size={14} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            {isLoading && !isRefreshing ? (
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={filteredTeachers}
                    renderItem={renderTeacher}
                    keyExtractor={(item: any) => item.id.toString()}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Search size={48} color="#CBD5E1" />
                            <Text style={styles.emptyTitle}>No teachers found</Text>
                            <Text style={styles.emptyText}>Try searching for a different language or teacher name.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    backBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#1E293B',
    },
    filterMenuBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    searchSection: {
        paddingHorizontal: 24,
        paddingVertical: 8,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 54,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    searchInput: {
        flex: 1,
        marginLeft: 12,
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
    },
    filtersContainer: {
        marginTop: 8,
    },
    filtersScroll: {
        paddingHorizontal: 24,
        gap: 10,
        paddingBottom: 4,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 8,
    },
    activeFilterChip: {
        backgroundColor: '#EFF6FF',
        borderColor: Colors.primary,
    },
    filterChipText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#64748B',
    },
    activeFilterChipText: {
        color: Colors.primary,
    },
    resultsSummary: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginTop: 24,
        marginBottom: 16,
    },
    resultsCount: {
        fontSize: 13,
        fontWeight: '700',
        color: '#94A3B8',
    },
    sortBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    sortText: {
        fontSize: 13,
        fontWeight: '800',
        color: Colors.primary,
    },
    list: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        ...Shadows.md,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarWrapper: {
        position: 'relative',
    },
    avatar: {
        borderRadius: 36,
    },
    flagIcon: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        ...Shadows.sm,
    },
    details: {
        flex: 1,
        marginLeft: 20,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    name: {
        fontSize: 18,
        fontWeight: '900',
        color: '#1E293B',
    },
    specialty: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.primary,
        marginBottom: 6,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    ratingText: {
        fontSize: 13,
        fontWeight: '900',
        color: '#1E293B',
    },
    reviewCount: {
        fontSize: 12,
        fontWeight: '600',
        color: '#94A3B8',
    },
    cardAction: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 16,
    },
    placeholder: {
        flex: 1,
    },
    viewProfileBtn: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 16,
        ...Shadows.sm,
    },
    viewProfileBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    empty: {
        padding: 64,
        alignItems: 'center',
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#1E293B',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#94A3B8',
        textAlign: 'center',
        lineHeight: 20,
    },
});
