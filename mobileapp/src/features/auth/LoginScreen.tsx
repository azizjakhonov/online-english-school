import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Phone, ChevronRight } from 'lucide-react-native';
import { Colors, Spacing, Shadows } from '../../theme';
import client from '../../api/client';

export default function LoginScreen({ navigation }: any) {
    const [phoneSuffix, setPhoneSuffix] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // ─── Phone OTP ─────────────────────────────────────────────────────────────
    const handleSendOtp = async () => {
        if (phoneSuffix.length !== 9) {
            setError('Please enter a valid 9-digit number');
            return;
        }

        const fullPhone = `+998${phoneSuffix}`;
        setIsLoading(true);
        setError('');
        try {
            await client.post('/api/accounts/send-otp/', { phone: fullPhone });
            navigation.navigate('Otp', { phone: fullPhone });
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to send OTP. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.content}
            >
                <View style={styles.branding}>
                    <View style={styles.logoBox}>
                        <View style={styles.logoInner} />
                    </View>
                    <Text style={styles.brandName}>OnlineSchool</Text>
                </View>

                <View style={styles.header}>
                    <Text style={styles.title}>Welcome back</Text>
                    <Text style={styles.subtitle}>Enter your phone number to continue</Text>
                </View>

                <View style={styles.form}>
                    <View style={[styles.inputContainer, error ? styles.inputError : null]}>
                        <View style={styles.prefixContainer}>
                            <Text style={styles.prefix}>+998</Text>
                        </View>
                        <TextInput
                            style={styles.input}
                            placeholder="90 123 45 67"
                            keyboardType="phone-pad"
                            value={phoneSuffix}
                            maxLength={9}
                            onChangeText={(text) => {
                                setPhoneSuffix(text.replace(/\D/g, ''));
                                if (error) setError('');
                            }}
                            placeholderTextColor={Colors.textSecondary}
                        />
                        <Phone size={20} color={Colors.textSecondary} />
                    </View>

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}

                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleSendOtp}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color={Colors.white} />
                        ) : (
                            <>
                                <Text style={styles.buttonText}>Get Verification Code</Text>
                                <ChevronRight size={20} color={Colors.white} strokeWidth={3} />
                            </>
                        )}
                    </TouchableOpacity>

                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        Don't have an account? <Text style={styles.link}>Sign up</Text>
                    </Text>
                </View>
            </KeyboardAvoidingView>
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
    branding: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 40,
        marginBottom: 60,
        gap: 12,
    },
    logoBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        transform: [{ rotate: '12deg' }],
    },
    logoInner: {
        width: 18,
        height: 18,
        borderRadius: 4,
        backgroundColor: Colors.white,
        transform: [{ rotate: '-12deg' }],
    },
    brandName: {
        fontSize: 20,
        fontWeight: '900',
        color: Colors.text,
        letterSpacing: -0.5,
    },
    header: {
        marginBottom: 16,
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
        lineHeight: 22,
    },
    form: {
        flex: 1,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.white,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: 16,
        height: 64,
        ...Shadows.sm,
    },
    inputError: {
        borderColor: Colors.error,
    },
    prefixContainer: {
        backgroundColor: Colors.background,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        marginRight: 12,
    },
    prefix: {
        fontSize: 16,
        color: Colors.text,
        fontWeight: '800',
    },
    input: {
        flex: 1,
        fontSize: 18,
        color: Colors.text,
        fontWeight: '700',
    },
    errorText: {
        color: Colors.error,
        fontSize: 13,
        fontWeight: '600',
        marginTop: 10,
        marginLeft: 4,
    },
    button: {
        backgroundColor: Colors.primary,
        height: 64,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 32,
        gap: 8,
        ...Shadows.sm,
    },
    buttonText: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: '900',
    },
    footer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    footerText: {
        fontSize: 14,
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    link: {
        color: Colors.primary,
        fontWeight: '800',
    },
});
