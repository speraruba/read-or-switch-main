"use client";

import TestSkip from "@/app/components/TestSkip";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
    const phase = view.startsWith("formal") ? "formal" : "practice";
    const minutes = phase === "practice" ? 4 : 10;

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
                {(view === "instructions" || view === "formal_intro") && (
                    <div className={cardClass}>
                        <TestSkip participantId={participantId} onSkip={handleNext} />
                        <h2 className={primaryTitle}>Read Short Stories</h2>
                        <div className="space-y-4 mb-8 text-left leading-relaxed">
                            <p>{phase === "formal" && "Now, we will start the formal task. "}In this study, you will read short stories. Your goal is to learn as much as you can from the stories instead of memorizing the text word for word. You will have {minutes} minutes to read these stories before answering some questions. It is very important for you to pay attention to the story and do your best to learn from them. Please try to manage your time to optimize your learning within the time limit.</p>
                            <p>During the {minutes} minutes, you will select one story at a time and read a collection of short chapters about it. You will see one short chapter at a time and can read at your own pace.</p>
                            <p>After you read each chapter, you will have a choice:</p>
                            <ul className="list-disc pl-6 space-y-2">
                                <li>To continue reading the next chapter of the current story, click “Continue with Next Chapter.”</li>
                                <li>To switch to a new story, click “Go to Other Stories.”</li>
                            </ul>
                            <p>You only have {minutes} minutes to read these stories, so do your best to concentrate and stay with a story only as long as you feel you are engaging and still learning something. Once you decide to leave a story, you will not be able to return.</p>
                            <p>You will be asked what you have learned at the end of the task. Please try your best to learn as much as you can in {minutes} minutes.</p>
                            <p>{phase === "practice" ? "When you are ready, please go to the next page by pressing the “Start” button." : "When you are ready, please click on the “Start” button."}</p>
                        </div>
                        <button type="button" onClick={handleNext} className={buttonClass}>Start</button>
                    </div>
                )}
                {isReadingMode && (
                    <StoryReading key={phase} participantId={participantId} phase={phase} durationSeconds={minutes * 60}
                        onComplete={handleNext} />
                )}
                {(view === "practice_recall" || view === "formal_recall") && (
                    <SummaryInput participantId={participantId} phase={phase} onComplete={handleNext} />
                )}
            </main>
        </div>
    );
}
