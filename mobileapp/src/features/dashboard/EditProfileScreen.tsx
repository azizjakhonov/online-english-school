import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, User, BookOpen, Target, CheckCircle2 } from 'lucide-react-native';
import { Colors, Shadows } from '../../theme';
import client from '../../api/client';
import { useAuth } from '../auth/AuthContext';

const LEVELS = [
    { label: 'A1 – Beginner', value: 'A1' },
    { label: 'A2 – Elementary', value: 'A2' },
    { label: 'B1 – Intermediate', value: 'B1' },
    { label: 'B2 – Upper Intermediate', value: 'B2' },
    { label: 'C1 – Advanced', value: 'C1' },
    { label: 'C2 – Proficiency', value: 'C2' },
];

export default function EditProfileScreen({ navigation }: any) {
    const { user, refreshUser } = useAuth();

    const [fullName, setFullName] = useState(user?.full_name || '');
    const [level, setLevel] = useState(user?.student_profile?.level || '');
    const [goals, setGoals] = useState(user?.student_profile?.goals || '');
    const [isLoading, setIsLoading] = useState(false);

    const handleSave = async () => {
        if (!fullName.trim()) {
            Alert.alert('Error', 'Full Name is required.');
            return;
        }

        setIsLoading(true);
        try {
            await client.patch('/api/me/', {
                full_name: fullName.trim(),
                level: level,
                goals: goals.trim(),
            });
            await refreshUser();
            Alert.alert('Success', 'Profile updated successfully!', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            console.error('Update profile error:', error);
            Alert.alert('Error', 'Failed to update profile. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
                    <ArrowLeft size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Profile</Text>
                <View style={{ width: 44 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.section}>
                        <View style={styles.inputGroup}>
                            <View style={styles.labelRow}>
                                <User size={16} color="#64748B" />
                                <Text style={styles.label}>Full Name</Text>
                            </View>
                            <TextInput
                                style={styles.input}
                                value={fullName}
                                onChangeText={setFullName}
                                placeholder="Your full name"
                                placeholderTextColor="#94A3B8"
                            />
                        </View>

                        {user?.role === 'STUDENT' && (
                            <>
                                <View style={styles.inputGroup}>
                                    <View style={styles.labelRow}>
                                        <BookOpen size={16} color="#64748B" />
                                        <Text style={styles.label}>English Level</Text>
                                    </View>
                                    <View style={styles.levelContainer}>
                                        {LEVELS.map((item) => (
                                            <TouchableOpacity
                                                key={item.value}
                                                style={[
                                                    styles.levelChip,
                                                    level === item.value && styles.activeLevelChip
                                                ]}
                                                onPress={() => setLevel(item.value)}
                                            >
                                                <Text style={[
                                                    styles.levelChipText,
                                                    level === item.value && styles.activeLevelChipText
                                                ]}>
                                                    {item.value}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                    <Text style={styles.levelHint}>
                                        {LEVELS.find(l => l.label.includes(level))?.label || LEVELS.find(l => l.value === level)?.label || 'Select your current level'}
                                    </Text>
                                </View>

                                <View style={styles.inputGroup}>
                                    <View style={styles.labelRow}>
                                        <Target size={16} color="#64748B" />
                                        <Text style={styles.label}>Learning Goals</Text>
                                    </View>
                                    <TextInput
                                        style={[styles.input, styles.textArea]}
                                        value={goals}
                                        onChangeText={setGoals}
                                        placeholder="What do you want to achieve?"
                                        placeholderTextColor="#94A3B8"
                                        multiline
                                        numberOfLines={4}
                                    />
                                </View>
                            </>
                        )}
                    </View>

                    <TouchableOpacity
                        style={[styles.saveButton, isLoading && styles.disabledButton]}
                        onPress={handleSave}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                            <>
                                <CheckCircle2 size={20} color="#FFFFFF" />
                                <Text style={styles.saveButtonText}>Save Changes</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
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
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1E293B',
    },
    scrollContent: {
        padding: 24,
    },
    section: {
        gap: 24,
        marginBottom: 32,
    },
    inputGroup: {
        gap: 8,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 4,
    },
    label: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    input: {
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    textArea: {
        height: 120,
        textAlignVertical: 'top',
        paddingTop: 14,
    },
    levelContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 4,
    },
    levelChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    activeLevelChip: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    levelChipText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#64748B',
    },
    activeLevelChipText: {
        color: '#FFFFFF',
    },
    levelHint: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '600',
        marginTop: 4,
        paddingLeft: 4,
    },
    saveButton: {
        backgroundColor: Colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        gap: 8,
        ...Shadows.md,
    },
    disabledButton: {
        opacity: 0.7,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
    },
});
