import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GraduationCap, School, Check } from 'lucide-react-native';
import { Colors, Spacing, Shadows } from '../../theme';
import { useAuth } from './AuthContext';

export default function OnboardingScreen({ navigation }: any) {
    const { selectRole } = useAuth();
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState<'STUDENT' | 'TEACHER' | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleComplete = async () => {
        if (!fullName || !role) {
            Alert.alert('Error', 'Please enter your name and select a role.');
            return;
        }

        setIsLoading(true);
        try {
            await selectRole(role, fullName);
            // AuthContext updates user state, and RootNavigator will switch to the Main stack.
        } catch (error) {
            console.error('Onboarding failed:', error);
            Alert.alert('Error', 'Something went wrong. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.title}>Finish Setup</Text>
                    <Text style={styles.subtitle}>Tell us more about yourself</Text>
                </View>

                <View style={styles.form}>
                    <Text style={styles.label}>FULL NAME</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. John Doe"
                        value={fullName}
                        onChangeText={setFullName}
                        placeholderTextColor={Colors.textSecondary}
                    />

                    <Text style={[styles.label, { marginTop: 24 }]}>I AM A</Text>
                    <View style={styles.roleGrid}>
                        <TouchableOpacity
                            style={[styles.roleCard, role === 'STUDENT' && styles.roleCardActive]}
                            onPress={() => setRole('STUDENT')}
                        >
                            <View style={[styles.iconBox, role === 'STUDENT' && styles.iconBoxActive]}>
                                <GraduationCap size={32} color={role === 'STUDENT' ? Colors.white : Colors.primary} />
                            </View>
                            <Text style={[styles.roleLabel, role === 'STUDENT' && styles.roleLabelActive]}>STUDENT</Text>
                            {role === 'STUDENT' && (
                                <View style={styles.checkMark}>
                                    <Check size={12} color={Colors.white} strokeWidth={4} />
                                </View>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.roleCard, role === 'TEACHER' && styles.roleCardActive]}
                            onPress={() => setRole('TEACHER')}
                        >
                            <View style={[styles.iconBox, role === 'TEACHER' && styles.iconBoxActive]}>
                                <School size={32} color={role === 'TEACHER' ? Colors.white : Colors.primary} />
                            </View>
                            <Text style={[styles.roleLabel, role === 'TEACHER' && styles.roleLabelActive]}>TEACHER</Text>
                            {role === 'TEACHER' && (
                                <View style={styles.checkMark}>
                                    <Check size={12} color={Colors.white} strokeWidth={4} />
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[styles.button, (!fullName || !role) && styles.buttonDisabled]}
                        onPress={handleComplete}
                        disabled={isLoading || !fullName || !role}
                    >
                        {isLoading ? (
                            <ActivityIndicator color={Colors.white} />
                        ) : (
                            <Text style={styles.buttonText}>Complete Registration</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    content: {
        flex: 1,
        padding: Spacing.xl,
    },
    header: {
        marginBottom: 40,
        marginTop: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: '900',
        color: Colors.text,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    form: {
        flex: 1,
    },
    label: {
        fontSize: 12,
        fontWeight: '900',
        color: Colors.textSecondary,
        letterSpacing: 1.5,
        marginBottom: 12,
        marginLeft: 4,
    },
    input: {
        backgroundColor: Colors.white,
        height: 60,
        borderRadius: 16,
        paddingHorizontal: 20,
        fontSize: 16,
        fontWeight: '700',
        color: Colors.text,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Shadows.sm,
    },
    roleGrid: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 40,
    },
    roleCard: {
        flex: 1,
        backgroundColor: Colors.white,
        borderRadius: 24,
        paddingVertical: 24,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: Colors.border,
        ...Shadows.sm,
        position: 'relative',
    },
    roleCardActive: {
        borderColor: Colors.primary,
        backgroundColor: '#F0F7FF',
    },
    iconBox: {
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconBoxActive: {
        backgroundColor: Colors.primary,
    },
    roleLabel: {
        fontSize: 12,
        fontWeight: '900',
        color: Colors.textSecondary,
        letterSpacing: 1,
    },
    roleLabelActive: {
        color: Colors.primary,
    },
    checkMark: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    button: {
        backgroundColor: Colors.primary,
        height: 64,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadows.sm,
        marginTop: 'auto',
        marginBottom: 20,
    },
    buttonDisabled: {
        backgroundColor: Colors.border,
        shadowOpacity: 0,
    },
    buttonText: {
        color: Colors.white,
        fontSize: 18,
        fontWeight: '900',
    },
});
