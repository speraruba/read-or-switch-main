"use client";
import { getApiPath } from "@/lib/api";

import { useRef, useState } from "react";
import type { ChangeEvent, MouseEvent } from "react";

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


// Fetched dynamically
// const vocabQuestions: VocabQuestion[] = [...];


export default function CognitiveTests({ participantId, onComplete }: CognitiveTestsProps): React.JSX.Element | null {
    const [subPhase, setSubPhase] = useState<"intro" | "letter" | "vocab">("intro");
    const savingRef = useRef(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingVocab, setIsLoadingVocab] = useState(false);
    const [vocabError, setVocabError] = useState(false);

    // Letter Test State
    const [currentRound, setCurrentRound] = useState<number>(1);
    const [letterResponses, setLetterResponses] = useState<Record<number, string>>({}); // Keyed by absolute ID (1-20)
    const [letterData, setLetterData] = useState<LetterResponseData[]>([]);
    const [startTime, setStartTime] = useState<number>(0);

    // Vocab Test State
    const [vocabQuestions, setVocabQuestions] = useState<VocabQuestion[]>([]);
    const [vocabResponses, setVocabResponses] = useState<Record<number, string>>({});
    const [vocabData, setVocabData] = useState<VocabResponseData[]>([]);

    // Initialize timing when entering a phase
    const handleIntroNext = (event: MouseEvent<HTMLButtonElement>) => {
        setSubPhase("letter");
        setStartTime(event.timeStamp);
    };

    // Fetch vocab questions when subPhase changes to vocab
    // Or pre-fetch. Let's fetch when entering vocab phase or on mount (if we want them ready).
    // Better to fetch when entering vocab phase to ensure latest.
    const fetchVocabQuestions = async () => {
        setIsLoadingVocab(true);
        setVocabError(false);
        try {
            const res = await fetch(getApiPath("/api/part-a/cognitive/vocab"));
            if (!res.ok) throw new Error("Failed to load vocabulary questions");
            const data = await res.json();
            if (!Array.isArray(data.questions) || data.questions.length === 0) throw new Error("Vocabulary questions are unavailable");
            setVocabQuestions(data.questions);
            setStartTime(performance.now());
        } catch (e) {
            console.error("Failed to fetch vocab questions", e);
            setVocabError(true);
        } finally {
            setIsLoadingVocab(false);
        }
    };

    const handleLetterResponse = (event: MouseEvent<HTMLButtonElement>, absoluteId: number, val: "S" | "D", problem: { left: string, right: string, answer: "S" | "D" }) => {
        if (savingRef.current) return;
        const reactionTime = startTime ? Math.max(0, Math.round(event.timeStamp - startTime)) : 0;

        setLetterResponses(prev => ({ ...prev, [absoluteId]: val }));

        setLetterData(prev => {
            const filtered = prev.filter(p => p.problemId !== absoluteId);
            const isCorrect = (val === problem.answer);

            return [...filtered, {
                problemId: absoluteId,
                response: val,
                isCorrect,
                reactionTimeMs: reactionTime
            }];
        });
    };

    const handleLetterSubmit = async (event: MouseEvent<HTMLButtonElement>) => {
        if (savingRef.current || !LETTER_COMPARISON_ROUNDS[currentRound].every((_, index) => letterResponses[(currentRound - 1) * 10 + index + 1])) return;
        const eventTimestamp = event.timeStamp;

        const totalRounds = Object.keys(LETTER_COMPARISON_ROUNDS).length;

        if (currentRound < totalRounds) {
            // Move to next round
            setCurrentRound(prev => prev + 1);
            setStartTime(eventTimestamp); // Reset timer for next round
            window.scrollTo(0, 0); // Scroll to top for new round
        } else {
            // Submit all data and move to Vocab
            savingRef.current = true;
            setIsSaving(true);
            try {
                const res = await fetch(getApiPath("/api/part-a/cognitive/letter"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ participantId, responses: letterData })
                });

                if (!res.ok) {
                    throw new Error(`Server responded with ${res.status}`);
                }

                setSubPhase("vocab");
                await fetchVocabQuestions();
            } catch (e) {
                console.error(e);
                alert("Failed to save letter data. Please try again.");
            } finally {
                savingRef.current = false;
                setIsSaving(false);
            }
        }
    };

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

    if (subPhase === "intro") {
        return (
            <div className="max-w-xl mx-auto glass-panel p-10 rounded-xl shadow-sm mt-12 text-center">
                <h2 className="text-3xl font-semibold mb-6 tracking-tight text-[var(--foreground)]">Cognitive Tests</h2>
                <div className="mb-8 text-[var(--muted)] text-base leading-relaxed">
                    <p className="mb-4">You will now complete two short cognitive tests.</p>
                    <ul className="space-y-2">
                        <li>1. Letter Comparison</li>
                        <li>2. Vocabulary Test</li>
                    </ul>
                </div>
                <button
                    type="button"
                    onClick={handleIntroNext}
                    className="bg-[var(--primary)] text-[var(--primary-fg)] px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-all focus-ring"
                >
                    Start Tests
                </button>
            </div>
        );
    }

    if (subPhase === "letter") {
        const currentProblems = LETTER_COMPARISON_ROUNDS[currentRound] || [];
        // Calculate offset for absolute ID: (round - 1) * 10
        const idOffset = (currentRound - 1) * 10;

        return (
            <div className="max-w-6xl mx-auto mt-16 px-4 pb-20">
                <div className="text-center mb-12 space-y-3">
                    <h2 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                        Letter Comparison <span className="font-normal text-[var(--muted)] mx-2">/</span> Round {currentRound}
                    </h2>
                    <div className="text-[var(--muted)] text-base max-w-2xl mx-auto space-y-3">
                        <p>
                            And the same thing again, you will be asked to determine whether two letter strings are exactly the same or different.
                        </p>
                        <p>
                            If these two letter strings are exactly the same, please select &quot;S&quot;. If they are different, please select &quot;D&quot;.
                        </p>
                        <p>
                            Please do as fast as you can. Once you finish the task, please press the &quot;DONE&quot; button. We will record the time you complete the task.
                        </p>
                        <p className="font-semibold text-[var(--foreground)] pt-2">Ready?</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {currentProblems.map((prob, idx) => {
                        const absoluteId = idOffset + idx + 1;
                        const response = letterResponses[absoluteId];

                        return (
                            <div
                                key={absoluteId}
                                className={`
                                    group relative flex items-center justify-between p-4 rounded-xl border transition-all duration-200
                                    ${response
                                        ? "bg-[var(--surface)] border-[var(--foreground)] ring-1 ring-[var(--foreground)] shadow-sm"
                                        : "bg-[var(--surface)] border-[var(--border)] hover:border-[var(--muted)] hover:shadow-sm"
                                    }
                                `}
                            >
                                <div className="flex-1 text-right pr-3">
                                    <span className="font-mono text-xl font-medium tracking-[0.2em] text-[var(--foreground)] select-none tabular-nums break-all">
                                        {prob.left}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 z-10">
                                    <button
                                        type="button"
                                        aria-label="Same (S)"
                                        disabled={isSaving}
                                        onClick={(event) => handleLetterResponse(event, absoluteId, "S", prob)}
                                        className={`
                                            h-10 w-10 rounded-lg text-sm font-semibold transition-all duration-200 border flex items-center justify-center
                                            ${response === "S"
                                                ? "bg-[var(--primary)] text-[var(--primary-fg)] border-[var(--primary)] shadow-sm transform scale-105"
                                                : "bg-transparent text-[var(--muted)] border-[var(--border)] hover:text-[var(--foreground)] hover:border-[var(--muted)]"
                                            }
                                        `}
                                    >
                                        S
                                    </button>
                                    <button
                                        type="button"
                                        aria-label="Different (D)"
                                        disabled={isSaving}
                                        onClick={(event) => handleLetterResponse(event, absoluteId, "D", prob)}
                                        className={`
                                            h-10 w-10 rounded-lg text-sm font-semibold transition-all duration-200 border flex items-center justify-center
                                            ${response === "D"
                                                ? "bg-[var(--primary)] text-[var(--primary-fg)] border-[var(--primary)] shadow-sm transform scale-105"
                                                : "bg-transparent text-[var(--muted)] border-[var(--border)] hover:text-[var(--foreground)] hover:border-[var(--muted)]"
                                            }
                                        `}
                                    >
                                        D
                                    </button>
                                </div>

                                <div className="flex-1 text-left pl-3">
                                    <span className="font-mono text-xl font-medium tracking-[0.2em] text-[var(--foreground)] select-none tabular-nums break-all">
                                        {prob.right}
                                    </span>
                                </div>

                                <div className="absolute left-2 top-1/2 -translate-y-1/2">
                                    <span className="text-[10px] font-mono text-[var(--border)] group-hover:text-[var(--muted)] transition-colors">
                                        {String(absoluteId).padStart(2, '0')}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[var(--background)] to-transparent pointer-events-none">
                    <div className="max-w-4xl mx-auto pointer-events-auto flex justify-center">
                        <button
                            type="button"
                            onClick={handleLetterSubmit}
                            disabled={isSaving || !currentProblems.every((_, index) => letterResponses[idOffset + index + 1])}
                            className="bg-[var(--primary)] text-[var(--primary-fg)] px-8 py-3 rounded-full font-medium hover:opacity-90 transition-all shadow-lg hover:shadow-xl focus-ring flex items-center gap-2 transform active:scale-95"
                        >
                            {isSaving ? "Saving…" : currentRound < Object.keys(LETTER_COMPARISON_ROUNDS).length ? (
                                <>Next Round <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></>
                            ) : (
                                <>Complete Section <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></>
                            )}
                        </button>
                    </div>
                </div>

                <div className="h-24" />
            </div>
        );
    }

    if (subPhase === "vocab") {
        return (
            <div className="max-w-6xl mx-auto glass-panel p-10 rounded-xl shadow-sm mt-12">
                <div className="mb-8 border-l-4 border-[var(--foreground)] pl-4">
                    <h2 className="text-2xl font-semibold mb-4 text-[var(--foreground)]">Vocabulary Task</h2>
                    <div className="text-[var(--muted)] text-lg space-y-4">
                        <p>
                            This is a test of your knowledge of word meanings. One of the five words has the same meaning or nearly the same meaning as the word above the five words.
                        </p>
                        <p>
                            Please select the best answer.
                        </p>
                        <p>
                            Please select &quot;Not sure about the answer&quot; if you are not sure about the correct answer. It will not be your advantage to guess.
                        </p>
                    </div>
                </div>

                {isLoadingVocab && <p role="status">Loading vocabulary questions…</p>}
                {vocabError && <div role="alert"><p>Vocabulary questions could not be loaded.</p><button type="button" onClick={fetchVocabQuestions} className="my-4 underline focus-ring">Retry loading questions</button></div>}
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
                        {isSaving ? "Saving…" : "Finish Vocabulary Test"}
                    </button>
                </div>
            </div>
        );
    }

    return null;
}
