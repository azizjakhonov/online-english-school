/**
 * GapFill.tsx — Refactored to match Classroom.tsx design system
 * ─────────────────────────────────────────────────────────────
 * UI changes (zero business-logic changes):
 *  • Full design-system alignment: gray-50 bg, white rounded-2xl cards,
 *    border-gray-200, shadow-sm, matching button styles from Classroom.tsx
 *  • Teacher: violet badge + read-only view of student progress
 *  • Student: teal badge + typing-synced hint + auto-advance on Enter
 *  • Loading / no-activity / waiting states with matching skeleton/empty UI
 *  • Correct (emerald) / incorrect (red) validation styling on submit / reveal
 *  • Accessible: focus rings, aria-labels, disabled states
 *  • memo + useCallback for performance
 *
 * Sync logic, types, and external props are unchanged.
 */

import { memo, useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
    CheckCircle2,
    XCircle,
    RefreshCw,
    Eye,
    Loader2,
    MonitorPlay,
    Clock,
} from 'lucide-react';

// ─── TYPES (unchanged) ────────────────────────────────────────────────────────
interface GapFillProps {
    content: {
        text: string; // "The {cat} sat on the {mat}."
    };
    isTeacher: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gameState?: any;
    onAction?: (action: string, data: unknown) => void;
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────
const GapFill = memo(function GapFill({
    content,
    isTeacher,
    gameState,
    onAction,
}: GapFillProps) {
    const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
    const [submitted, setSubmitted] = useState(false);

    // Refs for auto-advance: one input ref per gap index
    const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

    // ── 1. PARSE TEXT ──────────────────────────────────────────────────────────
    // "Hello {world} foo {bar}" → ["Hello ", "world", " foo ", "bar", ""]
    const parts = useMemo(() => {
        if (!content?.text) return [];
        return content.text.split(/{([^}]+)}/);
    }, [content?.text]);

    // Collect gap indices (odd positions in parts array)
    const gapIndices = useMemo(
        () => parts.reduce<number[]>((acc, _, i) => (i % 2 !== 0 ? [...acc, i] : acc), []),
        [parts],
    );

    // ── 2. TEACHER SYNC (unchanged logic) ──────────────────────────────────────
    useEffect(() => {
        if (isTeacher && gameState?.answers) {
            setUserAnswers(gameState.answers);
            setSubmitted(gameState.submitted || false);
        }
    }, [isTeacher, gameState]);

    // ── 3. HANDLERS (unchanged logic, stabilised with useCallback) ─────────────
    const handleInputChange = useCallback(
        (index: number, value: string) => {
            if (isTeacher || submitted) return;
            const newAnswers = { ...userAnswers, [index]: value };
            setUserAnswers(newAnswers);
            onAction?.('TYPE_ANSWER', { answers: newAnswers });
        },
        [isTeacher, submitted, userAnswers, onAction],
    );

    /** Auto-advance to next gap on Enter key */
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>, currentGapIndex: number) => {
            if (e.key !== 'Enter') return;
            const pos = gapIndices.indexOf(currentGapIndex);
            const nextGapIndex = gapIndices[pos + 1];
            if (nextGapIndex !== undefined) {
                inputRefs.current[nextGapIndex]?.focus();
            }
        },
        [gapIndices],
    );

    const checkAnswers = useCallback(() => {
        if (isTeacher) return;
        setSubmitted(true);

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

        onAction?.('CHECK_ANSWER', {
            answers: userAnswers,
            submitted: true,
            score: { correct: correctCount, total: totalGaps },
        });
    }, [isTeacher, parts, userAnswers, onAction]);

    const reset = useCallback(() => {
        setUserAnswers({});
        setSubmitted(false);
        onAction?.('RESET', {});
    }, [onAction]);

    // ── 4. DERIVED VALUES ──────────────────────────────────────────────────────
    const hasText = Boolean(content?.text);

    // Score calculation (only when submitted)
    const score = useMemo(() => {
        if (!submitted) return null;
        let correct = 0;
        parts.forEach((part, i) => {
            if (i % 2 !== 0 && userAnswers[i]?.trim().toLowerCase() === part.trim().toLowerCase()) {
                correct++;
            }
        });
        return { correct, total: gapIndices.length };
    }, [submitted, parts, userAnswers, gapIndices.length]);

    // ── 5. EMPTY / LOADING STATES ──────────────────────────────────────────────
    if (!hasText) {
        // No activity content — differentiate teacher vs student view
        return (
            <div className="flex flex-col items-center justify-center h-full gap-5 text-gray-400 p-8">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                    {isTeacher ? (
                        <MonitorPlay size={28} className="text-gray-300" />
                    ) : (
                        <Clock size={28} className="text-gray-300" />
                    )}
                </div>
                <div className="text-center">
                    <p className="text-sm font-semibold text-gray-500">
                        {isTeacher ? 'No gap-fill text configured' : 'Waiting for teacher…'}
                    </p>
                    {!isTeacher && (
                        <p className="text-xs text-gray-400 mt-1.5">
                            The teacher will start the activity shortly
                        </p>
                    )}
                </div>
            </div>
        );
    }

    // Loading state (no parts parsed yet, defensive)
    if (parts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400 p-8">
                <Loader2 size={24} className="animate-spin text-blue-500" />
                <p className="text-sm font-medium">Loading activity…</p>
            </div>
        );
    }

    // ── 6. RENDER ──────────────────────────────────────────────────────────────
    return (
        <div className="h-full flex flex-col bg-gray-50 overflow-y-auto">
            {/* ── Header card ─────────────────────────────────────────────────── */}
            <div className="shrink-0 px-5 pt-5 pb-4 bg-white border-b border-gray-100">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                        <h2 className="text-sm font-bold text-gray-900">Complete the Sentences</h2>
                        {/* Role badge */}
                        {isTeacher ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700">
                                <Eye size={11} />
                                Spectator
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-teal-100 text-teal-700">
                                Student
                            </span>
                        )}
                    </div>

                    {/* Score pill (after submission) */}
                    {submitted && score && (
                        <span
                            className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${score.correct === score.total
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : score.correct > 0
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-red-100 text-red-600'
                                }`}
                        >
                            {score.correct === score.total ? (
                                <CheckCircle2 size={12} />
                            ) : (
                                <XCircle size={12} />
                            )}
                            {score.correct}/{score.total} correct
                        </span>
                    )}
                </div>

                {/* Subtle sync hint for student */}
                {!isTeacher && !submitted && (
                    <p className="text-[11px] text-gray-400 mt-2 select-none">
                        Your answers sync with the teacher in real time · Press{' '}
                        <kbd className="font-semibold text-gray-500">Enter</kbd> to jump to next blank
                    </p>
                )}
                {isTeacher && (
                    <p className="text-[11px] text-gray-400 mt-2 select-none">
                        {submitted
                            ? 'Student has submitted their answers'
                            : "You can see the student's answers as they type"}
                    </p>
                )}
            </div>

            {/* ── Passage card ────────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col items-center justify-start p-5 md:p-6">
                <div className="w-full max-w-3xl bg-white rounded-2xl border border-gray-200 shadow-sm px-5 pt-5 pb-6 md:px-6">
                    <p
                        className="leading-[2.6] text-base md:text-lg text-gray-700 select-text"
                        aria-label="Fill in the blanks passage"
                    >
                        {parts.map((part, index) => {
                            // Even indices — plain text
                            if (index % 2 === 0) {
                                return <span key={index}>{part}</span>;
                            }

                            // Odd indices — gap (correct answer is the content of the part)
                            const correctAnswer = part;
                            const userAnswer = userAnswers[index] || '';
                            const isCorrect =
                                submitted &&
                                userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
                            const isWrong = submitted && !isCorrect;

                            const inputWidth = `${Math.max(correctAnswer.length, 3) + 2}ch`;

                            return (
                                <span key={index} className="relative inline-flex flex-col items-center mx-1 align-bottom">
                                    <input
                                        ref={(el) => { inputRefs.current[index] = el; }}
                                        type="text"
                                        value={userAnswer}
                                        onChange={(e) => handleInputChange(index, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(e, index)}
                                        disabled={isTeacher || submitted}
                                        style={{ width: inputWidth }}
                                        placeholder="___"
                                        aria-label={`Blank ${gapIndices.indexOf(index) + 1}`}
                                        className={[
                                            'text-center border-b-2 outline-none px-1 py-0.5 font-semibold text-base',
                                            'rounded-t transition-all duration-150 bg-transparent',
                                            // Idle state
                                            !submitted
                                                ? 'border-blue-300 placeholder:text-gray-300 text-gray-800 focus:border-blue-600 focus:bg-blue-50 focus:ring-0'
                                                : '',
                                            // Correct
                                            isCorrect ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : '',
                                            // Wrong
                                            isWrong ? 'border-red-400 bg-red-50 text-red-600' : '',
                                            // Disabled cursor
                                            isTeacher || submitted ? 'cursor-default' : '',
                                        ]
                                            .filter(Boolean)
                                            .join(' ')}
                                    />

                                    {/* Validation icons */}
                                    {isCorrect && (
                                        <CheckCircle2
                                            size={13}
                                            className="absolute -top-2 -right-2 text-emerald-500 bg-white rounded-full"
                                            aria-hidden="true"
                                        />
                                    )}
                                    {isWrong && (
                                        <XCircle
                                            size={13}
                                            className="absolute -top-2 -right-2 text-red-400 bg-white rounded-full"
                                            aria-hidden="true"
                                        />
                                    )}

                                    {/* Correct answer reveal below wrong blank */}
                                    {isWrong && (
                                        <span className="absolute -bottom-5 left-0 w-full text-center text-[10px] font-bold text-red-500 whitespace-nowrap">
                                            {correctAnswer}
                                        </span>
                                    )}
                                </span>
                            );
                        })}
                    </p>
                </div>

                {/* ── Action row ──────────────────────────────────────────────────── */}
                <div className="mt-6 flex flex-wrap items-center gap-3">
                    {/* STUDENT: Check Answers */}
                    {!isTeacher && !submitted && (
                        <button
                            onClick={checkAnswers}
                            disabled={Object.keys(userAnswers).length === 0}
                            className="py-2.5 px-6 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl
                         transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed
                         focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
                        >
                            Check Answers
                        </button>
                    )}

                    {/* STUDENT: Try Again after submit */}
                    {!isTeacher && submitted && (
                        <button
                            onClick={reset}
                            className="flex items-center gap-2 py-2.5 px-5 bg-gray-100 hover:bg-gray-200
                         text-gray-700 text-sm font-semibold rounded-xl transition-colors
                         focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-1"
                        >
                            <RefreshCw size={15} />
                            Try Again
                        </button>
                    )}

                    {/* TEACHER: Status indicator */}
                    {isTeacher && (
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                            <span
                                className={`w-2 h-2 rounded-full shrink-0 ${submitted ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'
                                    }`}
                            />
                            <span className="text-xs font-semibold text-gray-500">
                                {submitted ? 'Student submitted' : 'Waiting for student…'}
                            </span>
                        </div>
                    )}

                    {/* TEACHER: Reset button if submitted */}
                    {isTeacher && submitted && (
                        <button
                            onClick={reset}
                            className="flex items-center gap-2 py-2.5 px-4 text-rose-500 hover:bg-rose-50
                         text-sm font-semibold rounded-xl transition-colors
                         focus:outline-none focus:ring-2 focus:ring-rose-300 focus:ring-offset-1"
                            title="Reset student's answers"
                        >
                            <RefreshCw size={14} />
                            Reset
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});

export default GapFill;