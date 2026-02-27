import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    BookOpen,
    Clock,
    CheckCircle2,
    AlertCircle,
    ChevronRight,
    Search,
} from 'lucide-react-native';
import { Colors, Spacing, Shadows } from '../../theme';
import client from '../../api/client';

export default function HomeworkScreen({ navigation }: any) {
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [homeworks, setHomeworks] = useState<any[]>([]);

    const fetchData = async () => {
        try {
            const res = await client.get('/api/homework/student-assignments/');
            setHomeworks(res.data);
        } catch (error) {
            console.error('Fetch homework failed:', error);
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
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Homework</Text>
                <BookOpen size={24} color={Colors.primary} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
                }
            >
                {homeworks.length === 0 ? (
                    <View style={styles.emptyState}>
                        <BookOpen size={64} color={Colors.border} />
                        <Text style={styles.emptyTitle}>No homework assigned</Text>
                        <Text style={styles.emptySubtitle}>You're all caught up! Keep practicing on your own.</Text>
                    </View>
                ) : (
                    homeworks.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={styles.hwCard}
                            onPress={() => {
                                if (!item.is_completed) {
                                    navigation.navigate('HomeworkPlayer', { assignmentId: item.id });
                                }
                            }}
                        >
                            <View style={[styles.hwIconBox, item.is_completed ? styles.hwIconBoxSuccess : null]}>
                                {item.is_completed ? (
                                    <CheckCircle2 size={20} color={Colors.success} />
                                ) : (
                                    <Clock size={20} color={Colors.primary} />
                                )}
                            </View>
                            <View style={styles.hwContent}>
                                <Text style={styles.hwTitle}>{item.title}</Text>
                                <Text style={styles.hwDue}>
                                    From {item.teacher_name} • {item.is_completed ? 'Completed' : `Due: ${new Date(item.due_date).toLocaleDateString()}`}
                                </Text>
                            </View>
                            {item.is_completed ? (
                                <View style={styles.scoreBadge}>
                                    <Text style={styles.scoreText}>{item.percentage.toFixed(0)}%</Text>
                                </View>
                            ) : (
                                <ChevronRight size={18} color={Colors.border} />
                            )}
                        </TouchableOpacity>
                    ))
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: '#1E293B',
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    emptyState: {
        marginTop: 60,
        alignItems: 'center',
        padding: 40,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#1E293B',
        marginTop: 20,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 20,
    },
    hwCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        ...Shadows.sm,
    },
    hwIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#F0F7FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    hwContent: {
        flex: 1,
    },
    hwTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1E293B',
    },
    hwDue: {
        fontSize: 13,
        color: '#64748B',
        fontWeight: '600',
        marginTop: 2,
    },
    hwIconBoxSuccess: {
        backgroundColor: '#E6FFFA',
    },
    scoreBadge: {
        backgroundColor: '#F0F9FF',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 12,
    },
    scoreText: {
        fontSize: 16,
        fontWeight: '900',
        color: Colors.primary,
    },
});
