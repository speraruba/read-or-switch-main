"use client";
import TestSkip from "@/app/components/TestSkip";
import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createActiveReadingTimer } from "@/lib/active-reading-timer";
import { isStudyVisible } from "@/lib/study-display";
import { getApiPath } from "@/lib/api";
import { createLogQueue, createReadingClock } from "@/lib/part-c-timing";
import type { PartCLogEvent, ReadingDuration } from "@/lib/part-c-timing";
import ComprehensionQuestions from "./components/ComprehensionQuestions";
import RecallSummary from "@/app/components/RecallSummary";

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
    const [step, setStep] = useState<"instructions" | "reading" | "recall" | "questions">("instructions");
    const [readingTimer] = useState(() => createActiveReadingTimer(Infinity));
    const getReadingTime = useCallback(() => readingTimer.snapshot(performance.now()).articleTimeMs, [readingTimer]);

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
            setStep("recall");
            return;
        }

        // If we are strictly following 1->16, and maybe we skipped some?
        // The user logic update request implies linear flow.
        // If pickNextSet returns valid ID, we go there.

        setCurrentSetId(nextId);
        setCurrentIndex(1); // Always start at 1
        // Reset reading state
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

    // RENDER HELPERS
    const currentSentence = currentSetId && sentenceSets[currentSetId]?.find(s => s.sentence_index === currentIndex);
    // Split content into words, removing empty strings
    const words = currentSentence ? currentSentence.content.trim().split(/\s+/) : [];

    const lastWordVisible = words.length > 0 && currentWordIndex === words.length - 1;

    const handleDecision = useCallback(async (action: "continue" | "switch") => {
        if (!lastWordVisible || currentSetId === null || decisionBusyRef.current || decisionTakenRef.current) return;
        decisionBusyRef.current = true;
        setIsSaving(true);
        if (!pendingDecisionRef.current) {
            const duration = readingClock.finish(getReadingTime(), true);
            if (duration) logAction("word_reveal", currentWordIndex, duration);
            readingTimer.pause(performance.now());
            pendingDecisionRef.current = action;
            logAction(action);
        }
        try {
            if (!await flushLogs()) return;
            const choice = pendingDecisionRef.current;
            pendingDecisionRef.current = null;
            decisionTakenRef.current = true;
            if (choice === "continue" && sentenceSets[currentSetId].some(sentence => sentence.sentence_index === currentIndex + 1)) {
                setCurrentIndex(prev => prev + 1);
                setCurrentWordIndex(0);
            } else {
                startNextSet();
            }
        } finally {
            decisionBusyRef.current = false;
            setIsSaving(false);
        }
    }, [lastWordVisible, currentSetId, currentIndex, currentWordIndex, readingClock, readingTimer, getReadingTime, sentenceSets, logAction, flushLogs, startNextSet]);

    const handleContinue = useCallback(() => handleDecision("continue"), [handleDecision]);
    const handleSwitch = useCallback(() => handleDecision("switch"), [handleDecision]);
    const retrySaving = async () => {
        if (pendingDecisionRef.current) await handleDecision(pendingDecisionRef.current);
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

    // Use accumulated reading time for the per-word and per-sentence records too.
    useLayoutEffect(() => {
        if (step === "reading" && currentSentence) {
            readingClock.show(currentSentence.id, currentWordIndex, getReadingTime());
            decisionTakenRef.current = false;
        }
    }, [step, currentSentence, currentWordIndex, readingClock, getReadingTime]);

    // The final word stays visible and timed until the participant chooses.
    useLayoutEffect(() => {
        if (step !== "reading" || !currentSentence) return;
        readingTimer.startArticle("sentence-reading", performance.now());
        const visibilityChanged = () => {
            if (!isStudyVisible()) readingTimer.pause(performance.now());
            else if (!pendingDecisionRef.current) readingTimer.resume(performance.now());
        };
        visibilityChanged();
        document.addEventListener("visibilitychange", visibilityChanged);
        document.addEventListener("fullscreenchange", visibilityChanged);
        return () => {
            readingTimer.pause(performance.now());
            document.removeEventListener("visibilitychange", visibilityChanged);
            document.removeEventListener("fullscreenchange", visibilityChanged);
        };
    }, [step, currentSentence, readingTimer]);

    // Keyboard Listener for SPR (word-by-word phase)
    useEffect(() => {
        if (step !== "reading" || lastWordVisible) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === "Space") {
                e.preventDefault();

                if (e.repeat || e.isComposing || words.length === 0 || !isStudyVisible()) return;
                const duration = readingClock.finish(getReadingTime(), false);
                if (!duration) return;
                logAction("word_reveal", currentWordIndex, duration);
                // Saving never delays revealing the next word.
                void flushLogs();

                setCurrentWordIndex(prev => prev + 1);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [step, currentWordIndex, words.length, lastWordVisible, logAction, flushLogs, readingClock, getReadingTime]);

    // Keyboard Listener for Decision Phase (F = switch, J = continue)
    useEffect(() => {
        if (step !== "reading" || !lastWordVisible) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat || e.isComposing || e.ctrlKey || e.altKey || e.metaKey || !isStudyVisible()) return;
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
    }, [step, lastWordVisible, handleSwitch, handleContinue]);


    if (!participantId) return <div>Missing Participant ID</div>;

    if (loading && step === "instructions") return <div>
        Loading experiment data...
        <TestSkip participantId={participantId} onSkip={() => setStep("recall")} />
    </div>;

    const cardClass = "max-w-4xl w-full glass-panel p-10 rounded-2xl shadow-sm transition-all duration-300";
    const buttonBase = "justify-center rounded-lg px-8 py-5 text-xl font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 min-w-[240px]";
    const primaryBtn = `${buttonBase} bg-black text-white hover:opacity-90 active:scale-[0.99] focus:ring-black/20`;
    const outlineBtn = `${buttonBase} bg-white text-black border-2 border-gray-700 hover:bg-gray-50 active:scale-[0.99] focus:ring-gray-200`;


    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 relative bg-[var(--background)]">
            {step === "instructions" && (
                <div className={cardClass}>
                    <TestSkip participantId={participantId} onSkip={handleStart} />
                    <h1 className="text-3xl font-semibold mb-6">Part C: Sentence Reading Study</h1>
                    <div className="text-[var(--foreground)] text-xl leading-relaxed mb-8 space-y-4">
                        <p>In this study, you will read short paragraphs about different topics. Your goal is to learn as much as you can from the short paragraphs instead of memorizing the text word for word. There is no time limit of this task. During the study, you will see one word of the sentence at a time. Please press the SPACEBAR to reveal each word one by one. It is very important for you to pay attention to the text and do your best to learn from them. Please read at your own pace.</p>
                        <p>After you read each sentence, you will have a choice:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>To continue reading the next sentence in the same paragraph, click “Continue with Next Sentence.”</li>
                            <li>To switch to a new topic, click “Go to Other Topics.”</li>
                        </ul>
                        <p>You will be asked what you have learned at the end of the task. Please try your best to read at your own pace.</p>
                        <p>When you are ready, please click on the “Start” button.</p>
                    </div>
                    <button type="button" onClick={handleStart} className={primaryBtn}>Start</button>
                </div>
            )}

            {step === "reading" && <TestSkip participantId={participantId} onSkip={() => setStep("recall")} disabled={isSaving} />}
            {step === "reading" && currentSentence && (
                <div className="w-full flex flex-col items-center">

                    <div className="max-w-4xl w-full">
                        <div className="glass-panel relative p-16 rounded-2xl shadow-sm min-h-[400px] flex flex-col justify-center items-center">
                            <div className="flex flex-wrap justify-center gap-x-4 gap-y-8 text-3xl font-mono leading-loose max-w-3xl">
                                {words.map((word, index) => {
                                    const isVisible = index === currentWordIndex;

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
                        {!lastWordVisible && (
                            <p className="text-center text-xl font-semibold text-[var(--foreground)]">
                                Press Spacebar to advance
                            </p>
                        )}

                        {lastWordVisible && (
                            <div className="max-w-3xl w-full flex flex-col items-center gap-4 animate-in fade-in duration-300">
                                <div className="w-full flex flex-col sm:flex-row justify-between items-stretch gap-6 px-4">
                                    <button type="button" onClick={handleSwitch} disabled={isSaving} className={outlineBtn}>
                                        Go to Other Topics
                                    </button>
                                    <button type="button" onClick={handleContinue} disabled={isSaving} className={primaryBtn}>
                                        Continue with Next Sentence
                                    </button>
                                </div>
                                <p className="text-center text-lg font-semibold text-[var(--foreground)]">
                                    Press <strong className="text-[var(--foreground)] border border-[var(--border)] px-1.5 py-0.5 rounded bg-[var(--input-bg)] text-xs uppercase tracking-wider">F</strong> to switch topic or <strong className="text-[var(--foreground)] border border-[var(--border)] px-1.5 py-0.5 rounded bg-[var(--input-bg)] text-xs uppercase tracking-wider">J</strong> to continue
                                </p>
                            </div>
                        )}
                    </div>

                    <p className="max-w-4xl w-full mt-6 text-sm text-[var(--muted)] tabular-nums" aria-label="Reading progress">
                        Topic {allSetIds.indexOf(currentSentence.set_id) + 1} / {allSetIds.length}
                        {" · "}
                        Sentence {sentenceSets[currentSentence.set_id].findIndex(sentence => sentence.id === currentSentence.id) + 1} / {sentenceSets[currentSentence.set_id].length}
                    </p>
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

            {step === "recall" && (
                <div className="w-full">
                    <RecallSummary participantId={participantId} part="c" onComplete={() => setStep("questions")} />
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
