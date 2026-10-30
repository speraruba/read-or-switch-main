"use client";

import RecallSummary from "@/app/components/RecallSummary";

interface SummaryInputProps {
    participantId: string;
    onComplete: () => void;
    part?: "a" | "b";
    phase?: "practice" | "formal";
}

export default function SummaryInput({ participantId, onComplete, part = "b", phase = "formal" }: SummaryInputProps): React.JSX.Element {
    return <RecallSummary key={`${part}-${phase}`} participantId={participantId} part={part} phase={phase} onComplete={onComplete} />;
}
