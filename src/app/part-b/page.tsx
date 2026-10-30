"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RatingDemo from "@/app/components/RatingDemo";
import StoryReading from "./components/StoryReading";
import SummaryInput from "./components/SummaryInput";

type Phase =
    | "instructions"
    | "practice_reading"
    | "practice_recall"
    | "formal_intro"
    | "formal_reading"
    | "formal_recall";

export default function PartBPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <PartBOrchestrator />
        </Suspense>
    );
}

function PartBOrchestrator() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const participantId = searchParams.get("participant_id") || "test-user";
    const [view, setView] = useState<Phase>("instructions");

    const handleNext = () => {
        switch (view) {
            case "instructions":
                setView("practice_reading");
                break;
            case "practice_reading":
                setView("practice_recall");
                break;
            case "practice_recall":
                setView("formal_intro");
                break;
            case "formal_intro":
                setView("formal_reading");
                break;
            case "formal_reading":
                setView("formal_recall");
                break;
            case "formal_recall":
                // Sentence reading is now the final study section.
                router.push(`/part-c?participant_id=${encodeURIComponent(participantId)}`);
                break;
        }
    };

    const getViewLabel = (v: Phase) => v === "formal_recall" ? "FORMAL TASK" : v.replace("_", " ").toUpperCase();

    // Component Styles
    const cardClass = "max-w-4xl mx-auto glass-panel p-10 rounded-xl shadow-sm mt-12 text-center";
    const buttonClass = "flex justify-center rounded-lg bg-[var(--primary)] px-6 py-3 text-sm font-medium text-[var(--primary-fg)] shadow-sm hover:opacity-90 active:scale-[0.99] transition-all focus:outline-none focus-ring mx-auto";
    const primaryTitle = "text-3xl font-semibold tracking-tight text-[var(--foreground)] mb-6";
    const bodyText = "text-[var(--muted)] text-base leading-relaxed mb-8";

    const isReadingMode = view === "practice_reading" || view === "formal_reading";

    return (
        <div className={`min-h-screen bg-[var(--background)] ${isReadingMode ? "h-screen overflow-hidden" : "pb-20"}`}>
            {!isReadingMode && (
                <header className="sticky top-0 z-10 glass-panel border-b border-[var(--border)] px-6 py-4 mb-8 backdrop-blur-md">
                    <div className="max-w-7xl mx-auto flex justify-between items-center">
                        <div className="text-sm font-mono text-[var(--muted)] bg-[var(--surface)] px-2 py-1 rounded border border-[var(--border)]">
                            ID: <span className="text-[var(--foreground)]">{participantId}</span>
                        </div>
                        <div className="text-sm font-medium text-[var(--foreground)] tracking-wide">
                            Part B · {getViewLabel(view)}
                        </div>
                    </div>
                </header>
            )}
            <main className={isReadingMode ? "h-full w-full" : "px-6"}>
                {view === "instructions" && (
                    <div className={cardClass}>
                        <h2 className={primaryTitle}>Part B: Story Reading Study</h2>
                        <div className={bodyText}>
                            <p className="mb-4">You will read several stories.</p>
                            <p className="mb-4">Practice lasts 4 minutes, followed by a 15-minute formal task.</p>
                            <p>After each phase, recall what you read using voice input. After the formal recall, you will write a separate summary of what you remember best.</p>
                        </div>
                        <RatingDemo />
                        <button type="button" onClick={handleNext} className={buttonClass}>
                            Start Practice
                        </button>
                    </div>
                )}

                {view === "practice_reading" && (
                    <StoryReading
                        participantId={participantId}
                        phase="practice"
                        durationSeconds={240} // 4 min
                        onComplete={handleNext}
                    />
                )}

                {view === "practice_recall" && (
                    <SummaryInput
                        participantId={participantId}
                        phase="practice"
                        onComplete={handleNext}
                    />
                )}


                {view === "formal_intro" && (
                    <div className={cardClass}>
                        <h2 className={primaryTitle}>Formal Task</h2>
                        <div className={bodyText}>
                            <p className="mb-4">You will now begin the formal reading task.</p>
                            <p>You have <strong className="text-[var(--foreground)]">15 minutes</strong>.</p>
                        </div>
                        <RatingDemo />
                        <button type="button" onClick={handleNext} className={buttonClass}>
                            Start Formal Task
                        </button>
                    </div>
                )}

                {view === "formal_reading" && (
                    <StoryReading
                        participantId={participantId}
                        phase="formal"
                        durationSeconds={900} // 15 min
                        onComplete={handleNext}
                    />
                )}

                {view === "formal_recall" && (
                    <SummaryInput
                        participantId={participantId}
                        phase="formal"
                        onComplete={handleNext}
                    />
                )}

            </main>
        </div>
    );
}
