"use client";
import { useState } from "react";

import SummaryEditor from "@/app/components/SummaryEditor";
import { getApiPath } from "@/lib/api";

interface SummaryInputProps {
    participantId: string;
    phase: "practice" | "formal";
    onComplete: () => void;
}

export default function SummaryInput({ participantId, phase, onComplete }: SummaryInputProps): React.JSX.Element {
    const [summary, setSummary] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRecording, setIsRecording] = useState(false);

    const handleSubmit = async () => {
        if (isRecording || isSubmitting || !summary.trim()) return;
        setIsSubmitting(true);
        try {
            const response = await fetch(getApiPath("/api/part-b/submit"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    participantId,
                    phase,
                    summary,
                    responses: [] // Only summary
                })
            });
            if (!response.ok) throw new Error("Summary submission failed");
            onComplete();
        } catch (e) {
            console.error(e);
            alert("Failed to submit summary");
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto bg-[var(--surface)] border border-[var(--border)] p-6 sm:p-10 rounded-3xl shadow-sm mt-8">
            <h2 className="text-3xl font-semibold tracking-tight mb-3 text-[var(--foreground)]">Recall with speech-to-text</h2>
            <p className="mb-8 text-[var(--muted)] text-base">
                Share what you learned from the {phase} stories. You can speak or type, and edit at any time.
            </p>

            <SummaryEditor
                participantId={participantId}
                value={summary}
                onChange={setSummary}
                onRecordingChange={setIsRecording}
                disabled={isSubmitting}
            />

            <div className="text-right">
                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || isRecording || summary.trim().length === 0}
                    className={`px-8 py-3 rounded-lg font-medium transition-all focus-ring ${isSubmitting || isRecording || summary.trim().length === 0
                        ? "bg-[var(--input-bg)] text-[var(--muted)] cursor-not-allowed"
                        : "bg-[var(--primary)] text-[var(--primary-fg)] hover:opacity-90 shadow-sm"
                        }`}
                >
                    {isSubmitting ? "Submitting..." : "Submit Summary"}
                </button>
            </div>
        </div>
    );
}
