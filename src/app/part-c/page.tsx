"use client";
import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createActiveReadingTimer } from "@/lib/active-reading-timer";
import CountdownTimer from "@/app/components/CountdownTimer";
import { getApiPath } from "@/lib/api";
import { createLogQueue, createReadingClock, PART_C_DURATION_MS } from "@/lib/part-c-timing";
import type { PartCLogEvent, ReadingDuration } from "@/lib/part-c-timing";
import ComprehensionQuestions from "./components/ComprehensionQuestions";
import ReadingTimer from "./components/ReadingTimer";
import SummaryInput from "@/app/part-a/components/SummaryInput";

// Matches API response structure
interface Sentence {
    id: number;
    set_id: number;
    sentence_index: number;
    content: string;
}

export default function PartCPage(): React.JSX.Element {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <PartCContent />
        </Suspense>
    );
}

function PartCContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const participantId = searchParams.get("participant_id");

    // States
    const [step, setStep] = useState<"instructions" | "reading" | "finishing" | "summary" | "questions">("instructions");
    const [secondsLeft, setSecondsLeft] = useState(PART_C_DURATION_MS / 1000);
    const [readingTimer] = useState(() => createActiveReadingTimer(PART_C_DURATION_MS));
    const getReadingTime = useCallback(() => PART_C_DURATION_MS - readingTimer.snapshot(performance.now()).remainingMs, [readingTimer]);
    const timeoutHandledRef = useRef(false);
    const [readingPhase, setReadingPhase] = useState<"word-by-word" | "decision">("word-by-word");

    // Group sentences by set_id: { [setId]: Sentence[] }
    const [sentenceSets, setSentenceSets] = useState<Record<number, Sentence[]>>({});
    const [allSetIds, setAllSetIds] = useState<number[]>([]);

    // Tracking
    const [currentSetId, setCurrentSetId] = useState<number | null>(null);
    const [currentIndex, setCurrentIndex] = useState<number>(1); // 1-based index from CSV

    // Word-by-word tracking
    const [currentWordIndex, setCurrentWordIndex] = useState(0);

    const [readingClock] = useState(createReadingClock);
    const [logQueue] = useState(() => createLogQueue(async event => {
        const response = await fetch(getApiPath("/api/part-c/log"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(event),
            keepalive: true,
            signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error("Failed to save reading data");
    }));
    const [saveError, setSaveError] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const decisionBusyRef = useRef(false);
    const decisionTakenRef = useRef(false);
    const pendingDecisionRef = useRef<"continue" | "switch" | null>(null);

    // UI
    const [loading, setLoading] = useState(true);

    // Fetch sentences on mount
    useEffect(() => {
        async function fetchSentences() { // ... no change
            try {
                const res = await fetch(getApiPath("/api/sentences"));
                if (!res.ok) throw new Error("Failed to fetch");
                const data: Sentence[] = await res.json();

                // Group by set_id
                const sets: Record<number, Sentence[]> = {};
                const ids = new Set<number>();
                data.forEach(s => {
                    if (!sets[s.set_id]) sets[s.set_id] = [];
                    sets[s.set_id].push(s);
                    ids.add(s.set_id);
                });

                // Sort sentences within sets just in case
                for (const id in sets) {
                    sets[id].sort((a, b) => a.sentence_index - b.sentence_index);
                }

                setSentenceSets(sets);
                setAllSetIds(Array.from(ids).sort((a, b) => a - b));
            } catch (error) {
                console.error(error);
                alert("Failed to load sentences.");
            } finally {
                setLoading(false);
            }
        }
        fetchSentences();
    }, []);

    // Selection Logic
    const pickNextSet = useCallback(() => {
        if (allSetIds.length === 0) return null;

        const sortedIds = [...allSetIds].sort((a, b) => a - b);

        // Start at 1 if nothing selected
        if (currentSetId === null) {
            return sortedIds[0];
        }

        // Strictly follow set_id += 1
        const nextId = currentSetId + 1;
        if (sortedIds.includes(nextId)) {
            return nextId;
        }

        return null; // All sets completed (or reached end of list)
    }, [allSetIds, currentSetId]);

    const startNextSet = useCallback(() => {
        const nextId = pickNextSet();

        // Check if we are done with all sets OR if we just finished set 16 and that was the last linear one?
        // User request: "when setid = 16 ... enter comprehensive questions"
        // Actually, the request says "when all sets are done, i.e. setid=16".
        // This likely means when we finish the last set.

        if (nextId === null) {
            // All sets done
            setStep("summary");
            return;
        }

        // If we are strictly following 1->16, and maybe we skipped some?
        // The user logic update request implies linear flow.
        // If pickNextSet returns valid ID, we go there.

        setCurrentSetId(nextId);
        setCurrentIndex(1); // Always start at 1
        // Reset reading state
        setReadingPhase("word-by-word");
        setCurrentWordIndex(0);

    }, [pickNextSet]);

    const logAction = useCallback((action: PartCLogEvent["action"], wordIndex: number | null = null, duration?: ReadingDuration) => {
        if (!participantId || currentSetId === null) return;
        logQueue.add({
            eventId: crypto.randomUUID(),
            participantId,
            setId: currentSetId,
            sentenceIndex: currentIndex,
            wordIndex,
            action,
            wordReadingTimeMs: duration?.wordReadingTimeMs ?? null,
            sentenceReadingTimeMs: duration?.sentenceReadingTimeMs ?? null,
        });
    }, [participantId, currentSetId, currentIndex, logQueue]);

    const flushLogs = useCallback(async () => {
        const saved = await logQueue.flush();
        setSaveError(!saved);
        return saved;
    }, [logQueue]);

    const handleTimeout = useCallback(async () => {
        if (timeoutHandledRef.current || readingTimer.snapshot(performance.now()).remainingMs > 0) return;
        readingTimer.pause(performance.now());
        timeoutHandledRef.current = true;
        setSecondsLeft(0);
        setStep("finishing");
        setIsSaving(true);
        // The active reading clock is capped at the budget, even for delayed callbacks.
        const duration = readingPhase === "word-by-word"
            ? readingClock.finish(getReadingTime(), true)
            : null;
        logAction("timeout", duration ? currentWordIndex : null, duration ?? undefined);
        try {
            if (await flushLogs()) {
                pendingDecisionRef.current = null;
                setStep("summary");
            }
        } finally {
            setIsSaving(false);
        }
    }, [readingPhase, readingClock, logAction, currentWordIndex, flushLogs, readingTimer, getReadingTime]);

    const handleDecision = useCallback(async (action: "continue" | "switch") => {
        if (timeoutHandledRef.current) return;
        if (readingTimer.snapshot(performance.now()).remainingMs === 0) {
            await handleTimeout();
            return;
        }
        if (currentSetId === null || decisionBusyRef.current || decisionTakenRef.current) return;
        decisionBusyRef.current = true;
        setIsSaving(true);
        if (!pendingDecisionRef.current) {
            pendingDecisionRef.current = action;
            logAction(action);
        }
        try {
            if (!await flushLogs()) return;
            if (timeoutHandledRef.current) return;
            if (readingTimer.snapshot(performance.now()).remainingMs === 0) {
                await handleTimeout();
                return;
            }
            const choice = pendingDecisionRef.current;
            pendingDecisionRef.current = null;
            decisionTakenRef.current = true;
            if (choice === "continue" && currentIndex < 6) {
                setCurrentIndex(prev => prev + 1);
                setReadingPhase("word-by-word");
                setCurrentWordIndex(0);
            } else {
                startNextSet();
            }
        } finally {
            decisionBusyRef.current = false;
            setIsSaving(false);
        }
    }, [currentSetId, currentIndex, logAction, flushLogs, startNextSet, handleTimeout, readingTimer]);

    const handleContinue = useCallback(() => handleDecision("continue"), [handleDecision]);
    const handleSwitch = useCallback(() => handleDecision("switch"), [handleDecision]);
    const retrySaving = async () => {
        if (timeoutHandledRef.current) {
            setIsSaving(true);
            try {
                if (await flushLogs()) {
                    pendingDecisionRef.current = null;
                    setStep("summary");
                }
            } finally {
                setIsSaving(false);
            }
        } else if (pendingDecisionRef.current) await handleDecision(pendingDecisionRef.current);
        else await flushLogs();
    };

    const handleQuestionsComplete = () => {
        router.push(`/assessment?participant_id=${encodeURIComponent(participantId ?? "")}`);
    };


    // INIT
    const handleStart = () => {
        setStep("reading");
        startNextSet();
    };

    // RENDER HELPERS
    const currentSentence = currentSetId && sentenceSets[currentSetId]?.find(s => s.sentence_index === currentIndex);
    // Split content into words, removing empty strings
    const words = currentSentence ? currentSentence.content.split(" ").filter(w => w.length > 0) : [];

    // Use accumulated reading time for the per-word and per-sentence records too.
    useLayoutEffect(() => {
        if (step === "reading" && readingPhase === "word-by-word" && currentSentence) {
            readingClock.show(currentSentence.id, currentWordIndex, getReadingTime());
            decisionTakenRef.current = false;
        }
    }, [step, readingPhase, currentSentence, currentWordIndex, readingClock, getReadingTime]);

    // Count only visible words. Decisions, loading, saving and other steps are paused.
    useLayoutEffect(() => {
        if (step !== "reading" || readingPhase !== "word-by-word" || !currentSentence) return;
        readingTimer.startArticle("sentence-reading", performance.now());
        const tick = () => {
            const { remainingMs } = readingTimer.snapshot(performance.now());
            setSecondsLeft(Math.ceil(remainingMs / 1000));
            if (remainingMs === 0) void handleTimeout();
        };
        const visibilityChanged = () => {
            if (document.hidden) readingTimer.pause(performance.now());
            else readingTimer.resume(performance.now());
            tick();
        };
        visibilityChanged();
        const interval = window.setInterval(tick, 100);
        document.addEventListener("visibilitychange", visibilityChanged);
        return () => {
            readingTimer.pause(performance.now());
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", visibilityChanged);
        };
    }, [step, readingPhase, currentSentence, readingTimer, handleTimeout]);

    // Keyboard Listener for SPR (word-by-word phase)
    useEffect(() => {
        if (step !== "reading" || readingPhase !== "word-by-word") return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === "Space") {
                e.preventDefault();

                if (e.repeat || e.isComposing || words.length === 0 || timeoutHandledRef.current) return;
                if (readingTimer.snapshot(performance.now()).remainingMs === 0) {
                    void handleTimeout();
                    return;
                }
                const lastWord = currentWordIndex === words.length - 1;
                const duration = readingClock.finish(getReadingTime(), lastWord);
                if (!duration) return;
                logAction("word_reveal", currentWordIndex, duration);
                // Saving never delays revealing the next word.
                void flushLogs();

                if (!lastWord) {
                    setCurrentWordIndex(prev => prev + 1);
                } else {
                    const { remainingMs } = readingTimer.pause(performance.now());
                    setSecondsLeft(Math.ceil(remainingMs / 1000));
                    // Finished sentence -> go to decision
                    setReadingPhase("decision");
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [step, readingPhase, currentWordIndex, words.length, logAction, flushLogs, readingClock, handleTimeout, readingTimer, getReadingTime]);

    // Keyboard Listener for Decision Phase (F = switch, J = continue)
    useEffect(() => {
        if (step !== "reading" || readingPhase !== "decision") return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat || e.isComposing) return;
            // Press F to switch to other topic
            if (e.key === "F" || e.key === "f") {
                e.preventDefault();
                handleSwitch();
            }
            // Press J to continue reading
            if (e.key === "J" || e.key === "j") {
                e.preventDefault();
                handleContinue();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [step, readingPhase, handleSwitch, handleContinue]);


    if (loading) return <div>Loading experiment data...</div>;
    if (!participantId) return <div>Missing Participant ID</div>;

    const cardClass = "max-w-2xl w-full glass-panel p-10 rounded-2xl shadow-sm transition-all duration-300";
    const buttonBase = "justify-center rounded-lg px-6 py-3 text-sm font-medium shadow-sm transition-all focus:outline-none focus:ring-2 min-w-[160px]";
    const primaryBtn = `${buttonBase} bg-black text-white hover:opacity-90 active:scale-[0.99] focus:ring-black/20`;
    const outlineBtn = `${buttonBase} bg-white text-black border border-gray-200 hover:bg-gray-50 active:scale-[0.99] focus:ring-gray-200`;


    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 relative bg-[var(--background)]">
            {step === "instructions" && (
                <div className={cardClass}>
                    <h1 className="text-3xl font-semibold mb-6">Part C: Sentence Reading Study</h1>
                    <div className="text-[var(--muted)] text-base leading-relaxed mb-8 space-y-4">
                        <p>In this task, you will read one sentence at a time.</p>
                        <p>You have <strong>10 minutes</strong> of reading time. The timer starts when the first word appears; instructions, topic choices and questions do not count. When time runs out, you will move on to recall what you read.</p>
                        <p>Press the <strong className="text-[var(--foreground)] border border-[var(--border)] px-1 py-0.5 rounded bg-[var(--input-bg)] text-xs uppercase tracking-wider">Spacebar</strong> to reveal each word one by one.</p>
                        <p>After each sentence, you can choose to <strong>Continue reading</strong> more about the topic, or <strong>Switch topic</strong> to read about something else.</p>
                    </div>
                    <button type="button" onClick={handleStart} className={primaryBtn}>Start Task</button>
                </div>
            )}

            {step === "reading" && currentSentence && (
                <div className="w-full flex flex-col items-center">

                    {/* SPR View - Always visible to maintain layout, but changes state in decision phase */}
                    <div className="max-w-4xl w-full">
                        <div className="mb-4 flex justify-end">
                            <CountdownTimer seconds={secondsLeft} label="Reading time remaining" paused={readingPhase === "decision"} />
                        </div>
                        <div className="glass-panel relative p-16 rounded-2xl shadow-sm min-h-[400px] flex flex-col justify-center items-center">
                            <ReadingTimer clock={readingClock} getReadingTime={getReadingTime} finished={readingPhase === "decision"} wordKey={`${currentSentence.id}-${currentWordIndex}`} />
                            <div className="flex flex-wrap justify-center gap-x-4 gap-y-8 text-3xl font-mono leading-loose max-w-3xl">
                                {words.map((word, index) => {
                                    // In decision phase, we hide everything (or show all underscores).
                                    // User said "don't reveal the whole sentence".
                                    const isVisible = readingPhase === "word-by-word" && index === currentWordIndex;

                                    return (
                                        <span
                                            key={`${currentSentence?.id}-${index}`}
                                            className={`${isVisible
                                                ? "text-[var(--foreground)] font-medium bg-[var(--input-bg)] px-2 -mx-2 rounded"
                                                : "text-[var(--border)]"
                                                }`}
                                        >
                                            {isVisible
                                                ? word
                                                : "_".repeat(word.length)}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="w-full mt-8 min-h-[80px] flex flex-col items-center">
                        {readingPhase === "word-by-word" && (
                            <p className="text-center text-sm font-medium text-[var(--muted)] uppercase tracking-widest opacity-60">
                                Press Spacebar to advance
                            </p>
                        )}

                        {readingPhase === "decision" && (
                            <div className="max-w-3xl w-full flex flex-col items-center gap-4 animate-in fade-in duration-300">
                                <div className="w-full flex justify-between items-center px-4">
                                    <button type="button" onClick={handleSwitch} disabled={isSaving} className={outlineBtn}>
                                        Go To Other Topics
                                    </button>
                                    <button type="button" onClick={handleContinue} disabled={isSaving} className={primaryBtn}>
                                        Continue Reading
                                    </button>
                                </div>
                                <p className="text-center text-xs font-medium text-[var(--muted)] uppercase tracking-widest opacity-60">
                                    Press <strong className="text-[var(--foreground)] border border-[var(--border)] px-1.5 py-0.5 rounded bg-[var(--input-bg)] text-xs uppercase tracking-wider">F</strong> to switch topic or <strong className="text-[var(--foreground)] border border-[var(--border)] px-1.5 py-0.5 rounded bg-[var(--input-bg)] text-xs uppercase tracking-wider">J</strong> to continue
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="fixed bottom-4 left-4 text-xs text-[var(--muted)] opacity-50">
                        Debug: Set {currentSetId} | Index {currentIndex} | Phase {readingPhase}
                    </div>
                </div>
            )}

            {step === "finishing" && (
                <div className={cardClass} role="status">
                    <h2 className="text-2xl font-semibold mb-3">Time is up</h2>
                    <p>{isSaving ? "Saving your reading data before recall…" : "Please retry saving below to continue to recall."}</p>
                </div>
            )}

            {saveError && (
                <div role="alert" className="mt-6 max-w-xl rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
                    <p>Reading data could not be saved. Keep this page open and retry before continuing.</p>
                    <button type="button" onClick={retrySaving} disabled={isSaving} className="mt-2 rounded px-4 py-2 underline focus-ring">
                        {isSaving ? "Saving…" : "Retry saving"}
                    </button>
                </div>
            )}

            {step === "summary" && (
                <div className="w-full">
                    <SummaryInput participantId={participantId} part="c" onComplete={() => setStep("questions")} />
                </div>
            )}

            {step === "questions" && (
                <div className="w-full">
                    <ComprehensionQuestions
                        participantId={participantId}
                        onComplete={handleQuestionsComplete}
                    />
                </div>
            )}
        </div>
    );
}
