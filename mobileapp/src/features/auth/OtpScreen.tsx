import React, { useState, useRef, useEffect } from 'react';
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
import { ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import { Colors, Spacing, Shadows } from '../../theme';
import { useAuth } from './AuthContext';

export default function OtpScreen({ navigation, route }: any) {
    const { phone } = route.params as { phone: string };
    const { login } = useAuth();
    const [otp, setOtp] = useState(['', '', '', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const inputRefs = useRef<TextInput[]>([]);

    const handleOtpChange = (value: string, index: number) => {
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        if (value !== '' && index < 4) {
            inputRefs.current[index + 1].focus();
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && otp[index] === '' && index > 0) {
            inputRefs.current[index - 1].focus();
        }
    };

    const handleVerify = async () => {
        const code = otp.join('');
        if (code.length < 5) {
            setError('Please enter the 5-digit code');
            return;
        }

        setIsLoading(true);
        setError('');
        try {
            const isNewUser = await login(phone, code);
            if (isNewUser) {
                navigation.navigate('Onboarding');
            }
            // If not new user, AuthContext updates user state, RootNavigator switches to Main stack.
        } catch (err: any) {
            console.error('Login failed:', err);
            setError('Invalid code. Please try again.');
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
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <ArrowLeft size={24} color={Colors.text} />
                </TouchableOpacity>

                <View style={styles.header}>
                    <Text style={styles.title}>Verify Code</Text>
                    <Text style={styles.subtitle}>
                        We sent a 5-digit code to {'\n'}
                        <Text style={styles.phoneText}>{phone}</Text>
                    </Text>
                </View>

                <View style={styles.otpContainer}>
                    {otp.map((digit, index) => (
                        <TextInput
                            key={index}
                            ref={(ref) => {
                                if (ref) inputRefs.current[index] = ref;
                            }}
                            style={[styles.otpInput, error ? styles.inputError : null, digit !== '' ? styles.otpInputActive : null]}
                            maxLength={1}
                            keyboardType="number-pad"
                            value={digit}
                            onChangeText={(text) => handleOtpChange(text, index)}
                            onKeyPress={(e) => handleKeyPress(e, index)}
                            selectTextOnFocus={true}
                        />
                    ))}
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <TouchableOpacity
                    style={[styles.button, otp.join('').length < 5 ? styles.buttonDisabled : null]}
                    onPress={handleVerify}
                    disabled={isLoading || otp.join('').length < 5}
                >
                    {isLoading ? (
                        <ActivityIndicator color={Colors.white} />
                    ) : (
                        <>
                            <Text style={styles.buttonText}>Verify & Continue</Text>
                            <CheckCircle2 size={20} color={Colors.white} strokeWidth={3} />
                        </>
                    )}
                </TouchableOpacity>

                <View style={styles.footer}>
                    <Text style={styles.resendText}>Didn't receive code? </Text>
                    <TouchableOpacity>
                        <Text style={styles.resendLink}>Resend Code</Text>
                    </TouchableOpacity>
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
    backButton: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: Colors.white,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
        ...Shadows.sm,
    },
    header: {
        marginBottom: 48,
    },
    title: {
        fontSize: 32,
        fontWeight: '900',
        color: Colors.text,
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.textSecondary,
        fontWeight: '500',
        lineHeight: 24,
    },
    phoneText: {
        fontWeight: '800',
        color: Colors.primary,
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 32,
    },
    otpInput: {
        width: 60,
        height: 72,
        backgroundColor: Colors.white,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.border,
        fontSize: 28,
        fontWeight: '900',
        textAlign: 'center',
        color: Colors.text,
        ...Shadows.sm,
    },
    otpInputActive: {
        borderColor: Colors.primary,
        borderWidth: 2,
    },
    inputError: {
        borderColor: Colors.error,
    },
    errorText: {
        color: Colors.error,
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 24,
    },
    button: {
        backgroundColor: Colors.primary,
        height: 64,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        ...Shadows.sm,
    },
    buttonDisabled: {
        backgroundColor: Colors.border,
        shadowOpacity: 0,
        elevation: 0,
    },
    buttonText: {
        color: Colors.white,
        fontSize: 18,
        fontWeight: '900',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 40,
    },
    resendText: {
        fontSize: 14,
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    resendLink: {
        fontSize: 14,
        color: Colors.primary,
        fontWeight: '800',
    },
});
