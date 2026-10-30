"use client";

import { useRef, useState } from "react";

import SummaryEditor from "@/app/components/SummaryEditor";
import { getApiPath } from "@/lib/api";

type Props = {
    participantId: string;
    onComplete: () => void;
} & ({ part: "a" | "b"; phase: "practice" | "formal" } | { part: "c"; phase?: never });

export default function RecallSummary({ participantId, part, phase, onComplete }: Props): React.JSX.Element {
    const [task, setTask] = useState<"recall" | "summary">("recall");
    const [content, setContent] = useState("");
    const [recording, setRecording] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const submissionRef = useRef<string | null>(null);
    const savingRef = useRef(false);
    const isRecall = task === "recall";
    const isPartAFormalSummary = !isRecall && part === "a" && phase === "formal";

    const submit = async () => {
        if (savingRef.current || recording || !content.trim()) return;
        savingRef.current = true;
        setSaving(true);
        setError("");
        submissionRef.current ??= crypto.randomUUID();
        try {
            const response = await fetch(getApiPath("/api/study-response"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ participantId, part, phase, task, content, inputMethod: isRecall ? "speech" : "typed", submissionId: submissionRef.current }),
            });
            if (!response.ok) throw new Error("Your response could not be saved. Keep this page open and try again.");
            if (isRecall && part !== "c" && phase === "formal") {
                setTask("summary");
                setContent("");
                submissionRef.current = null;
                window.scrollTo(0, 0);
            } else onComplete();
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Please try saving again.");
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    return <section className="max-w-4xl mx-auto bg-[var(--surface)] border-2 border-[var(--border)] p-6 sm:p-10 rounded-2xl mt-8" aria-labelledby="response-title">
        <p className="mb-3 font-semibold">Part {part.toUpperCase()}{part !== "c" && <> · {phase === "practice" ? "Practice" : "Formal"}</>} · {isRecall ? "Recall" : "Summary"}</p>
        <h2 id="response-title" className="text-3xl font-semibold mb-6">{isRecall ? "Recall everything you learned" : "Summarize what you remember best"}</h2>
        {isRecall ? <>
            <p className="mb-4">Please tell us as much as you can remember from all the {part === "c" ? "sentences" : part === "b" ? "stories" : "articles"} you just read. Include everything you learned, in your own words.</p>
            <ol className="list-decimal pl-7 space-y-3 mb-6">
                <li>Select <strong>Start speaking</strong> and allow microphone access if asked.</li>
                <li>Wait for <strong>Listening</strong>, then speak clearly. Your words will appear below as you speak.</li>
                <li>When you have recalled everything you can, select <strong>Stop recording</strong>. Wait for the last words to appear before submitting.</li>
            </ol>
            <p className="mb-4">Please use voice input. Your words will appear in the text box below for viewing only and cannot be edited.</p>
            <SummaryEditor key={`${part}-${phase}`} participantId={participantId} value={content} onChange={setContent} onRecordingChange={setRecording} disabled={saving} />
        </> : <>
            {isPartAFormalSummary ? <>
                <p id="summary-guidance" className="mb-6 font-semibold">Write down a summary of what you remembered the most (about 100 words).</p>
                <p className="mb-4">You’ve finished the formal task. Now, write briefly what you learned, then continue to Part B.</p>
                <p className="mb-4">Now, please tell us about what you have learned today about <strong>Donation, Medical Transplants, and Cancer</strong>.</p>
                <p className="mb-6">You can either make a list of facts or write a paragraph, but try to be as specific as you can and tell us as much as you can about Bone Graft, Blood Donation, Corneal Transplants, Liver Cancer, and Colorectal Cancer.</p>
            </> : <p className="mb-6">Write about the content that made the strongest impression on you and that you remember most. Focus on what stood out to you.</p>}
            <label htmlFor="formal-summary" className="block font-semibold mb-3">Your summary</label>
            <textarea id="formal-summary" aria-describedby={isPartAFormalSummary ? "summary-guidance" : undefined} className="w-full min-h-64 rounded-xl border-2 border-[var(--border)] p-5 text-lg leading-relaxed focus-ring" value={content} onChange={event => setContent(event.target.value)} disabled={saving} maxLength={16000} />
        </>}
        {error && <p role="alert" className="my-4 text-red-800">{error}</p>}
        {content.length > 16000 && <p role="alert">This response is too long to save. Please contact the researcher.</p>}
        <button type="button" onClick={submit} disabled={saving || recording || !content.trim() || content.length > 16000} className="mt-6 rounded-lg bg-[var(--primary)] text-white px-8 py-4 font-semibold focus-ring disabled:opacity-50">
            {saving ? "Saving…" : isRecall ? "Submit Recall" : isPartAFormalSummary ? "Save Summary and Continue to Part B" : "Submit Summary"}
        </button>
    </section>;
}
