"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import PracticeTask from "./components/PracticeTask";
import FormalTask from "./components/FormalTask";
import SummaryInput from "./components/SummaryInput";

type PartAPhase = "practice" | "practice_recall" | "formal";

export default function PartAPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <PartAOrchestrator />
        </Suspense>
    );
}

function PartAOrchestrator() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const participantId = searchParams.get("participant_id") || "1001";

    const [phase, setPhase] = useState<PartAPhase>("practice");

    const renderPhase = () => {
        switch (phase) {
            case "practice":
                return <PracticeTask participantId={participantId} onComplete={() => setPhase("practice_recall")} />;
            case "practice_recall":
                return <SummaryInput participantId={participantId} phase="practice" onComplete={() => setPhase("formal")} />;
            case "formal":
                return <FormalTask participantId={participantId} onComplete={() => router.push(`/part-b?participant_id=${encodeURIComponent(participantId)}`)} />;
            default:
                return <div>Unknown Phase</div>;
        }
    };

    const getNavClass = (isActive: boolean) =>
        `text-sm font-medium transition-colors ${isActive ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`;

    return (
        <div className="min-h-screen bg-[var(--background)] pb-20">
            <header className="sticky top-0 z-10 glass-panel border-b border-[var(--border)] px-6 py-4 mb-8 backdrop-blur-md">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="text-sm font-mono text-[var(--muted)] bg-[var(--surface)] px-2 py-1 rounded border border-[var(--border)]">
                        Part A · ID: <span className="text-[var(--foreground)]">{participantId}</span>
                    </div>
                    <div className="flex gap-4 items-center">
                        <span className={getNavClass(phase !== "formal")}>Practice</span>
                        <span className="text-[var(--border)]">/</span>
                        <span className={getNavClass(phase === "formal")}>Formal</span>
                    </div>
                </div>
            </header>
            <main>
                {renderPhase()}
            </main>
        </div>
    );
}
