import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Phone, ChevronRight, Send } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { Colors, Spacing, Shadows } from '../../theme';
import client from '../../api/client';
import * as SecureStore from 'expo-secure-store';

// Required for expo-auth-session to close the browser after redirect
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';

export default function LoginScreen({ navigation }: any) {
    const [phoneSuffix, setPhoneSuffix] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Social linking state — set when Google/Telegram returns 202 (phone required)
    const [pendingSocialToken, setPendingSocialToken] = useState<string | null>(null);
    const [pendingSocialProvider, setPendingSocialProvider] = useState<'google' | 'telegram' | null>(null);

    // ─── Google Sign-In ────────────────────────────────────────────────────────
    const [_request, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
        clientId: GOOGLE_CLIENT_ID,
        scopes: ['openid', 'profile', 'email'],
    });

    useEffect(() => {
        if (googleResponse?.type !== 'success') return;
        const idToken = googleResponse.authentication?.idToken;
        if (!idToken) {
            setError('Google sign-in failed: no ID token received');
            return;
        }
        handleGoogleToken(idToken);
    }, [googleResponse]);

    const handleGoogleToken = async (idToken: string) => {
        setIsLoading(true);
        setError('');
        try {
            const response = await client.post('/api/auth/google/', { id_token: idToken });
            if (response.status === 202) {
                // Phone required to link this Google account
                setPendingSocialToken(response.data.social_token);
                setPendingSocialProvider('google');
                return;
            }
            // 200 — successful login; store tokens (RootNavigator reacts to them)
            await SecureStore.setItemAsync('access_token', response.data.access);
            await SecureStore.setItemAsync('refresh_token', response.data.refresh);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Google sign-in failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

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
            navigation.navigate('Otp', {
                phone: fullPhone,
                socialToken: pendingSocialToken ?? undefined,
            });
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to send OTP. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Telegram ──────────────────────────────────────────────────────────────
    const handleTelegramLogin = async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await client.post('/api/auth/telegram/mobile/start/');
            const { token, tg_url } = response.data;

            const supported = await Linking.canOpenURL(tg_url);
            if (supported) {
                await Linking.openURL(tg_url);
            } else {
                await Linking.openURL(`https://t.me/${tg_url.split('/')[3]}`);
            }

            // Poll for login completion
            let attempts = 0;
            const interval = setInterval(async () => {
                attempts++;
                if (attempts > 60) {
                    clearInterval(interval);
                    setIsLoading(false);
                    setError('Telegram login timed out. Please try again.');
                    return;
                }

                try {
                    const statusRes = await client.get(`/api/auth/telegram/mobile/status/?token=${token}`);

                    if (statusRes.status === 202) {
                        // New Telegram user — phone verification required
                        clearInterval(interval);
                        setPendingSocialToken(statusRes.data.social_token);
                        setPendingSocialProvider('telegram');
                        setIsLoading(false);
                        return;
                    }

                    if (statusRes.data.access) {
                        clearInterval(interval);
                        await SecureStore.setItemAsync('access_token', statusRes.data.access);
                        await SecureStore.setItemAsync('refresh_token', statusRes.data.refresh);
                        setIsLoading(false);
                        // RootNavigator detects new token via re-render / checkAuth
                    }
                } catch {
                    // Pending — ignore poll errors
                }
            }, 1000);
        } catch {
            setError('Failed to start Telegram login');
            setIsLoading(false);
        }
    };

    const providerLabel = pendingSocialProvider === 'google' ? 'Google' : 'Telegram';

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
                    <Text style={styles.subtitle}>
                        {pendingSocialProvider
                            ? `Verify your phone to link your ${providerLabel} account`
                            : 'Enter your phone number to continue'
                        }
                    </Text>
                </View>

                {/* Social linking banner */}
                {pendingSocialProvider && (
                    <View style={styles.linkingBanner}>
                        <Text style={styles.linkingBannerText}>
                            {providerLabel} account not linked yet. Verify your phone — it will be linked automatically.
                        </Text>
                    </View>
                )}

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

                    {/* Social buttons — hidden while a social link is pending */}
                    {!pendingSocialProvider && (
                        <>
                            <View style={styles.divider}>
                                <View style={styles.dividerLine} />
                                <Text style={styles.dividerText}>OR</Text>
                                <View style={styles.dividerLine} />
                            </View>

                            {/* Google — only rendered when client ID is configured */}
                            {!!GOOGLE_CLIENT_ID && (
                                <TouchableOpacity
                                    style={[styles.button, styles.googleButton]}
                                    onPress={() => promptGoogleAsync()}
                                    disabled={isLoading}
                                >
                                    <Text style={styles.googleIcon}>G</Text>
                                    <Text style={[styles.buttonText, { color: Colors.text }]}>Continue with Google</Text>
                                </TouchableOpacity>
                            )}

                            {/* Telegram */}
                            <TouchableOpacity
                                style={[styles.button, styles.telegramButton, !!GOOGLE_CLIENT_ID && { marginTop: 12 }]}
                                onPress={handleTelegramLogin}
                                disabled={isLoading}
                            >
                                <Send size={20} color={Colors.white} />
                                <Text style={styles.buttonText}>Continue with Telegram</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {/* Cancel pending social link */}
                    {pendingSocialProvider && (
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => {
                                setPendingSocialToken(null);
                                setPendingSocialProvider(null);
                                setError('');
                            }}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    )}
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
    linkingBanner: {
        backgroundColor: '#EFF6FF',
        borderLeftWidth: 4,
        borderLeftColor: Colors.primary,
        borderRadius: 8,
        padding: 12,
        marginBottom: 20,
    },
    linkingBannerText: {
        color: Colors.primary,
        fontSize: 13,
        fontWeight: '600',
        lineHeight: 18,
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
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: Colors.border,
    },
    dividerText: {
        paddingHorizontal: 16,
        color: Colors.textSecondary,
        fontSize: 12,
        fontWeight: '700',
    },
    googleButton: {
        backgroundColor: Colors.white,
        borderWidth: 1.5,
        borderColor: Colors.border,
        marginTop: 0,
        shadowOpacity: 0.06,
    },
    googleIcon: {
        fontSize: 20,
        fontWeight: '900',
        color: '#4285F4',
    },
    telegramButton: {
        backgroundColor: '#0088cc',
        marginTop: 0,
    },
    cancelButton: {
        alignItems: 'center',
        marginTop: 20,
        paddingVertical: 12,
    },
    cancelButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.textSecondary,
    },
});
