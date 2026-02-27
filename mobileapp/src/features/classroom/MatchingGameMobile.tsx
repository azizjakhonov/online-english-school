import React, { useState, useEffect, memo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { Puzzle, CheckCircle2 } from 'lucide-react-native';
import { Colors, Shadows, Spacing } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface MatchingProps {
    content: {
        pairs?: Array<{ id: number; left: string; right: string }>;
        question?: string;
        title?: string;
    };
    onAction: (action: string, data?: any) => void;
    gameState?: any;
    isTeacher?: boolean;
}

export default function MatchingGameMobile({ content, onAction, gameState, isTeacher }: MatchingProps) {
    const pairs = content.pairs || [];

    // In MatchingGame, gameState tracks matched pairs: { [leftText]: rightText }
    const [matches, setMatches] = useState<Record<string, string>>({});
    const [showResults, setShowResults] = useState(false);

    // Selection by index for local UI
    const [selectedLeftIdx, setSelectedLeftIdx] = useState<number | null>(null);
    const [selectedRightIdx, setSelectedRightIdx] = useState<number | null>(null);

    // Shuffle logic
    const [leftItems, setLeftItems] = useState<any[]>([]);
    const [rightItems, setRightItems] = useState<any[]>([]);

    useEffect(() => {
        if (!gameState) return;

        if (gameState.matches) {
            setMatches(gameState.matches);
        } else if (Object.keys(gameState).length === 0) {
            setMatches({});
        }

        if (typeof gameState.resultsRevealed === 'boolean') {
            setShowResults(gameState.resultsRevealed);
        }
    }, [gameState]);

    useEffect(() => {
        const lefts = pairs.map(p => ({ id: p.id, text: p.left }));
        const rights = pairs.map(p => ({ id: p.id, text: p.right }));
        setLeftItems([...lefts].sort(() => Math.random() - 0.5));
        setRightItems([...rights].sort(() => Math.random() - 0.5));
    }, [content]);

    const handleLeftPress = (idx: number) => {
        const item = leftItems[idx];
        if (matches[item.text]) return;

        const newSelected = idx === selectedLeftIdx ? null : idx;
        setSelectedLeftIdx(newSelected);

        if (newSelected !== null && selectedRightIdx !== null) {
            checkMatch(newSelected, selectedRightIdx);
        }
    };

    const handleRightPress = (idx: number) => {
        const item = rightItems[idx];
        // Check if this answer is already used in any match
        if (Object.values(matches).includes(item.text)) return;

        const newSelected = idx === selectedRightIdx ? null : idx;
        setSelectedRightIdx(newSelected);

        if (newSelected !== null && selectedLeftIdx !== null) {
            checkMatch(selectedLeftIdx, newSelected);
        }
    };

    const checkMatch = (lIdx: number, rIdx: number) => {
        const leftItem = leftItems[lIdx];
        const rightItem = rightItems[rIdx];

        // On mobile, we only record successful matches if we want it to be a "game"
        // But for sync with web "worksheet", we should allow any placement?
        // Let's stick to "Correct Match Only" for the game UI but use the web schema
        if (leftItem.id === rightItem.id) {
            const newMatches = { ...matches, [leftItem.text]: rightItem.text };
            setMatches(newMatches);
            onAction('MATCH_UPDATE', { matches: newMatches });
            setSelectedLeftIdx(null);
            setSelectedRightIdx(null);
        } else {
            setTimeout(() => {
                setSelectedLeftIdx(null);
                setSelectedRightIdx(null);
            }, 500);
        }
    };

    const matchedCount = Object.keys(matches).length;
    const isAllMatched = pairs.length > 0 && matchedCount === pairs.length;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.iconBox}>
                    <Puzzle size={20} color="#8B5CF6" />
                </View>
                <View>
                    <Text style={styles.title}>{content.question || content.title || 'Vocabulary Match'}</Text>
                    <Text style={styles.sub}>{content.question ? 'Match the pairs' : 'Find matching word pairs'}</Text>
                </View>
            </View>

            <View style={styles.gameBoard}>
                {/* Left Column */}
                <View style={styles.column}>
                    {leftItems.map((item, idx) => {
                        const isMatched = !!matches[item.text];
                        const isSelected = selectedLeftIdx === idx;
                        const isCorrect = isMatched; // In this UI, only correct matches are kept in state
                        const showFeedback = showResults && isMatched;

                        return (
                            <TouchableOpacity
                                key={`left-${idx}`}
                                style={[
                                    styles.itemCard,
                                    isSelected && styles.itemSelected,
                                    isMatched && styles.itemMatched,
                                    showFeedback && (isCorrect ? styles.itemCorrect : styles.itemWrong)
                                ]}
                                onPress={() => handleLeftPress(idx)}
                                disabled={isMatched}
                            >
                                <Text style={[
                                    styles.itemText,
                                    isSelected && styles.textWhite,
                                    isMatched && styles.textMuted
                                ]}>
                                    {item.text}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Right Column */}
                <View style={styles.column}>
                    {rightItems.map((item, idx) => {
                        const isMatched = Object.values(matches).includes(item.text);
                        const isSelected = selectedRightIdx === idx;
                        const showFeedback = showResults && isMatched;

                        return (
                            <TouchableOpacity
                                key={`right-${idx}`}
                                style={[
                                    styles.itemCard,
                                    isSelected && styles.itemSelected,
                                    isMatched && styles.itemMatched,
                                    showFeedback && styles.itemCorrect // Answers that are matched are correct in this UI
                                ]}
                                onPress={() => handleRightPress(idx)}
                                disabled={isMatched}
                            >
                                <Text style={[
                                    styles.itemText,
                                    isSelected && styles.textWhite,
                                    isMatched && styles.textMuted
                                ]}>
                                    {item.text}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {isAllMatched && (
                <View style={styles.successBanner}>
                    <CheckCircle2 size={32} color="#10B981" />
                    <Text style={styles.successText}>Well done! All pairs matched.</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
    },
    iconBox: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#F5F3FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 16,
        fontWeight: '900',
        color: '#1E293B',
    },
    sub: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '600',
    },
    gameBoard: {
        flexDirection: 'row',
        gap: 15,
    },
    column: {
        flex: 1,
        gap: 12,
    },
    itemCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        minHeight: 60,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        ...Shadows.sm,
    },
    itemSelected: {
        backgroundColor: '#8B5CF6',
        borderColor: '#8B5CF6',
    },
    itemMatched: {
        backgroundColor: '#F1F5F9',
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
    },
    itemCorrect: {
        backgroundColor: '#ECFDF5',
        borderColor: '#10B981',
    },
    itemWrong: {
        backgroundColor: '#FEF2F2',
        borderColor: '#EF4444',
    },
    itemText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#334155',
        textAlign: 'center',
    },
    textWhite: {
        color: '#FFFFFF',
    },
    textMuted: {
        color: '#94A3B8',
        textDecorationLine: 'line-through',
    },
    successBanner: {
        marginTop: 30,
        alignItems: 'center',
        gap: 10,
        padding: 20,
        backgroundColor: '#ECFDF5',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    successText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#065F46',
    }
});
