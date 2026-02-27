import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Bell, BellOff } from 'lucide-react-native';
import { Colors, Spacing, Shadows } from '../../theme';

export default function NotificationsScreen({ navigation }: any) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]); // Empty for now

    const onRefresh = () => {
        setIsRefreshing(true);
        // Logic will be added later
        setTimeout(() => setIsRefreshing(false), 1000);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
                <View style={{ width: 44 }} /> {/* Spacing */}
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
                }
            >
                {notifications.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIconContainer}>
                            <BellOff size={48} color="#94A3B8" />
                        </View>
                        <Text style={styles.emptyTitle}>No notifications yet</Text>
                        <Text style={styles.emptySubtitle}>
                            We'll notify you when you have new lessons, homework, or messages.
                        </Text>
                    </View>
                ) : (
                    notifications.map((item, index) => (
                        <View key={index} style={styles.notificationCard}>
                            {/* Notification items will go here later */}
                        </View>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    backButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1E293B',
    },
    scrollContent: {
        flexGrow: 1,
        padding: 24,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 100,
    },
    emptyIconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#1E293B',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 32,
    },
    notificationCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        ...Shadows.sm,
    },
});
