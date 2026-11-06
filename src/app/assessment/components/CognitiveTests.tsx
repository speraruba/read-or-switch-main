"use client";
import TestSkip from "@/app/components/TestSkip";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import { isStudyVisible } from "@/lib/study-display";
import { getApiPath } from "@/lib/api";

interface CognitiveTestsProps {
    participantId: string;
    onComplete: () => void;
}

interface LetterResponseData {
    problemId: number;
    response: "S" | "D";
    isCorrect: boolean;
    reactionTimeMs: number;
}

interface VocabQuestion {
    id: number;
    word: string;
    options: string[];
    correctOption: number;
}

interface VocabResponseData {
    questionId: number;
    responseVal: string;
    isCorrect: boolean;
    reactionTimeMs: number;
}


// New data structure for multiple rounds
const LETTER_COMPARISON_ROUNDS: Record<number, Array<{ left: string; right: string; answer: "S" | "D" }>> = {
    1: [
        { "left": "PRDBZTYFN", "right": "PRDBZTYFN", "answer": "S" },
        { "left": "NCWJDZ", "right": "NCMJDZ", "answer": "D" },
        { "left": "KHW", "right": "KBW", "answer": "D" },
        { "left": "ZRBGMF", "right": "ZRBCMF", "answer": "D" },
        { "left": "BTH", "right": "BYH", "answer": "D" },
        { "left": "XWKQRYCNZ", "right": "XWKQRYCNZ", "answer": "S" },
        { "left": "HNPDLK", "right": "HNPDLK", "answer": "S" },
        { "left": "WMQTRSGLZ", "right": "WMQTRZGLZ", "answer": "D" },
        { "left": "JPN", "right": "JPN", "answer": "S" },
        { "left": "QLXSVT", "right": "QLNSVT", "answer": "D" },
    ],
    2: [
        { "left": "YXHKZVFPB", "right": "YXHKZVFPD", "answer": "D" },
        { "left": "RJZ", "right": "RJZ", "answer": "S" },
        { "left": "CLNPZD", "right": "CLNPZD", "answer": "S" },
        { "left": "DCBPFHXYJ", "right": "DCBPFHXYJ", "answer": "S" },
        { "left": "MWR", "right": "ZWR", "answer": "D" },
        { "left": "LPKXZW", "right": "LPKXZW", "answer": "S" },
        { "left": "TZL", "right": "TZQ", "answer": "D" },
        { "left": "CSDBFPHXZ", "right": "CSDBFPHXZ", "answer": "S" },
        { "left": "QHZXPC", "right": "QHZWPC", "answer": "D" },
        { "left": "JNWXHPFBD", "right": "JNWXHPFMD", "answer": "D" },
    ],
};


