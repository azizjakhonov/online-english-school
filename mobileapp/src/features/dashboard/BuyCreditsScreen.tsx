import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Wallet,
    CreditCard,
    Check,
    ArrowLeft,
    ShieldCheck,
    CheckCircle2,
} from 'lucide-react-native';
import { Colors, Spacing, Shadows } from '../../theme';
import client from '../../api/client';

const PACKAGES = [
    {
        id: 1,
        credits: 5,
        price_uzs: 500000,
        label: 'Starter',
        features: ['Valid for 30 days', 'Basic Support'],
    },
    {
        id: 2,
        credits: 20,
        price_uzs: 1800000,
        popular: true,
        features: ['Save 10%', 'Valid for 90 days', 'Priority Support'],
    },
    {
        id: 3,
        credits: 50,
        price_uzs: 4000000,
        label: 'Pro',
        features: ['Save 20%', 'Never Expires', 'VIP Support'],
    },
];

export default function BuyCreditsScreen({ navigation }: any) {
    const [selectedPkg, setSelectedPkg] = useState(2);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [balance, setBalance] = useState(0);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const fetchBalance = async () => {
            try {
                const res = await client.get('/api/me/');
                const sp = res.data.student_profile;
                setBalance(sp?.available_credits ?? sp?.lesson_credits ?? 0);
            } catch (err) {
                console.error('Balance fetch failed', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchBalance();
    }, []);

    const handlePurchase = async () => {
        setIsProcessing(true);
        try {
            const pkg = PACKAGES.find((p) => p.id === selectedPkg);
            await client.post('/api/payments/purchase/', { package_id: selectedPkg });
            setSuccess(true);
        } catch (err) {
            console.error('Purchase failed', err);
            Alert.alert('Payment Failed', 'Something went wrong. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    const selectedPackage = PACKAGES.find((p) => p.id === selectedPkg);

    if (success) {
        return (
            <View style={styles.successContainer}>
                <View style={styles.successCard}>
                    <View style={styles.successIcon}>
                        <CheckCircle2 size={60} color={Colors.success} />
                    </View>
                    <Text style={styles.successTitle}>Success!</Text>
                    <Text style={styles.successText}>
                        <Text style={styles.highlightText}>{selectedPackage?.credits} credits</Text> added to your wallet.
                    </Text>
                    <TouchableOpacity
                        style={styles.doneBtn}
                        onPress={() => navigation.navigate('Main')}
                    >
                        <Text style={styles.doneBtnText}>Go to Dashboard</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
                    <ArrowLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <View style={styles.balanceBadge}>
                    <Wallet size={16} color={Colors.primary} />
                    <Text style={styles.balanceText}>{balance} Credits</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>Refill your credits</Text>
                <Text style={styles.subtitle}>Select a package to continue learning</Text>

                <View style={styles.packageList}>
                    {PACKAGES.map((pkg) => (
                        <TouchableOpacity
                            key={pkg.id}
                            style={[styles.packageCard, selectedPkg === pkg.id && styles.packageCardActive]}
                            onPress={() => setSelectedPkg(pkg.id)}
                        >
                            {pkg.popular && (
                                <View style={styles.popularBadge}>
                                    <Text style={styles.popularText}>POPULAR</Text>
                                </View>
                            )}
                            <View style={styles.packageHeader}>
                                <View>
                                    <Text style={styles.packageCredits}>{pkg.credits} Credits</Text>
                                    <Text style={styles.packagePrice}>
                                        {(pkg.price_uzs / 1000).toLocaleString()}k UZS
                                    </Text>
                                </View>
                                <View style={[styles.checkbox, selectedPkg === pkg.id && styles.checkboxActive]}>
                                    {selectedPkg === pkg.id && <Check size={16} color={Colors.white} />}
                                </View>
                            </View>
                            <View style={styles.packageFeatures}>
                                {pkg.features.map((f, i) => (
                                    <View key={i} style={styles.featureRow}>
                                        <Check size={12} color={Colors.success} />
                                        <Text style={styles.featureText}>{f}</Text>
                                    </View>
                                ))}
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.summaryCard}>
                    <View style={styles.summaryHeader}>
                        <ShieldCheck size={20} color={Colors.primary} />
                        <Text style={styles.summaryTitle}>Secure Checkout</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Total Due</Text>
                        <Text style={styles.summaryValue}>
                            {selectedPackage?.price_uzs.toLocaleString()} UZS
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.payBtn}
                        onPress={handlePurchase}
                        disabled={isProcessing}
                    >
                        {isProcessing ? (
                            <ActivityIndicator color={Colors.white} />
                        ) : (
                            <>
                                <CreditCard size={20} color={Colors.white} />
                                <Text style={styles.payBtnText}>Pay Now</Text>
                            </>
                        )}
                    </TouchableOpacity>
                    <Text style={styles.demoText}>Demo mode — no real payment required</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
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
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    closeBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: Colors.white,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadows.sm,
    },
    balanceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
    },
    balanceText: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.primary,
    },
    content: {
        padding: Spacing.lg,
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: Colors.text,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.textSecondary,
        marginBottom: Spacing.xl,
    },
    packageList: {
        gap: 16,
        marginBottom: Spacing.xl,
    },
    packageCard: {
        backgroundColor: Colors.white,
        borderRadius: 24,
        padding: 20,
        borderWidth: 2,
        borderColor: Colors.border,
        position: 'relative',
    },
    packageCardActive: {
        borderColor: Colors.primary,
        backgroundColor: '#F0F7FF',
    },
    popularBadge: {
        position: 'absolute',
        top: -12,
        right: 20,
        backgroundColor: Colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    popularText: {
        color: Colors.white,
        fontSize: 10,
        fontWeight: '900',
    },
    packageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    packageCredits: {
        fontSize: 20,
        fontWeight: '900',
        color: Colors.text,
    },
    packagePrice: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.primary,
        marginTop: 2,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    packageFeatures: {
        gap: 8,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    featureText: {
        fontSize: 13,
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    summaryCard: {
        backgroundColor: Colors.white,
        borderRadius: 24,
        padding: 24,
        ...Shadows.sm,
    },
    summaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 20,
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: Colors.text,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    summaryLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    summaryValue: {
        fontSize: 18,
        fontWeight: '900',
        color: Colors.text,
    },
    payBtn: {
        backgroundColor: Colors.text,
        height: 56,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        ...Shadows.sm,
    },
    payBtnText: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: '800',
    },
    demoText: {
        textAlign: 'center',
        fontSize: 12,
        color: Colors.textSecondary,
        marginTop: 12,
        fontWeight: '500',
    },
    successContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    successCard: {
        backgroundColor: Colors.white,
        borderRadius: 32,
        padding: 32,
        width: '100%',
        alignItems: 'center',
    },
    successIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    successTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: Colors.text,
        marginBottom: 8,
    },
    successText: {
        fontSize: 16,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    highlightText: {
        color: Colors.primary,
        fontWeight: '800',
    },
    doneBtn: {
        backgroundColor: Colors.primary,
        width: '100%',
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadows.sm,
    },
    doneBtnText: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: '800',
    },
});
