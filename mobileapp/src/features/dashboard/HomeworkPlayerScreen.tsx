import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Dimensions,
    Animated,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, ChevronRight, Check, AlertCircle, Volume2, Play, Pause } from 'lucide-react-native';
import { Audio } from 'expo-av';
import storage from '../../lib/storage';
import { Colors, Shadows } from '../../theme';
import client, { BRIDGE_BASE_URL } from '../../api/client';

const { width } = Dimensions.get('window');

export default function HomeworkPlayerScreen({ navigation, route }: any) {
    const { assignmentId } = route.params;
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<number, any>>({});
    const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const feedbackAnim = useMemo(() => new Animated.Value(300), []);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const res = await client.get(`/api/homework/assignment/${assignmentId}/`);
                if (res.data.is_completed) {
                    Alert.alert('Completed', 'You have already finished this homework.');
                    navigation.goBack();
                    return;
                }
                setData(res.data);
            } catch (error) {
                console.error('Fetch assignment failed:', error);
                Alert.alert('Error', 'Could not load homework data.');
                navigation.goBack();
            } finally {
                setIsLoading(false);
            }
        };
        fetchDetails();
    }, [assignmentId]);

    const currentActivity = data?.activities[currentIndex];
    const progress = data ? ((currentIndex + (feedback ? 1 : 0)) / data.activities.length) * 100 : 0;

    const showFeedback = (isCorrect: boolean) => {
        setFeedback(isCorrect ? 'correct' : 'wrong');
        Animated.spring(feedbackAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 40,
            friction: 7
        }).start();
    };

    const handleAnswer = (answer: any) => {
        if (feedback) return;

        let isCorrect = false;
        if (currentActivity.activity_type === 'quiz') {
            isCorrect = String(answer.selected_index) === String(currentActivity.content.correct_index);
        } else if (currentActivity.activity_type === 'gap_fill') {
            // Check if all gaps are filled and match
            const correctGaps = (currentActivity.content.text.match(/{([^}]+)}/g) || []).map((s: string) => s.slice(1, -1));
            const studentGaps = answer.gaps || [];
            isCorrect = correctGaps.length > 0 &&
                correctGaps.every((cg: string, i: number) =>
                    String(cg).toLowerCase() === String(studentGaps[i] || '').toLowerCase()
                );
        } else if (currentActivity.activity_type === 'matching') {
            const correctPairs = currentActivity.content.pairs || [];
            const correctDict = Object.fromEntries(correctPairs.map((p: any) => [String(p.left), String(p.right)]));
            const studentDict = Object.fromEntries(Object.entries(answer.pairs || {}).map(([k, v]) => [String(k), String(v)]));
            isCorrect = JSON.stringify(correctDict) === JSON.stringify(studentDict);
        } else if (currentActivity.activity_type === 'listening') {
            const subType = currentActivity.content.type || currentActivity.content.sub_type || 'quiz';
            if (subType === 'quiz') {
                isCorrect = String(answer.selected_index) === String(currentActivity.content.correct_index);
            } else if (subType === 'true_false') {
                isCorrect = answer.selected_bool === currentActivity.content.correct_bool;
            } else if (subType === 'open') {
                const keywords = currentActivity.content.keywords || [];
                const studentText = (answer.text || '').toLowerCase();
                isCorrect = keywords.length > 0
                    ? keywords.some((kw: string) => studentText.includes(kw.toLowerCase()))
                    : studentText.length > 0;
            }
        }

        setAnswers(prev => ({ ...prev, [currentActivity.id]: answer }));
        showFeedback(isCorrect);
    };

    const handleContinue = async () => {
        Animated.timing(feedbackAnim, {
            toValue: 500,
            duration: 200,
            useNativeDriver: true
        }).start(() => {
            setFeedback(null);
            setCurrentIndex(prev => {
                if (prev < data.activities.length - 1) {
                    return prev + 1;
                }
                submitHomework();
                return prev;
            });
        });
    };

    const submitHomework = async () => {
        setIsSubmitting(true);
        try {
            const payload = {
                answers: Object.keys(answers).map(id => ({
                    activity_id: parseInt(id),
                    answer_data: answers[parseInt(id)]
                }))
            };
            const res = await client.post(`/api/homework/assignment/${assignmentId}/submit/`, payload);
            Alert.alert(
                'Great Job!',
                `Homework submitted successfully.\nScore: ${res.data.percentage.toFixed(0)}%`,
                [{ text: 'Exit', onPress: () => navigation.goBack() }]
            );
        } catch (error) {
            console.error('Submit homework failed:', error);
            Alert.alert('Error', 'Failed to submit homework.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
                    <X size={24} color="#94A3B8" />
                </TouchableOpacity>
                <View style={styles.progressRail}>
                    <View style={[styles.progressBar, { width: `${progress}%` }]} />
                </View>
                <Text style={styles.progressText}>{Math.round(progress)}%</Text>
            </View>

            <View style={styles.content}>
                {currentActivity && (
                    <ActivityRenderer
                        activity={currentActivity}
                        onAnswer={handleAnswer}
                        disabled={!!feedback}
                    />
                )}
            </View>

            <Animated.View style={[
                styles.feedbackContainer,
                { transform: [{ translateY: feedbackAnim }], backgroundColor: feedback === 'correct' ? '#FFFFFF' : '#FFF1F2' }
            ]}>
                <View style={styles.feedbackTop}>
                    <View style={[styles.feedbackIcon, { backgroundColor: feedback === 'correct' ? '#DCFCE7' : '#FFE4E6' }]}>
                        {feedback === 'correct' ? (
                            <Check size={28} color="#16A34A" />
                        ) : (
                            <AlertCircle size={28} color="#E11D48" />
                        )}
                    </View>
                    <View style={styles.feedbackTextCol}>
                        <Text style={[styles.feedbackTitle, { color: feedback === 'correct' ? '#16A34A' : '#E11D48' }]}>
                            {feedback === 'correct' ? 'Correct!' : 'Incorrect'}
                        </Text>
                        <Text style={styles.feedbackSubtitle}>
                            {feedback === 'correct' ? 'You got it right! Keep it up.' : 'Don\'t worry, you\'ll get it next time!'}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity
                    style={[styles.continueBtn, { backgroundColor: feedback === 'correct' ? '#22C55E' : '#E11D48' }]}
                    onPress={handleContinue}
                >
                    <Text style={styles.continueText}>
                        {currentIndex === data.activities.length - 1 ? 'FINISH' : 'CONTINUE'}
                    </Text>
                    <ChevronRight size={20} color={Colors.white} />
                </TouchableOpacity>
            </Animated.View>
        </SafeAreaView>
    );
}

const ActivityRenderer = ({ activity, onAnswer, disabled }: any) => {
    switch (activity.activity_type) {
        case 'quiz':
            return <QuizView activity={activity} onAnswer={onAnswer} disabled={disabled} />;
        case 'gap_fill':
            return <GapFillView activity={activity} onAnswer={onAnswer} disabled={disabled} />;
        case 'matching':
            return <MatchingView activity={activity} onAnswer={onAnswer} disabled={disabled} />;
        case 'listening':
            return <ListeningView activity={activity} onAnswer={onAnswer} disabled={disabled} />;
        default:
            return <Text>Unknown activity type</Text>;
    }
};

const QuizView = ({ activity, onAnswer, disabled }: any) => {
    const { question, options } = activity.content;
    const [selected, setSelected] = useState<number | null>(null);

    return (
        <View style={styles.activityBox}>
            <View style={styles.typeBadge}>
                <Text style={styles.typeText}>QUIZ</Text>
            </View>
            <Text style={styles.questionText}>{question}</Text>
            <View style={styles.audioBtnPlaceholder}><Volume2 size={24} color={Colors.primary} /></View>
            <View style={styles.optionsList}>
                {options.map((opt: string, i: number) => (
                    <TouchableOpacity
                        key={i}
                        style={[styles.optionCard, selected === i ? styles.optionSelected : null]}
                        onPress={() => {
                            if (!disabled) {
                                setSelected(i);
                                onAnswer({ selected_index: i });
                            }
                        }}
                        disabled={disabled}
                    >
                        <View style={[styles.optionIndex, selected === i ? styles.optionIndexSelected : null]}>
                            <Text style={[styles.optionIndexText, selected === i ? styles.optionIndexTextSelected : null]}>
                                {String.fromCharCode(65 + i)}
                            </Text>
                        </View>
                        <Text style={[styles.optionLabel, selected === i ? styles.optionLabelSelected : null]}>{opt}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

const GapFillView = ({ activity, onAnswer, disabled }: any) => {
    const text = activity.content.text || "";
    const parts = text.split(/({[^}]+})/g);
    const [userGaps, setUserGaps] = useState<Record<number, string>>({});

    const updateGap = (index: number, val: string) => {
        setUserGaps(prev => ({ ...prev, [index]: val }));
    };

    const handleCheck = () => {
        const gapsArray = Object.keys(userGaps).sort((a, b) => parseInt(a) - parseInt(b)).map(k => userGaps[parseInt(k)]);
        onAnswer({ gaps: gapsArray });
    };

    let gapIdx = 0;
    return (
        <View style={styles.activityBox}>
            <View style={styles.typeBadge}><Text style={styles.typeText}>Fill the Gaps</Text></View>
            <View style={styles.gapContainer}>
                {parts.map((part: string, i: number) => {
                    if (part.startsWith('{') && part.endsWith('}')) {
                        const currentIdx = gapIdx++;
                        return (
                            <View key={i} style={styles.inputWrapper}>
                                <TextInput
                                    style={styles.gapInput}
                                    onChangeText={(val) => updateGap(currentIdx, val)}
                                    editable={!disabled}
                                    autoCapitalize="none"
                                />
                            </View>
                        );
                    }
                    return <Text key={i} style={styles.gapText}>{part}</Text>;
                })}
            </View>
            {!disabled && (
                <TouchableOpacity
                    style={[styles.continueBtn, { backgroundColor: '#4F46E5', marginTop: 40 }]}
                    onPress={handleCheck}
                >
                    <Text style={styles.continueText}>CHECK ANSWER</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const MatchingView = ({ activity, onAnswer, disabled }: any) => {
    const pairs = activity.content.pairs || [];
    const [leftSelected, setLeftSelected] = useState<string | null>(null);
    const [userMatches, setUserMatches] = useState<Record<string, string>>({});
    const [shuffledRights, setShuffledRights] = useState<string[]>([]);

    useEffect(() => {
        const rights = pairs.map((p: any) => p.right);
        setShuffledRights([...rights].sort(() => Math.random() - 0.5));
    }, [activity]);

    const handleMatch = (right: string) => {
        if (!leftSelected || disabled) return;
        setUserMatches(prev => ({ ...prev, [leftSelected]: right }));
        setLeftSelected(null);
    };

    const handleCheck = () => {
        onAnswer({ pairs: userMatches });
    };

    const isMatchedRight = (right: string) => Object.values(userMatches).includes(right);
    const totalPairs = pairs.length;
    const currentMatches = Object.keys(userMatches).length;

    return (
        <View style={styles.activityBox}>
            <View style={styles.typeBadge}><Text style={styles.typeText}>Match the Pairs</Text></View>
            <View style={styles.matchingRow}>
                <View style={styles.matchingCol}>
                    {pairs.map((p: any, i: number) => (
                        <TouchableOpacity
                            key={i}
                            style={[styles.matchCard, leftSelected === p.left ? styles.matchCardSelected : null, userMatches[p.left] ? styles.matchCardMatched : null]}
                            onPress={() => !disabled && !userMatches[p.left] && setLeftSelected(p.left)}
                            disabled={disabled || !!userMatches[p.left]}
                        >
                            <Text style={styles.matchText}>{p.left}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <View style={styles.matchingCol}>
                    {shuffledRights.map((r: string, i: number) => (
                        <TouchableOpacity
                            key={i}
                            style={[styles.matchCard, isMatchedRight(r) ? styles.matchCardMatched : null]}
                            onPress={() => handleMatch(r)}
                            disabled={disabled || !leftSelected || isMatchedRight(r)}
                        >
                            <Text style={styles.matchText}>{r}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
            {!disabled && currentMatches === totalPairs && (
                <TouchableOpacity
                    style={[styles.continueBtn, { backgroundColor: '#4F46E5', marginTop: 32 }]}
                    onPress={handleCheck}
                >
                    <Text style={styles.continueText}>CHECK PAIRS</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}
const ListeningView = ({ activity, onAnswer, disabled }: any) => {
    const subType = activity.content.type || activity.content.sub_type || 'quiz';
    const { question, options, audio_download_url } = activity.content;
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
    const [selectedBool, setSelectedBool] = useState<boolean | null>(null);
    const [openText, setOpenText] = useState("");
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [position, setPosition] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);

    useEffect(() => {
        return () => {
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, [sound]);

    async function playSound() {
        if (sound) {
            if (isPlaying) {
                await sound.pauseAsync();
            } else {
                await sound.playAsync();
            }
            return;
        }

        const token = await storage.getItemAsync('access_token');
        const fullUrl = audio_download_url.startsWith('http')
            ? audio_download_url
            : `${BRIDGE_BASE_URL}${audio_download_url.startsWith('/') ? '' : '/'}${audio_download_url}${audio_download_url.includes('?') ? '&' : '?'}token=${token}`;

        const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: fullUrl },
            { shouldPlay: true }
        );
        setSound(newSound);

        newSound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded) {
                setIsPlaying(status.isPlaying);
                setPosition(status.positionMillis);
                setDuration(status.durationMillis || 0);
                if (status.didJustFinish) {
                    setIsPlaying(false);
                    setPosition(0);
                }
            }
        });
    }

    const cycleRate = async () => {
        const rates = [1.0, 1.25, 1.5, 2.0, 0.5];
        const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
        setPlaybackRate(next);
        if (sound) {
            await sound.setRateAsync(next, true);
        }
    };

    const formatTime = (ms: number) => {
        const totalSecs = Math.floor(ms / 1000);
        const m = Math.floor(totalSecs / 60);
        const s = totalSecs % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const progress = duration > 0 ? position / duration : 0;
    const barCount = 30;

    return (
        <View style={styles.activityBox}>
            <View style={[styles.typeBadge, { backgroundColor: '#FEF3C7' }]}>
                <Text style={[styles.typeText, { color: '#D97706' }]}>LISTENING TASK</Text>
            </View>
            <Text style={styles.questionText}>{question}</Text>

            <View style={styles.premiumAudioCard}>
                <TouchableOpacity style={styles.goldenPlayBtn} onPress={playSound}>
                    {isPlaying ? (
                        <View style={styles.pauseIconRow}>
                            <View style={styles.pauseBar} /><View style={styles.pauseBar} />
                        </View>
                    ) : (
                        <Play size={24} color="#000" fill="#000" style={{ marginLeft: 4 }} />
                    )}
                </TouchableOpacity>

                <View style={styles.waveformContainer}>
                    <View style={styles.barsRow}>
                        {Array.from({ length: barCount }).map((_, i) => {
                            const active = progress > (i / barCount);
                            const h = 10 + Math.sin(i * 0.8) * 6 + Math.cos(i * 0.4) * 4;
                            return (
                                <View
                                    key={i}
                                    style={[
                                        styles.waveformBar,
                                        { height: h, backgroundColor: active ? '#FACC15' : '#E2E8F0' }
                                    ]}
                                />
                            );
                        })}
                    </View>
                    <Text style={styles.audioTimerText}>{formatTime(position)}</Text>
                </View>

                <TouchableOpacity style={styles.rateBtn} onPress={cycleRate}>
                    <Text style={styles.rateText}>{playbackRate}x</Text>
                </TouchableOpacity>
            </View>

            {subType === 'quiz' && (
                <View style={styles.optionsList}>
                    {options.map((opt: string, i: number) => (
                        <TouchableOpacity
                            key={i}
                            style={[styles.optionCard, selectedIdx === i ? styles.optionSelected : null]}
                            onPress={() => {
                                if (!disabled) {
                                    setSelectedIdx(i);
                                    onAnswer({ selected_index: i });
                                }
                            }}
                            disabled={disabled}
                        >
                            <View style={[styles.optionIndex, selectedIdx === i ? styles.optionIndexSelected : null]}>
                                <Text style={[styles.optionIndexText, selectedIdx === i ? styles.optionIndexTextSelected : null]}>
                                    {String.fromCharCode(65 + i)}
                                </Text>
                            </View>
                            <Text style={[styles.optionLabel, selectedIdx === i ? styles.optionLabelSelected : null]}>{opt}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {subType === 'true_false' && (
                <View style={styles.tfRow}>
                    {[true, false].map((val) => {
                        const active = selectedBool === val;
                        return (
                            <TouchableOpacity
                                key={String(val)}
                                disabled={disabled}
                                onPress={() => { setSelectedBool(val); onAnswer({ selected_bool: val }); }}
                                style={[
                                    styles.tfCard,
                                    active ? (val ? styles.tfCardTrue : styles.tfCardFalse) : null
                                ]}
                            >
                                <View style={[styles.feedbackIcon, { backgroundColor: active ? '#FFFFFF' : '#F1F5F9' }]}>
                                    {val ? <Check size={24} color={active ? '#16A34A' : '#94A3B8'} /> : <X size={24} color={active ? '#E11D48' : '#94A3B8'} />}
                                </View>
                                <Text style={[styles.tfText, { color: active ? '#FFFFFF' : '#64748B' }]}>
                                    {val ? 'TRUE' : 'FALSE'}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}

            {subType === 'open' && (
                <View style={styles.openTaskBox}>
                    <TextInput
                        multiline
                        numberOfLines={4}
                        placeholder="Type what you heard..."
                        placeholderTextColor="#94A3B8"
                        style={styles.openInput}
                        onChangeText={setOpenText}
                        editable={!disabled}
                    />
                    {!disabled && (
                        <TouchableOpacity
                            style={styles.checkBtnNative}
                            onPress={() => onAnswer({ text: openText })}
                        >
                            <Text style={styles.checkBtnText}>CHECK ANSWER</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 16 },
    closeBtn: { padding: 4 },
    progressRail: { flex: 1, height: 12, backgroundColor: '#F1F5F9', borderRadius: 6, overflow: 'hidden' },
    progressBar: { height: '100%', backgroundColor: '#4F46E5', borderRadius: 6 },
    progressText: { fontSize: 13, fontWeight: '900', color: '#4F46E5', width: 40, textAlign: 'right' },
    content: { flex: 1, padding: 24 },
    activityBox: { flex: 1 },
    typeBadge: { backgroundColor: '#EEF2FF', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 16 },
    typeText: { fontSize: 12, fontWeight: '900', color: '#4F46E5', textTransform: 'uppercase', letterSpacing: 1 },
    questionText: { fontSize: 26, fontWeight: '900', color: '#1E293B', lineHeight: 34, marginBottom: 24 },
    audioBtnPlaceholder: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#4F46E5', marginBottom: 40, ...Shadows.sm },
    optionsList: { gap: 12 },
    optionCard: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 2, borderColor: '#E2E8F0', gap: 16 },
    optionSelected: { borderColor: '#4F46E5', backgroundColor: '#F8FAFC' },
    optionIndex: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
    optionIndexSelected: { backgroundColor: '#E0E7FF', borderColor: '#4F46E5' },
    optionIndexText: { fontSize: 14, fontWeight: '900', color: '#94A3B8' },
    optionIndexTextSelected: { color: '#4F46E5' },
    optionLabel: { fontSize: 18, fontWeight: '700', color: '#475569', flex: 1 },
    optionLabelSelected: { color: '#1E293B' },
    feedbackContainer: { position: 'absolute', bottom: 0, width: width, padding: 24, paddingBottom: 40, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, borderColor: '#E2E8F0', ...Shadows.md },
    feedbackTop: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
    feedbackIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
    feedbackTextCol: { flex: 1 },
    feedbackTitle: { fontSize: 22, fontWeight: '900', marginBottom: 2 },
    feedbackSubtitle: { fontSize: 14, color: '#64748B', fontWeight: '600' },
    continueBtn: { flexDirection: 'row', height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', gap: 8, ...Shadows.sm },
    continueText: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
    gapContainer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingVertical: 20 },
    gapText: { fontSize: 22, fontWeight: '700', color: '#1E293B', lineHeight: 40 },
    inputWrapper: { marginHorizontal: 8, borderBottomWidth: 3, borderBottomColor: '#4F46E5', minWidth: 80 },
    gapInput: { fontSize: 22, fontWeight: '900', color: '#4F46E5', textAlign: 'center', paddingVertical: 4 },
    matchingRow: { flexDirection: 'row', gap: 16, marginTop: 20 },
    matchingCol: { flex: 1, gap: 12 },
    matchCard: { padding: 16, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 2, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', minHeight: 80 },
    matchCardSelected: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
    matchCardMatched: { opacity: 0.5, backgroundColor: '#F1F5F9', borderColor: 'transparent' },
    matchText: { fontSize: 16, fontWeight: '800', color: '#1E293B', textAlign: 'center' },
    premiumAudioCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 12,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        marginBottom: 32,
        gap: 12,
        ...Shadows.sm
    },
    goldenPlayBtn: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#FACC15',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#FACC15',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5
    },
    pauseIconRow: { flexDirection: 'row', gap: 4 },
    pauseBar: { width: 6, height: 20, backgroundColor: '#000', borderRadius: 3 },
    waveformContainer: { flex: 1, height: 60, justifyContent: 'center' },
    barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginBottom: 4 },
    waveformBar: { width: 4, borderRadius: 2 },
    audioTimerText: { fontSize: 12, fontWeight: '800', color: '#94A3B8' },
    rateBtn: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center'
    },
    rateText: { fontSize: 12, fontWeight: '900', color: '#475569' },
    tfRow: { flexDirection: 'row', gap: 12 },
    tfCard: { flex: 1, height: 160, backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 2, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', gap: 12 },
    tfCardTrue: { backgroundColor: '#22C55E', borderColor: '#16A34A' },
    tfCardFalse: { backgroundColor: '#E11D48', borderColor: '#BE123C' },
    tfText: { fontSize: 18, fontWeight: '900' },
    openTaskBox: { gap: 16 },
    openInput: { backgroundColor: '#F8FAFC', borderRadius: 20, borderWidth: 2, borderColor: '#E2E8F0', padding: 20, fontSize: 18, fontWeight: '700', color: '#1E293B', minHeight: 120 },
    checkBtnNative: { height: 56, backgroundColor: '#4F46E5', borderRadius: 16, justifyContent: 'center', alignItems: 'center', ...Shadows.sm },
    checkBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
});
