"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import CognitiveTests from "./components/CognitiveTests";

function Assessment(): React.JSX.Element {
    const router = useRouter();
    const participantId = useSearchParams().get("participant_id");

    if (!participantId || !/^\d{1,19}$/.test(participantId)) {
        return <p className="p-8" role="alert">Missing or invalid participant ID. Please return to the study.</p>;
    }

    return (
        <main className="min-h-screen bg-[var(--background)] px-6 py-8">
            <CognitiveTests
                participantId={participantId}
                onComplete={() => router.push(`/complete?participant_id=${encodeURIComponent(participantId)}`)}
            />
        </main>
    );
}

export default function AssessmentPage(): React.JSX.Element {
    return <Suspense fallback={<p className="p-8">Loading cognitive tests…</p>}><Assessment /></Suspense>;
}