export default function CognitiveTests({ participantId, onComplete }: CognitiveTestsProps): React.JSX.Element | null {
    const [subPhase, setSubPhase] = useState<"letter-instructions" | "letter" | "vocab-instructions" | "vocab">("letter-instructions");
    const savingRef = useRef(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingVocab, setIsLoadingVocab] = useState(false);
    const [vocabError, setVocabError] = useState(false);

    // Letter Test State
    const [activeLetterId, setActiveLetterId] = useState(1);
    const letterReadyRef = useRef(true);
    const activePairRef = useRef<HTMLDivElement>(null);
    const [currentRound, setCurrentRound] = useState<number>(1);
    const [letterResponses, setLetterResponses] = useState<Record<number, string>>({}); // Keyed by absolute ID (1-20)
    const [letterData, setLetterData] = useState<LetterResponseData[]>([]);
    const [startTime, setStartTime] = useState<number>(0);

    const roundDurations = useRef<Record<number, number>>({});
    const submissionId = useRef<string | null>(null);

    // Verbal Task state
    const [vocabQuestions, setVocabQuestions] = useState<VocabQuestion[]>([]);
    const [vocabResponses, setVocabResponses] = useState<Record<number, string>>({});
    const [vocabData, setVocabData] = useState<VocabResponseData[]>([]);

    // Initialize timing when entering a phase
    const startLetterRound = (timestamp: number) => {
        submissionId.current ??= crypto.randomUUID();
        setSubPhase("letter");
        setStartTime(timestamp);
        window.scrollTo(0, 0);
    };

    // Load questions on the rules page; timing starts only when the task starts.
    const fetchVocabQuestions = async () => {
        setIsLoadingVocab(true);
        setVocabError(false);
        try {
            const res = await fetch(getApiPath("/api/part-a/cognitive/vocab"));
            if (!res.ok) throw new Error("Failed to load vocabulary questions");
            const data = await res.json();
            if (!Array.isArray(data.questions) || data.questions.length === 0) throw new Error("Vocabulary questions are unavailable");
            setVocabQuestions(data.questions);
        } catch (e) {
            console.error("Failed to fetch vocab questions", e);
            setVocabError(true);
        } finally {
            setIsLoadingVocab(false);
        }
    };

    const startVocab = (timestamp: number) => {
        setSubPhase("vocab");
        setStartTime(timestamp);
        window.scrollTo(0, 0);
    };

    const handleLetterResponse = useCallback((timestamp: number, absoluteId: number, val: "S" | "D", problem: { left: string; right: string; answer: "S" | "D" }) => {
        if (savingRef.current || !letterReadyRef.current || !isStudyVisible()) return;
        letterReadyRef.current = false;
        const reactionTime = startTime ? Math.max(0, Math.round(timestamp - startTime)) : 0;
        const updated = { ...letterResponses, [absoluteId]: val };
        setLetterResponses(updated);
        setLetterData(previous => [...previous.filter(item => item.problemId !== absoluteId), {
            problemId: absoluteId, response: val, isCorrect: val === problem.answer, reactionTimeMs: reactionTime,
        }]);
        const nextIndex = LETTER_COMPARISON_ROUNDS[currentRound].findIndex((_, index) => !updated[(currentRound - 1) * 10 + index + 1]);
        setActiveLetterId(nextIndex === -1 ? 0 : (currentRound - 1) * 10 + nextIndex + 1);
    }, [startTime, letterResponses, currentRound]);

    useLayoutEffect(() => {
        letterReadyRef.current = true;
        if (subPhase === "letter") {
            activePairRef.current?.focus({ preventScroll: true });
            activePairRef.current?.scrollIntoView({ block: "center" });
        }
    }, [activeLetterId, subPhase, letterResponses]);

    const nextLetterRound = useCallback(() => {
        setActiveLetterId(currentRound * 10 + 1);
        setCurrentRound(prev => prev + 1);
        setSubPhase("letter-instructions");
        window.scrollTo(0, 0);
    }, [currentRound]);

    const startVocabInstructions = useCallback(async () => {
        setSubPhase("vocab-instructions");
        setStartTime(0);
        window.scrollTo(0, 0);
        await fetchVocabQuestions();
    }, []);

    const handleLetterSubmit = useCallback(async (eventTimestamp: number) => {
        if (savingRef.current || !LETTER_COMPARISON_ROUNDS[currentRound].every((_, index) => letterResponses[(currentRound - 1) * 10 + index + 1])) return;
        roundDurations.current[currentRound] ??= Math.max(0, Math.round(eventTimestamp - startTime));

        const totalRounds = Object.keys(LETTER_COMPARISON_ROUNDS).length;

        if (currentRound < totalRounds) {
            // Move to next round
            nextLetterRound();
        } else {
            // Submit all data and move to Vocab
            savingRef.current = true;
            setIsSaving(true);
            try {
                const res = await fetch(getApiPath("/api/part-a/cognitive/letter"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ participantId, responses: letterData, roundDurations: roundDurations.current, submissionId: submissionId.current })
                });

                if (!res.ok) {
                    throw new Error(`Server responded with ${res.status}`);
                }

                await startVocabInstructions();
            } catch (e) {
                console.error(e);
                alert("Failed to save letter data. Please try again.");
            } finally {
                savingRef.current = false;
                setIsSaving(false);
            }
        }
    }, [currentRound, letterResponses, startTime, participantId, letterData, nextLetterRound, startVocabInstructions]);

    useEffect(() => {
        if (subPhase !== "letter") return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || !isStudyVisible()) return;
            if (event.target instanceof HTMLElement && (event.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName))) return;
            const key = event.key.toUpperCase();
            if (event.code === "Space") {
                event.preventDefault();
                if (!activeLetterId) void handleLetterSubmit(event.timeStamp);
                return;
            }
            if (!activeLetterId || (key !== "S" && key !== "D")) return;
            event.preventDefault();
            const problem = LETTER_COMPARISON_ROUNDS[currentRound][(activeLetterId - 1) % 10];
            handleLetterResponse(event.timeStamp, activeLetterId, key, problem);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [subPhase, activeLetterId, currentRound, handleLetterResponse, handleLetterSubmit]);

    const handleVocabResponse = (event: ChangeEvent<HTMLInputElement>, id: number, val: string) => {
        if (savingRef.current) return;
        const reactionTime = startTime ? Math.max(0, Math.round(event.timeStamp - startTime)) : 0;

        setVocabResponses(prev => ({ ...prev, [id]: val }));

        setVocabData(prev => {
            const filtered = prev.filter(p => p.questionId !== id);
            const selectedNum = Number.parseInt(val.split(" - ")[0], 10);
            const q = vocabQuestions.find(v => v.id === id);
            const isCorrect = q ? (selectedNum === q.correctOption) : false;

            return [...filtered, {
                questionId: id,
                responseVal: val,
                isCorrect,
                reactionTimeMs: reactionTime
            }];
        });
    };

    const handleVocabSubmit = async () => {
        if (savingRef.current || isLoadingVocab || vocabError || vocabQuestions.length === 0 || !vocabQuestions.every(q => vocabResponses[q.id])) return;
        savingRef.current = true;
        setIsSaving(true);
        try {
            const res = await fetch(getApiPath("/api/part-a/cognitive/vocab"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ participantId, responses: vocabData })
            });

            if (!res.ok) {
                throw new Error(`Server responded with ${res.status}`);
            }

            onComplete();
        } catch (e) {
            console.error(e);
            alert("Failed to save vocab data. Please try again.");
        } finally {
            savingRef.current = false;
            setIsSaving(false);
        }
    };

    const skip = <TestSkip participantId={participantId} disabled={isSaving} onSkip={() => {
        if (subPhase === "letter-instructions") startLetterRound(performance.now());
        else if (subPhase === "letter" && currentRound === 1) {
            // Omit the skipped round if the tester later submits a completed round two.
            setLetterData([]);
            nextLetterRound();
        } else if (subPhase === "letter") void startVocabInstructions();
        else if (subPhase === "vocab-instructions") startVocab(performance.now());
        else onComplete();
    }} />;

    if (subPhase === "letter-instructions" || subPhase === "vocab-instructions") {
        const isLetter = subPhase === "letter-instructions";
        return (
            <section aria-labelledby="task-instructions-title" className="max-w-2xl mx-auto glass-panel p-6 sm:p-10 rounded-xl shadow-sm mt-8 sm:mt-12">
                {skip}
                <p className="text-sm font-medium text-[var(--muted)] mb-3">Cognitive Test · Task {isLetter ? "1" : "2"} of 2</p>
                <h2 id="task-instructions-title" className="text-3xl font-semibold mb-6 tracking-tight text-[var(--foreground)]">{isLetter ? "Speed Task" : "Verbal Task"}</h2>
                <h3 className="font-semibold mb-3">Instructions</h3>
                <div className="mb-8 text-[var(--muted)] text-base leading-relaxed space-y-4">
                    {isLetter ? <>
                        <p>{currentRound === 1 ? "In the next task," : "And the same thing again,"} you will be asked to determine whether two letter strings are exactly the same or different. If these two letter strings are exactly the same, please press “S” on your keyboard. If they are different, please select “D” on your keyboard. Please do as fast as you can. Once you finish the task, please press the “Space Bar” to proceed. We will record the time you complete the task.</p>
                        <p>Please do as quickly and accurately as you can using your keyboard.</p>
                        <p>When you are ready, please press the “Start” button.</p>
                    </> : <>
                        <p>This is a test of your knowledge of word meanings. One of the five words has the same meaning or nearly the same meaning as the word above. Choose the one that that has the closest meaning.</p>
                        <p>Your score will be the number marked correctly minus a fraction of the number marked incorrectly. Therefore, it will NOT be to your advantage to guess. If you don’t know the answer, please select “Not Sure about the answer”.</p>
                    </>}
                </div>
                {!isLetter && isLoadingVocab && <p className="mb-4 text-sm" role="status">Loading vocabulary questions…</p>}
                {!isLetter && vocabError && <div className="mb-4" role="alert"><p>Vocabulary questions could not be loaded.</p><button type="button" onClick={fetchVocabQuestions} className="mt-2 underline focus-ring">Retry loading questions</button></div>}
                <button
                    type="button"
                    autoFocus={isLetter}
                    onClick={event => {
                        if (isLetter) startLetterRound(event.timeStamp);
                        else startVocab(event.timeStamp);
                    }}
                    disabled={!isLetter && (isSaving || isLoadingVocab || vocabError || vocabQuestions.length === 0)}
                    className="bg-[var(--primary)] text-[var(--primary-fg)] px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-all focus-ring disabled:opacity-50"
                >
                    Start
                </button>
            </section>
        );
    }

    if (subPhase === "letter") {
        const currentProblems = LETTER_COMPARISON_ROUNDS[currentRound] || [];
        // Calculate offset for absolute ID: (round - 1) * 10
        const idOffset = (currentRound - 1) * 10;

        return (
            <div className="max-w-6xl mx-auto mt-16 px-4 pb-20">
                {skip}
                <div className="text-center mb-12 space-y-3">
                    <p className="text-sm font-medium text-[var(--muted)]">Cognitive Test · Task 1 of 2</p>
                    <h2 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                        Speed Task <span className="font-normal text-[var(--muted)] mx-2">/</span> Round {currentRound}
                    </h2>
                    <p className="text-[var(--muted)]">Press S = Same or D = Different for the highlighted pair. The highlight moves to the next unanswered pair.</p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {currentProblems.map((prob, idx) => {
                        const absoluteId = idOffset + idx + 1;
                        const response = letterResponses[absoluteId];

                        return (
                            <div
                                key={absoluteId}
                                ref={activeLetterId === absoluteId ? activePairRef : undefined}
                                tabIndex={-1}
                                role="group"
                                aria-label={`Pair ${absoluteId}. ${activeLetterId === absoluteId ? "Press S for same or D for different." : response || "Unanswered."}`}
                                className={`
                                    group relative flex flex-wrap sm:flex-nowrap gap-y-4 items-center justify-between p-6 rounded-xl border transition-all duration-200
                                    ${activeLetterId === absoluteId ? "outline-4 outline-blue-800 bg-blue-50" : ""}
                                    ${response
                                        ? "bg-[var(--surface)] border-[var(--foreground)] ring-1 ring-[var(--foreground)] shadow-sm"
                                        : "bg-[var(--surface)] border-[var(--border)] hover:border-[var(--muted)] hover:shadow-sm"
                                    }
                                `}
                            >
                                <div className="flex-1 text-right pr-3">
                                    <span className="font-mono text-2xl sm:text-3xl font-semibold tracking-wider text-[var(--foreground)] select-none tabular-nums break-all">
                                        {prob.left}
                                    </span>
                                </div>

                                <span className="min-w-12 text-center font-mono font-semibold" aria-label="Response">{response || "—"}</span>

                                <div className="flex-1 text-left pl-3">
                                    <span className="font-mono text-2xl sm:text-3xl font-semibold tracking-wider text-[var(--foreground)] select-none tabular-nums break-all">
                                        {prob.right}
                                    </span>
                                </div>

                                <div className="absolute left-2 top-1/2 -translate-y-1/2">
                                    <span className="text-sm font-mono text-[var(--muted)] group-hover:text-[var(--muted)] transition-colors">
                                        {String(absoluteId).padStart(2, '0')}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {!activeLetterId && <p role="status" className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-[var(--primary)] px-6 py-3 text-white">
                    {isSaving ? "Saving…" : "Once you finish the task, please press the “Space Bar” to proceed."}
                </p>}

                <div className="h-24" />
            </div>
        );
    }

    if (subPhase === "vocab") {
        return (
            <div className="max-w-6xl mx-auto glass-panel p-10 rounded-xl shadow-sm mt-12">
                {skip}
                <div className="mb-8 border-l-4 border-[var(--foreground)] pl-4">
                    <p className="text-sm font-medium text-[var(--muted)] mb-3">Cognitive Test · Task 2 of 2</p>
                    <h2 className="text-2xl font-semibold mb-4 text-[var(--foreground)]">Verbal Task</h2>
                    <p className="text-[var(--muted)]">Choose the closest meaning, or select &quot;Not Sure about the answer&quot; if you are unsure.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {vocabQuestions.map((q) => (
                        <div key={q.id} className="border border-[var(--border)] p-5 rounded-lg bg-[var(--surface)]">
                            <h3 className="font-medium text-lg mb-4 border-b border-[var(--border)] pb-2">{q.id}. <span className="font-bold">{q.word}</span></h3>
                            <div className="space-y-2">
                                {q.options.map((opt) => (
                                    <label key={opt} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-[var(--input-bg)] border border-transparent hover:border-[var(--border)] transition-colors">
                                        <input
                                            type="radio"
                                            name={`vocab-${q.id}`}
                                            value={opt}
                                            disabled={isSaving}
                                            checked={vocabResponses[q.id] === opt}
                                            onChange={(event) => handleVocabResponse(event, q.id, opt)}
                                            className="w-4 h-4 text-[var(--primary)] focus:ring-[var(--primary)]"
                                        />
                                        <span className="text-sm text-[var(--foreground)]/80">{opt}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="text-center mt-12">
                    <button type="button" onClick={handleVocabSubmit} disabled={isSaving || isLoadingVocab || vocabError || vocabQuestions.length === 0 || !vocabQuestions.every(q => vocabResponses[q.id])} className="bg-[var(--primary)] text-[var(--primary-fg)] px-8 py-3 rounded-lg font-medium hover:opacity-90 transition-all focus-ring shadow-sm disabled:opacity-50">
                        {isSaving ? "Saving…" : "Next"}
                    </button>
                </div>
            </div>
        );
    }

    return null;
}
