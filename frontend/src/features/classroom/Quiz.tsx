/**
 * Quiz.tsx — UI Redesign
 * ──────────────────────
 * Changes (UI only — zero logic changes):
 *  • Matches Classroom.tsx design system: bg-gray-50 page, bg-white rounded-2xl
 *    border-gray-200 shadow-sm card, same header/footer structure, same badges,
 *    same button styles, same focus rings throughout.
 *  • Option buttons: lettered labels (A / B / C / D), three visual states —
 *    default / selected-pending / revealed (correct | wrong-selected | neutral).
 *  • Header: icon pill + title + role badge (Teacher violet / Student teal /
 *    Correct emerald / Incorrect red) — updates live as state changes.
 *  • Footer student: Submit button → result banner (correct / incorrect) with
 *    full explanation text.
 *  • Footer teacher: read-only notice explaining always-revealed behavior.
 *  • Empty state: clean panel with icon for missing question data (replaces
 *    bare text div).
 *  • Results bar: CSS-only accuracy strip shown after student submission.
 *  • OptionButton extracted as memoized internal sub-component (purely
 *    presentational — no props touching logic).
 *  • Quiz default export wrapped in React.memo.
 *  • Full ARIA: role="group" on options list, aria-pressed per option,
 *    aria-label on submit/options, role="status" on result banner,
 *    aria-live="polite" on result.
 *  • Responsive: max-w-2xl centered panel; p-4/p-5 mobile → p-6 md+.
 *
 * Logic preserved exactly:
 *  • Props: content: { question?, options?, correct_index? }, isTeacher: boolean
 *  • State: selectedIndex (null | number), submitted (boolean)
 *  • handleSelect: blocked when submitted && !isTeacher — unchanged
 *  • handleSubmit: setSubmitted(true) — unchanged
 *  • Teacher always sees correct answer; student sees only after submit
 *
 * Assumptions:
 *  • No shared UI component library — primitives inline in each file
 *    (matching Classroom.tsx pattern).
 *  • No /classroom/ui/ folder exists — sub-components appended below in
 *    this same file.
 *  • Tailwind CSS v3 (no animation plugin). animate-pulse is core Tailwind.
 *  • React 19 JSX transform — no default React import needed.
 */

