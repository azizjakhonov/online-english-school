import React, { memo, useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Check, X, RefreshCw, Send, Eye } from 'lucide-react-native';

interface GapFillProps {
    content: {
        text?: string;
    };
    onAction: (action: string, data: any) => void;
    gameState?: any;
    isTeacher: boolean;
}

export default function GapFillMobile({ content, onAction, gameState, isTeacher }: GapFillProps) {
    const text = content.text || '';

    // Split the text by the {word} pattern used in the web builder
    const parts = useMemo(() => {
        if (!text) return [];
        return text.split(/{([^}]+)}/);
    }, [text]);

    const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
    const [localSubmitted, setLocalSubmitted] = useState(false);

    useEffect(() => {
        if (!gameState) return;

        if (gameState.answers) {
            setUserAnswers(gameState.answers);
        } else if (Object.keys(gameState).length === 0) {
            setUserAnswers({});
        }

        if (gameState.submitted !== undefined) {
            setLocalSubmitted(gameState.submitted);
        }
    }, [gameState]);

    const submitted = isTeacher || localSubmitted;

    const handleInputChange = (index: number, value: string) => {
        if (submitted && !isTeacher) return;
        const newAnswers = { ...userAnswers, [index]: value };
        setUserAnswers(newAnswers);
        onAction('TYPE_ANSWER', { answers: newAnswers });
    };

    const handleSubmit = () => {
        setLocalSubmitted(true);

        let correctCount = 0;
        let totalGaps = 0;

        parts.forEach((part, i) => {
            if (i % 2 !== 0) {
                totalGaps++;
                if (userAnswers[i]?.trim().toLowerCase() === part.trim().toLowerCase()) {
                    correctCount++;
                }
            }
        });

        onAction('CHECK_ANSWER', {
            answers: userAnswers,
            submitted: true,
            score: { correct: correctCount, total: totalGaps }
        });
    };

    const handleReset = () => {
        setUserAnswers({});
        setLocalSubmitted(false);
        onAction('RESET', {});
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <Text style={styles.title}>Complete the sentences</Text>
                {isTeacher && (
                    <View style={styles.teacherBadge}>
                        <Eye size={12} color="#7C3AED" />
                        <Text style={styles.teacherBadgeText}>Teacher View</Text>
                    </View>
                )}
            </View>

            <View style={styles.card}>
                <View style={styles.passageContainer}>
                    {parts.map((part, index) => {
                        // Even indices are plain text
                        if (index % 2 === 0) {
                            return (
                                <Text key={index} style={styles.passageText}>
                                    {part}
                                </Text>
                            );
                        }

                        // Odd indices are gaps
                        const correctAnswer = part;
                        const userAnswer = userAnswers[index] || '';
                        const isCorrect = submitted && userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
                        const isWrong = submitted && !isCorrect;

                        return (
                            <View key={index} style={styles.gapWrapper}>
                                <TextInput
                                    style={[
                                        styles.input,
                                        submitted && isCorrect && styles.inputCorrect,
                                        submitted && isWrong && styles.inputWrong,
                                        isTeacher && styles.inputDisabled
                                    ]}
                                    value={userAnswer}
                                    onChangeText={(val) => handleInputChange(index, val)}
                                    placeholder="..."
                                    editable={!submitted && !isTeacher}
                                />
                                {submitted && isWrong && (
                                    <Text style={styles.correctReveal}>{correctAnswer}</Text>
                                )}
                            </View>
                        );
                    })}
                </View>
            </View>

            <View style={styles.footer}>
                {!submitted && !isTeacher && (
                    <TouchableOpacity
                        style={[styles.submitButton, !Object.keys(userAnswers).length && styles.disabledButton]}
                        onPress={handleSubmit}
                        disabled={!Object.keys(userAnswers).length}
                    >
                        <Send size={18} color="#FFF" />
                        <Text style={styles.submitButtonText}>Check Answers</Text>
                    </TouchableOpacity>
                )}

                {submitted && !isTeacher && (
                    <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
                        <RefreshCw size={18} color="#475569" />
                        <Text style={styles.resetButtonText}>Try Again</Text>
                    </TouchableOpacity>
                )}

                {isTeacher && (
                    <View style={styles.statusInfo}>
                        <Text style={styles.statusText}>
                            {localSubmitted ? 'Student has submitted' : 'Student is typing...'}
                        </Text>
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    content: {
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1E293B',
    },
    teacherBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F3FF',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        gap: 5,
    },
    teacherBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#7C3AED',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 15,
        elevation: 2,
    },
    passageContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
    },
    passageText: {
        fontSize: 16,
        color: '#334155',
        lineHeight: 32,
    },
    gapWrapper: {
        marginHorizontal: 4,
        alignItems: 'center',
    },
    input: {
        borderBottomWidth: 2,
        borderBottomColor: '#3B82F6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        fontSize: 16,
        fontWeight: '700',
        color: '#1E293B',
        minWidth: 60,
        textAlign: 'center',
    },
    inputCorrect: {
        borderBottomColor: '#10B981',
        color: '#059669',
        backgroundColor: '#ECFDF5',
    },
    inputWrong: {
        borderBottomColor: '#EF4444',
        color: '#DC2626',
        backgroundColor: '#FEF2F2',
    },
    inputDisabled: {
        borderBottomColor: '#CBD5E1',
    },
    correctReveal: {
        fontSize: 10,
        fontWeight: '700',
        color: '#10B981',
        marginTop: 2,
    },
    footer: {
        marginTop: 30,
        alignItems: 'center',
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3B82F6',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 16,
        gap: 10,
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    disabledButton: {
        opacity: 0.5,
    },
    submitButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    resetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E2E8F0',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
    },
    resetButtonText: {
        color: '#475569',
        fontSize: 14,
        fontWeight: '600',
    },
    statusInfo: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
    },
});
