/**
 * MatchingGame.tsx — Real-Time Result Reveal Sync
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT EVENT IS SENT ON CHECK
 *   Teacher clicks Check/Hide → `onAction('MATCH_UPDATE', { matches, resultsRevealed: true|false })`
 *   This flows through Classroom.tsx's `sendZoneAction('matching', 'MATCH_UPDATE', ...)`
 *   into the backend's `ZONE_ACTION` handler, which does `zone_state.update(payload)`.
 *   `resultsRevealed` is now a persisted field in zone_state alongside `matches`.
 *
 * WHAT STATE IS STORED / SHARED
 *   zone_state (server-side dict, in-memory): {
 *     activity_type: 'matching',
 *     action: 'MATCH_UPDATE',
 *     matches: { [questionText]: answerText },
 *     resultsRevealed: boolean          ← NEW persisted field (merged via dict.update)
 *   }
 *   The backend broadcasts this full dict as ZONE_STATE_UPDATE to all room members.
 *
 * HOW STUDENTS SWITCH FROM "WAITING" TO RESULTS VIEW
 *   The gameState useEffect now also reads `gameState.resultsRevealed`.
 *   When teacher clicks Check → server echoes back with `resultsRevealed: true` →
 *   every client's effect fires → `setShowResults(true)` → student sees green/red
 *   highlights and the score banner immediately. The "Waiting for teacher…" text
 *   is inside `{!isTeacher && !showResults && …}` so it disappears automatically.
 *
 * LATE JOINERS
 *   Handled automatically: on connect the backend sends the full zone_state as
 *   ZONE_STATE_UPDATE. The gameState effect reads both `matches` AND `resultsRevealed`
 *   from that snapshot, so a late-joining student sees the revealed state immediately.
 *
 * LOOP PREVENTION
 *   - matches: existing `lastServerMatchStr` ref (unchanged).
 *   - resultsRevealed: teacher's optimistic `setShowResults` is idempotent when the
 *     echo arrives (React skips re-renders for unchanged state). No extra ref needed.
 *
 * EXISTING SYNC SCHEMA — UNCHANGED
 *   • Event name: 'MATCH_UPDATE' — unchanged.
 *   • payload.matches structure — unchanged.
 *   • handleDragStart / handleDragOver / handleDrop / handleRemove — unchanged.
 *   • lastServerMatchStr echo-prevention ref — unchanged.
 *   • Backward compatible: old zone_state without `resultsRevealed` handled by
 *     `typeof gameState.resultsRevealed === 'boolean'` guard (undefined → skipped).
 *
 * CHANGES IN THIS REVISION
 *   1. gameState useEffect: added `resultsRevealed` branch → `setShowResults`.
 *   2. handleCheckToggle: extracted from inline onClick; now broadcasts
 *      `onAction('MATCH_UPDATE', { matches, resultsRevealed: nextRevealed })`.
 *   3. handleReset: now broadcasts `{ matches: {}, resultsRevealed: false }`.
 *   4. Student score banner: shows "X of Y correct!" when `showResults` becomes
 *      true (was previously only visible to teacher).
 *   5. All UI/styling unchanged from previous redesign.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Puzzle, X, Check, RotateCcw, Eye, EyeOff, Trophy, GripHorizontal,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchingPair {
    id: number;
    left: string;
    right: string;
}

interface MatchingGameProps {
    content: {
        pairs?: MatchingPair[];
    };
    isTeacher: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gameState?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onAction?: (action: string, data: any) => void;
}

type StatusKind = 'ready' | 'progress' | 'finished';

// ─── StatusBadge ──────────────────────────────────────────────────────────────

const StatusBadge = React.memo(function StatusBadge({ status }: { status: StatusKind }) {
    if (status === 'finished') {
        return (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                <Check size={11} aria-hidden="true" /> Finished
            </span>
        );
    }
    if (status === 'progress') {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" aria-hidden="true" />
                In Progress
            </span>
        );
    }
    return (
        <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
            Ready
        </span>
    );
});

// ─── AnswerChip — memoized, draggable + click-selectable ─────────────────────

interface AnswerChipProps {
    text: string;
    isSelected: boolean;
    onClick: () => void;
    onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
}

const AnswerChip = React.memo(function AnswerChip({
    text, isSelected, onClick, onDragStart,
}: AnswerChipProps) {
    return (
        <div
            draggable
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            aria-label={`Answer: ${text}${isSelected ? ' — selected, click a question box to place' : ''}`}
            onDragStart={onDragStart}
            onClick={onClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
            }}
            className={`
                flex items-center gap-2 px-3.5 py-2.5 rounded-xl border-2
                cursor-pointer select-none text-sm font-semibold leading-tight
                transition-all duration-150 active:scale-95
                focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1
                ${isSelected
                    ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm'
                }
            `}
        >
            <GripHorizontal
                size={13}
                className={`shrink-0 ${isSelected ? 'text-blue-400' : 'text-gray-300'}`}
                aria-hidden="true"
            />
            <span>{text}</span>
        </div>
    );
});

// ─── QuestionRow — memoized; handles drop zone visual states ─────────────────

interface QuestionRowProps {
    pair: MatchingPair;
    currentMatch: string | undefined;
    isRevealed: boolean;
    isCorrect: boolean;
    isDragHovered: boolean;
    canClickPlace: boolean;
    onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
    onDragLeave: () => void;
    onClickZone: () => void;
    onRemove: () => void;
}

const QuestionRow = React.memo(function QuestionRow({
    pair, currentMatch, isRevealed, isCorrect, isDragHovered,
    canClickPlace, onDrop, onDragOver, onDragLeave, onClickZone, onRemove,
}: QuestionRowProps) {
    // ── Drop zone visual state derivation ──────────────────────────────────
    let zoneClass: string;
    if (currentMatch) {
        if (isRevealed) {
            zoneClass = isCorrect
                ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                : 'border-red-400 bg-red-50 text-red-800 ring-2 ring-red-100';
        } else {
            zoneClass = 'border-blue-400 bg-blue-50 text-blue-800 shadow-sm';
        }
    } else if (isDragHovered || canClickPlace) {
        zoneClass = 'border-blue-400 bg-blue-50/60 border-dashed';
    } else {
        zoneClass = 'border-gray-200 border-dashed bg-gray-50/40 hover:border-gray-300';
    }

    return (
        <div className="flex items-stretch gap-3">

            {/* Question card */}
            <div className="flex-[2] min-w-0 bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center shadow-sm">
                <span className="text-sm font-semibold text-gray-800 leading-relaxed">
                    {pair.left}
                </span>
            </div>

            {/* Arrow connector — desktop only */}
            <div
                className="hidden sm:flex items-center text-gray-300 shrink-0 select-none"
                aria-hidden="true"
            >
                <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                    <path
                        d="M1 6H15M10 1L15 6L10 11"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </div>

            {/* Drop zone */}
            <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={onClickZone}
                aria-label={
                    currentMatch
                        ? `${pair.left} matched with "${currentMatch}"${isRevealed ? (isCorrect ? ' — correct' : ' — incorrect') : ''}`
                        : `Drop zone for "${pair.left}". ${canClickPlace ? 'Click to place selected answer.' : 'Drag an answer here.'}`
                }
                aria-dropeffect="move"
                className={`
                    flex-[3] min-h-[52px] rounded-xl border-2 flex items-center
                    transition-all duration-150
                    ${zoneClass}
                    ${canClickPlace ? 'cursor-pointer' : ''}
                `}
            >
                {currentMatch ? (
                    <div className="w-full flex items-center justify-between px-4 gap-2">
                        <span className="text-sm font-semibold leading-relaxed min-w-0 truncate">
                            {currentMatch}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                            {isRevealed ? (
                                isCorrect
                                    ? <Check size={15} className="text-emerald-600" aria-hidden="true" />
                                    : <X size={15} className="text-red-500" aria-hidden="true" />
                            ) : (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                                    aria-label={`Remove match: "${currentMatch}"`}
                                    className="p-1 rounded-lg text-blue-400 opacity-60 hover:opacity-100 hover:bg-white/60 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-400"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="w-full px-4 flex justify-center">
                        <span className={`
                            text-[11px] font-bold uppercase tracking-wide
                            ${canClickPlace || isDragHovered ? 'text-blue-500' : 'text-gray-300'}
                        `}>
                            {canClickPlace ? 'Click to place' : 'Drop here'}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
});

// ─── MatchingEmptyState ───────────────────────────────────────────────────────

function MatchingEmptyState({ isTeacher }: { isTeacher: boolean }) {
    return (
        <div className="h-full flex flex-col items-center justify-center gap-4 text-gray-400 p-8">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                <Puzzle size={26} className="text-gray-300" aria-hidden="true" />
            </div>
            <div className="text-center">
                <p className="text-sm font-semibold text-gray-500">
                    {isTeacher ? 'No pairs configured' : 'Waiting for teacher…'}
                </p>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    {isTeacher
                        ? 'Add question / answer pairs to this activity in the lesson builder.'
                        : 'The teacher is preparing the matching activity.'}
                </p>
            </div>
        </div>
    );
}

// ─── Main MatchingGame component ──────────────────────────────────────────────

function MatchingGame({ content, isTeacher, gameState, onAction }: MatchingGameProps) {
    const pairs = content.pairs || [];

    // ── State ─────────────────────────────────────────────────────────────────
    const [matches, setMatches] = useState<Record<string, string>>({});
    /**
     * showResults: now a SYNCHRONIZED flag. Teacher broadcasts it via MATCH_UPDATE;
     * all clients (including students) receive it via gameState.resultsRevealed.
     * Previously it was teacher-local only.
     */
    const [showResults, setShowResults] = useState(false);

    // UI-only state (not synced)
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState<string | null>(null);

    // ── Sync — echo-prevention ref for matches (unchanged) ────────────────────
    const lastServerMatchStr = useRef<string>('');

    /**
     * gameState effect — UPDATED:
     * Now also reads `gameState.resultsRevealed` (boolean) in addition to
     * `gameState.matches`. Both fields are stored in zone_state by the backend
     * and broadcast together as ZONE_STATE_UPDATE.
     *
     * Guard: `typeof … === 'boolean'` means absent/undefined (old snapshots without
     * the field) are silently ignored → full backward compatibility.
     */
    useEffect(() => {
        if (!gameState) return;

        // ── matches sync (logic unchanged) ──────────────────────────────────
        if (gameState.matches !== undefined) {
            const newMatchStr = JSON.stringify(gameState.matches);
            if (newMatchStr !== lastServerMatchStr.current) {
                lastServerMatchStr.current = newMatchStr;
                setMatches(gameState.matches);
            }
        }

        // ── resultsRevealed sync (NEW) ───────────────────────────────────────
        // Teacher broadcasts this when pressing Check/Hide/Reset.
        // React's state batching makes this echo-safe: if we already have the
        // same boolean value, no re-render is triggered.
        if (typeof gameState.resultsRevealed === 'boolean') {
            setShowResults(gameState.resultsRevealed);
        }
    }, [gameState]);

    // ── Helper: is a given question/answer pair correct? ──────────────────────
    const isCorrectFn = useCallback((question: string, answer: string): boolean => {
        const pair = pairs.find(p => p.left === question);
        return pair ? pair.right === answer : false;
    }, [pairs]);

    // ── Drag & Drop handlers (logic unchanged; wrapped in useCallback) ─────────
    const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, answerText: string) => {
        e.dataTransfer.setData('text/plain', answerText);
        e.dataTransfer.effectAllowed = 'move';
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>, questionText: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOver(questionText);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragOver(null);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>, questionText: string) => {
        e.preventDefault();
        setDragOver(null);
        const answerText = e.dataTransfer.getData('text/plain');
        if (!answerText) return;

        const newMatches = { ...matches, [questionText]: answerText };
        setMatches(newMatches);

        if (onAction) {
            onAction('MATCH_UPDATE', { matches: newMatches });
        }
    }, [matches, onAction]);

    const handleRemove = useCallback((questionText: string) => {
        const newMatches = { ...matches };
        delete newMatches[questionText];
        setMatches(newMatches);

        if (onAction) {
            onAction('MATCH_UPDATE', { matches: newMatches });
        }
    }, [matches, onAction]);

    // ── Click-to-match (UI-only; same MATCH_UPDATE event) ─────────────────────
    const handleSelectAnswer = useCallback((ans: string) => {
        setSelectedAnswer(prev => prev === ans ? null : ans);
    }, []);

    const handleClickZone = useCallback((questionText: string) => {
        if (!selectedAnswer || matches[questionText]) return;
        const newMatches = { ...matches, [questionText]: selectedAnswer };
        setMatches(newMatches);
        setSelectedAnswer(null);

        if (onAction) {
            onAction('MATCH_UPDATE', { matches: newMatches });
        }
    }, [selectedAnswer, matches, onAction]);

    /**
     * handleCheckToggle — UPDATED (was an inline onClick).
     *
     * Now broadcasts `resultsRevealed` as part of MATCH_UPDATE so the backend
     * merges it into zone_state and broadcasts it to all room members.
     *
     * Payload: { matches: <current snapshot>, resultsRevealed: <next boolean> }
     * Including `matches` in the payload ensures zone_state has a coherent
     * snapshot — both the answers and the reveal flag together — which late
     * joiners will receive as a single ZONE_STATE_UPDATE on connect.
     *
     * Teacher UX is unchanged: button appearance toggles Check ↔ Hide as before.
     */
    const handleCheckToggle = useCallback(() => {
        const nextRevealed = !showResults;
        // Optimistic local update (teacher sees it immediately)
        setShowResults(nextRevealed);
        if (onAction) {
            onAction('MATCH_UPDATE', { matches, resultsRevealed: nextRevealed });
        }
    }, [showResults, matches, onAction]);

    /**
     * handleReset — UPDATED.
     * Now also broadcasts `resultsRevealed: false` so students see the board
     * reset to its unrevealed state when teacher resets.
     */
    const handleReset = useCallback(() => {
        const newMatches: Record<string, string> = {};
        setMatches(newMatches);
        setShowResults(false);
        setSelectedAnswer(null);

        if (onAction) {
            onAction('MATCH_UPDATE', { matches: newMatches, resultsRevealed: false });
        }
    }, [onAction]);

    // ── Derived values ────────────────────────────────────────────────────────
    const availableAnswers = pairs
        .map(p => p.right)
        .filter(ans => !Object.values(matches).includes(ans))
        .sort();

    const matchedCount = Object.keys(matches).length;
    const allMatched   = pairs.length > 0 && matchedCount === pairs.length;
    const status: StatusKind = allMatched ? 'finished' : matchedCount > 0 ? 'progress' : 'ready';

    // correctCount is only meaningful once results are revealed
    const correctCount = showResults
        ? Object.keys(matches).filter(q => isCorrectFn(q, matches[q])).length
        : 0;

    // ── Early exit: no pairs configured ───────────────────────────────────────
    if (pairs.length === 0) return <MatchingEmptyState isTeacher={isTeacher} />;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="h-full bg-gray-50 overflow-y-auto">
            <div className="w-full max-w-4xl mx-auto p-4 md:p-6 pb-8">

                {/* ══ CARD ════════════════════════════════════════════════════ */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

                    {/* ── HEADER ──────────────────────────────────────────── */}
                    <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">

                        {/* Left: icon + title + progress */}
                        <div className="flex items-center gap-3">
                            <div
                                className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0"
                                aria-hidden="true"
                            >
                                <Puzzle size={17} className="text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-gray-900 leading-tight">
                                    Matching
                                </h2>
                                <p className="text-[11px] text-gray-400 mt-0.5 tabular-nums">
                                    {matchedCount} of {pairs.length} matched
                                </p>
                            </div>
                        </div>

                        {/* Right: badge + teacher controls */}
                        <div className="flex items-center gap-2 shrink-0">

                            {/* Badge: Teacher View (violet) vs student status */}
                            {isTeacher ? (
                                <span className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700">
                                    Teacher View
                                </span>
                            ) : (
                                <StatusBadge status={status} />
                            )}

                            {/* Teacher-only controls */}
                            {isTeacher && (
                                <>
                                    <div className="w-px h-4 bg-gray-200 mx-0.5" aria-hidden="true" />

                                    {/* Reset — broadcasts MATCH_UPDATE with empty matches + resultsRevealed:false */}
                                    <button
                                        onClick={handleReset}
                                        aria-label="Reset all matches"
                                        title="Reset all matches"
                                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
                                    >
                                        <RotateCcw size={12} aria-hidden="true" />
                                        <span className="hidden sm:inline">Reset</span>
                                    </button>

                                    {/* Check / Hide — broadcasts resultsRevealed to all clients */}
                                    <button
                                        onClick={handleCheckToggle}
                                        aria-label={showResults ? 'Hide correct answers' : 'Reveal correct answers'}
                                        title={showResults ? 'Hide correct answers' : 'Reveal correct answers'}
                                        className={`
                                            flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold
                                            transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1
                                            ${showResults
                                                ? 'bg-blue-600 text-white'
                                                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                                            }
                                        `}
                                    >
                                        {showResults
                                            ? <EyeOff size={12} aria-hidden="true" />
                                            : <Eye size={12} aria-hidden="true" />
                                        }
                                        <span className="hidden sm:inline">
                                            {showResults ? 'Hide' : 'Check'}
                                        </span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── FINISHED BANNER ─────────────────────────────────── */}
                    {/*
                      * Visible to BOTH teacher and student once allMatched.
                      * Color/content adapts when showResults is true:
                      *   - !showResults → blue  "All X pairs placed!"
                      *                  + student sees "Waiting for teacher…"
                      *   - showResults  → emerald/amber  "X of Y correct!"
                      *
                      * The "Waiting…" text disappears as soon as showResults
                      * becomes true (via sync from teacher's Check action).
                      */}
                    {allMatched && (
                        <div
                            className={`
                                flex items-center gap-3 px-5 py-3 border-b border-gray-100
                                ${showResults
                                    ? correctCount === pairs.length ? 'bg-emerald-50' : 'bg-amber-50'
                                    : 'bg-blue-50'
                                }
                            `}
                            role="status"
                            aria-live="polite"
                        >
                            <Trophy
                                size={15}
                                className={
                                    showResults
                                        ? correctCount === pairs.length ? 'text-emerald-500' : 'text-amber-500'
                                        : 'text-blue-500'
                                }
                                aria-hidden="true"
                            />
                            <p className={`text-sm font-semibold ${
                                showResults
                                    ? correctCount === pairs.length ? 'text-emerald-700' : 'text-amber-700'
                                    : 'text-blue-700'
                            }`}>
                                {showResults
                                    ? `${correctCount} of ${pairs.length} correct!`
                                    : `All ${pairs.length} pairs placed!`
                                }
                            </p>
                            {/* "Waiting…" only shown when not yet revealed — vanishes on Check */}
                            {!isTeacher && !showResults && (
                                <p className="text-xs text-blue-500 font-medium ml-1">
                                    Waiting for teacher to reveal answers.
                                </p>
                            )}
                        </div>
                    )}

                    {/* ── BODY ────────────────────────────────────────────── */}
                    <div className="flex flex-col lg:flex-row">

                        {/* LEFT: Questions + Drop zones */}
                        <div className="flex-1 min-w-0 p-5 md:p-6 space-y-3">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">
                                Questions
                            </p>

                            {pairs.map((pair) => {
                                const currentMatch  = matches[pair.left];
                                const correct       = currentMatch ? isCorrectFn(pair.left, currentMatch) : false;
                                const canClickPlace = !!selectedAnswer && !currentMatch;

                                return (
                                    <QuestionRow
                                        key={pair.id}
                                        pair={pair}
                                        currentMatch={currentMatch}
                                        isRevealed={showResults}
                                        isCorrect={correct}
                                        isDragHovered={dragOver === pair.left}
                                        canClickPlace={canClickPlace}
                                        onDrop={(e) => handleDrop(e, pair.left)}
                                        onDragOver={(e) => handleDragOver(e, pair.left)}
                                        onDragLeave={handleDragLeave}
                                        onClickZone={() => handleClickZone(pair.left)}
                                        onRemove={() => handleRemove(pair.left)}
                                    />
                                );
                            })}
                        </div>

                        {/* Dividers */}
                        <div className="hidden lg:block w-px bg-gray-100 my-5 shrink-0" aria-hidden="true" />
                        <div className="lg:hidden h-px bg-gray-100 mx-5 shrink-0" aria-hidden="true" />

                        {/* RIGHT: Answer Bank */}
                        <div className="lg:w-64 shrink-0 p-5 md:p-6">
                            <div className="lg:sticky lg:top-5 space-y-3">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    Answer Bank
                                </p>

                                {availableAnswers.length === 0 ? (
                                    /* All placed — empty state */
                                    <div
                                        className="flex flex-col items-center justify-center py-8 gap-2 bg-gray-50 rounded-xl border border-dashed border-gray-200"
                                        aria-label="All answers have been placed"
                                    >
                                        <Check size={20} className="text-emerald-400" aria-hidden="true" />
                                        <p className="text-xs font-semibold text-gray-400">All placed</p>
                                    </div>
                                ) : (
                                    /* Answer chips */
                                    <div
                                        className="flex flex-wrap gap-2"
                                        role="group"
                                        aria-label="Available answers — drag or click to select"
                                    >
                                        {availableAnswers.map((ans, idx) => (
                                            <AnswerChip
                                                key={idx}
                                                text={ans}
                                                isSelected={selectedAnswer === ans}
                                                onClick={() => handleSelectAnswer(ans)}
                                                onDragStart={(e) => handleDragStart(e, ans)}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Contextual instruction hint */}
                                {availableAnswers.length > 0 && (
                                    <p className={`
                                        text-[11px] leading-relaxed transition-colors duration-200
                                        ${selectedAnswer ? 'text-blue-500 font-medium' : 'text-gray-300'}
                                    `}>
                                        {selectedAnswer
                                            ? 'Now click an empty question box to place this answer.'
                                            : 'Drag or click an answer, then click a question box to match.'
                                        }
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default React.memo(MatchingGame);