import { useState, memo, useCallback } from 'react';
import { Check, X, ListChecks, Eye } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuizProps {
    content: {
        // Flat structure from Builder — unchanged
        question?: string;
        options?: string[];
        correct_index?: number;
    };
    isTeacher: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Letter labels for up to 6 options — mirrors standard quiz convention. */
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

// ─── OptionButton — memoized, purely presentational ──────────────────────────

interface OptionButtonProps {
    label: string;        // "A", "B", …
    text: string;         // option content
    isSelected: boolean;
    isCorrect: boolean;
    isRevealed: boolean;  // true when teacher view OR student has submitted
    onClick: () => void;
}

const OptionButton = memo(function OptionButton({
    label,
    text,
    isSelected,
    isCorrect,
    isRevealed,
    onClick,
}: OptionButtonProps) {
    // ── Visual state derivation ──────────────────────────────────────────────
    let rowClass: string;
    let labelClass: string;

    if (isRevealed) {
        if (isCorrect) {
            // Correct answer — always highlighted green when revealed
            rowClass = 'border-emerald-400 bg-emerald-50 text-emerald-800';
            labelClass = 'bg-emerald-500 text-white';
        } else if (isSelected) {
            // Student's wrong pick
            rowClass = 'border-red-300 bg-red-50 text-red-700 opacity-70';
            labelClass = 'bg-red-400 text-white';
        } else {
            // Non-selected, non-correct — dim after reveal
            rowClass = 'border-gray-100 bg-gray-50 text-gray-400';
            labelClass = 'bg-gray-200 text-gray-400';
        }
    } else if (isSelected) {
        // Student actively selecting (before submit)
        rowClass = 'border-blue-400 bg-blue-50 text-blue-800';
        labelClass = 'bg-blue-500 text-white';
    } else {
        // Default idle
        rowClass = 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50';
        labelClass = 'bg-gray-100 text-gray-500';
    }

    return (
        <button
            onClick={onClick}
            aria-pressed={isSelected}
            aria-label={`Option ${label}: ${text}${isRevealed && isCorrect ? ' — correct answer' : ''}`}
            className={`
                w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left
                transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1
                ${rowClass}
            `}
        >
            {/* Letter badge */}
            <span
                className={`
                    w-7 h-7 rounded-lg flex items-center justify-center
                    text-xs font-bold shrink-0 transition-colors
                    ${labelClass}
                `}
                aria-hidden="true"
            >
                {label}
            </span>

            {/* Option text */}
            <span className="flex-1 text-sm font-medium leading-relaxed">
                {text}
            </span>

            {/* Trailing icon — only visible when revealed */}
            {isRevealed && isCorrect && (
                <Check size={15} className="text-emerald-600 shrink-0" aria-hidden="true" />
            )}
            {isRevealed && isSelected && !isCorrect && (
                <X size={15} className="text-red-500 shrink-0" aria-hidden="true" />
            )}
        </button>
    );
});

// ─── QuizEmptyState — no question configured ─────────────────────────────────

function QuizEmptyState() {
    return (
        <div className="h-full flex flex-col items-center justify-center gap-4 text-gray-400 p-8">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                <ListChecks size={26} className="text-gray-300" aria-hidden="true" />
            </div>
            <div className="text-center">
                <p className="text-sm font-semibold text-gray-500">No quiz data</p>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    This activity has no question configured.
                </p>
            </div>
        </div>
    );
}

// ─── ResultBanner — shown in footer after student submits ─────────────────────

function ResultBanner({
    isCorrect,
    correctOptionText,
}: {
    isCorrect: boolean;
    correctOptionText: string;
}) {
    return (
        <div
            className={`
                flex items-start gap-3 p-4 rounded-xl border
                ${isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}
            `}
            role="status"
            aria-live="polite"
        >
            {/* Icon */}
            <div
                className={`
                    w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                    ${isCorrect ? 'bg-emerald-100' : 'bg-red-100'}
                `}
                aria-hidden="true"
            >
                {isCorrect
                    ? <Check size={18} className="text-emerald-600" />
                    : <X size={18} className="text-red-500" />
                }
            </div>

            {/* Text */}
            <div className="min-w-0 flex-1">
                <p className={`text-sm font-bold ${isCorrect ? 'text-emerald-700' : 'text-red-600'}`}>
                    {isCorrect ? 'Correct!' : 'Incorrect'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    {isCorrect
                        ? 'Great job — you selected the right answer.'
                        : `The correct answer was: ${correctOptionText}`
                    }
                </p>

                {/* CSS-only accuracy bar: full-width = 100%, filled portion = correct or not */}
                <div className="mt-2.5 h-1.5 rounded-full bg-gray-200 overflow-hidden" aria-hidden="true">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${
                            isCorrect ? 'bg-emerald-400 w-full' : 'bg-red-400 w-0'
                        }`}
                    />
                </div>
            </div>
        </div>
    );
}

// ─── Main Quiz component ──────────────────────────────────────────────────────

function Quiz({ content, isTeacher }: QuizProps) {

    // ── State (logic unchanged) ───────────────────────────────────────────────
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [submitted, setSubmitted] = useState(false);

    // ── Data (logic unchanged) ────────────────────────────────────────────────
    const options = content.options || [];
    const correctIndex = content.correct_index ?? -1;

    // ── Handlers (logic unchanged; wrapped in useCallback for perf) ───────────
    const handleSelect = useCallback((idx: number) => {
        if (submitted && !isTeacher) return;
        setSelectedIndex(idx);
    }, [submitted, isTeacher]);

    const handleSubmit = useCallback(() => {
        setSubmitted(true);
    }, []);

    // ── Early exit: no question data ──────────────────────────────────────────
    if (!content.question) return <QuizEmptyState />;

    // ── Derived display values (logic unchanged) ──────────────────────────────
    // Teacher always sees the answer; student sees only after submitting
    const isRevealed = isTeacher || submitted;
    const isAnswerCorrect = selectedIndex !== null && selectedIndex === correctIndex;
    const correctOptionText = correctIndex >= 0 ? (options[correctIndex] ?? '') : '';

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="h-full bg-gray-50 flex items-start justify-center p-4 md:p-8 overflow-y-auto">
            <div className="w-full max-w-2xl bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden my-auto">

                {/* ══ HEADER ═══════════════════════════════════════════════════ */}
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">

                    {/* Left: icon + title */}
                    <div className="flex items-center gap-3">
                        <div
                            className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0"
                            aria-hidden="true"
                        >
                            <ListChecks size={17} className="text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-900 leading-tight">
                                Quiz
                            </h2>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                                {options.length}{' '}
                                {options.length === 1 ? 'option' : 'options'}
                            </p>
                        </div>
                    </div>

                    {/* Right: adaptive badge */}
                    <div className="flex items-center gap-2 shrink-0">
                        {isTeacher ? (
                            <span className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700">
                                Teacher View
                            </span>
                        ) : submitted ? (
                            <span
                                className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                                    isAnswerCorrect
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-red-100 text-red-600'
                                }`}
                            >
                                {isAnswerCorrect
                                    ? <><Check size={11} aria-hidden="true" /> Correct</>
                                    : <><X size={11} aria-hidden="true" /> Incorrect</>
                                }
                            </span>
                        ) : (
                            <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-100 text-teal-700">
                                Student
                            </span>
                        )}
                    </div>
                </div>

                {/* ══ BODY ═════════════════════════════════════════════════════ */}
                <div className="px-5 pt-5 pb-1 md:px-6 md:pt-6">

                    {/* Question text */}
                    <p className="text-base font-semibold text-gray-900 leading-relaxed mb-5">
                        {content.question}
                    </p>

                    {/* Options list */}
                    <div
                        className="space-y-2.5"
                        role="group"
                        aria-label="Answer options"
                    >
                        {options.map((opt, idx) => (
                            <OptionButton
                                key={idx}
                                label={OPTION_LABELS[idx] ?? String(idx + 1)}
                                text={opt}
                                isSelected={selectedIndex === idx}
                                isCorrect={correctIndex === idx}
                                isRevealed={isRevealed}
                                onClick={() => handleSelect(idx)}
                            />
                        ))}
                    </div>
                </div>

                {/* ══ FOOTER ═══════════════════════════════════════════════════ */}
                <div className="px-5 pt-4 pb-5 md:px-6 md:pb-6 space-y-3">

                    {/* Student — before submit: Submit button */}
                    {!isTeacher && !submitted && (
                        <button
                            onClick={handleSubmit}
                            disabled={selectedIndex === null}
                            aria-label="Submit your answer"
                            className="
                                w-full py-3 bg-blue-600 hover:bg-blue-700
                                text-white text-sm font-bold rounded-xl
                                transition-colors shadow-sm
                                disabled:opacity-40 disabled:cursor-not-allowed
                                focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1
                            "
                        >
                            Submit Answer
                        </button>
                    )}

                    {/* Student — after submit: result banner */}
                    {!isTeacher && submitted && (
                        <ResultBanner
                            isCorrect={isAnswerCorrect}
                            correctOptionText={correctOptionText}
                        />
                    )}

                    {/* Teacher — always-visible read-only notice */}
                    {isTeacher && (
                        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                            <Eye
                                size={13}
                                className="shrink-0 text-gray-400"
                                aria-hidden="true"
                            />
                            <p className="text-xs text-gray-400 leading-relaxed">
                                Correct answer is always highlighted in your view.
                                Students see the result only after submitting.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default memo(Quiz);
