import React, { useState, useEffect, memo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { Check, X, ListChecks } from 'lucide-react-native';
import { Colors, Shadows, Spacing } from '../../theme';

interface QuizProps {
    content: {
        question?: string;
        options?: string[];
        correct_index?: number;
    };
    onAction: (action: string, data?: any) => void;
    gameState?: any;
    isTeacher?: boolean;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

const OptionButton = memo(({ label, text, isSelected, isCorrect, isRevealed, onClick }: any) => {
    let containerStyle: any = styles.optionContainer;
    let labelStyle: any = styles.optionLabel;
    let labelTextStyle: any = styles.optionLabelText;
    let textStyle: any = styles.optionText;

    if (isRevealed) {
        if (isCorrect) {
            containerStyle = [styles.optionContainer, styles.optionCorrect];
            labelStyle = [styles.optionLabel, styles.labelCorrect];
            labelTextStyle = styles.labelTextActive;
        } else if (isSelected) {
            containerStyle = [styles.optionContainer, styles.optionWrong];
            labelStyle = [styles.optionLabel, styles.labelWrong];
            labelTextStyle = styles.labelTextActive;
        } else {
            containerStyle = [styles.optionContainer, styles.optionDimmed];
        }
    } else if (isSelected) {
        containerStyle = [styles.optionContainer, styles.optionActive];
        labelStyle = [styles.optionLabel, styles.labelActive];
        labelTextStyle = styles.labelTextActive;
    }

    return (
        <TouchableOpacity
            style={containerStyle}
            onPress={onClick}
            activeOpacity={0.7}
        >
            <View style={labelStyle}>
                <Text style={labelTextStyle}>{label}</Text>
            </View>
            <Text style={[textStyle, isRevealed && !isCorrect && isSelected && { color: '#B91C1C' }]}>
                {text}
            </Text>
            {isRevealed && isCorrect && <Check size={18} color="#059669" />}
            {isRevealed && isSelected && !isCorrect && <X size={18} color="#B91C1C" />}
        </TouchableOpacity>
    );
});

export default function QuizMobile({ content, onAction, gameState, isTeacher }: QuizProps) {
    const options = content.options || [];
    const correctIndex = content.correct_index ?? -1;

    // Use local state for immediate feedback on mobile
    const [localSelectedIndex, setLocalSelectedIndex] = useState<number | null>(null);

    const submitted = gameState?.submitted ?? false;
    const isRevealed = isTeacher || submitted;

    // If already submitted in gameState, sync it
    useEffect(() => {
        if (gameState?.selectedIndex !== undefined) {
            setLocalSelectedIndex(gameState.selectedIndex);
        } else if (gameState && Object.keys(gameState).length === 0) {
            setLocalSelectedIndex(null);
        }
    }, [gameState]);

    const handleSelect = (idx: number) => {
        if (submitted && !isTeacher) return;
        setLocalSelectedIndex(idx);
        onAction('SELECT_OPTION', { selectedIndex: idx });
    };

    const handleSubmit = () => {
        onAction('SUBMIT_QUIZ', { submitted: true, selectedIndex: localSelectedIndex });
    };

    return (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
            <View style={styles.card}>
                <View style={styles.header}>
                    <View style={styles.iconBox}>
                        <ListChecks size={20} color="#3B82F6" />
                    </View>
                    <View>
                        <Text style={styles.quizTitle}>Interactive Quiz</Text>
                        <Text style={styles.quizSub}>{options.length} Options Available</Text>
                    </View>
                </View>

                <Text style={styles.questionText}>{content.question}</Text>

                <View style={styles.optionsList}>
                    {options.map((opt, idx) => (
                        <OptionButton
                            key={idx}
                            label={OPTION_LABELS[idx]}
                            text={opt}
                            isSelected={localSelectedIndex === idx}
                            isCorrect={correctIndex === idx}
                            isRevealed={isRevealed}
                            onClick={() => handleSelect(idx)}
                        />
                    ))}
                </View>

                {!isTeacher && !submitted && (
                    <TouchableOpacity
                        style={[styles.submitBtn, localSelectedIndex === null && styles.btnDisabled]}
                        disabled={localSelectedIndex === null}
                        onPress={handleSubmit}
                    >
                        <Text style={styles.submitBtnText}>Submit Answer</Text>
                    </TouchableOpacity>
                )}

                {submitted && (
                    <View style={[styles.resultBanner, localSelectedIndex === correctIndex ? styles.resultCorrect : styles.resultWrong]}>
                        <Text style={[styles.resultTitle, localSelectedIndex === correctIndex ? { color: '#065F46' } : { color: '#991B1B' }]}>
                            {localSelectedIndex === correctIndex ? 'Correct!' : 'Try Again'}
                        </Text>
                        <Text style={styles.resultSub}>
                            {localSelectedIndex === correctIndex
                                ? 'Great job! You found the right answer.'
                                : `The correct answer was: ${options[correctIndex]}`
                            }
                        </Text>
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        ...Shadows.md,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 24,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    quizTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#1E293B',
    },
    quizSub: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '600',
    },
    questionText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1E293B',
        lineHeight: 26,
        marginBottom: 24,
    },
    optionsList: {
        gap: 12,
        marginBottom: 24,
    },
    optionContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#F1F5F9',
        backgroundColor: '#F8FAFC',
        gap: 12,
    },
    optionActive: {
        borderColor: '#3B82F6',
        backgroundColor: '#EFF6FF',
    },
    optionCorrect: {
        borderColor: '#34D399',
        backgroundColor: '#ECFDF5',
    },
    optionWrong: {
        borderColor: '#FCA5A5',
        backgroundColor: '#FEF2F2',
    },
    optionDimmed: {
        opacity: 0.5,
    },
    optionLabel: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#E2E8F0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionLabelText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#64748B',
    },
    labelActive: {
        backgroundColor: '#3B82F6',
    },
    labelCorrect: {
        backgroundColor: '#10B981',
    },
    labelWrong: {
        backgroundColor: '#EF4444',
    },
    labelTextActive: {
        color: '#FFFFFF',
    },
    optionText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
    },
    submitBtn: {
        backgroundColor: '#3B82F6',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        ...Shadows.sm,
    },
    btnDisabled: {
        backgroundColor: '#CBD5E1',
    },
    submitBtnText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 15,
    },
    resultBanner: {
        padding: 16,
        borderRadius: 16,
        marginTop: 10,
    },
    resultCorrect: {
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    resultWrong: {
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    resultTitle: {
        fontSize: 14,
        fontWeight: '900',
        marginBottom: 4,
    },
    resultSub: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '500',
    }
});
