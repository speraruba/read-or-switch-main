"use client";

import TestSkip from "@/app/components/TestSkip";
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

    const recallPrompt = {
        a: phase === "practice"
            ? "You’ve finished the practice round. Now, please tell us about what you have learned about Animals today. You can recall anything you remember from any of the topics you read today. You don’t need to remember the information word for word. Please say as much as you can!"
            : "Now, we would like to know how much you learned from the formal task. Please tell us about what you have learned about Health today. You can recall anything you remember from any of the topics you read today. You don’t need to remember the information word for word. Please say as much as you can!",
        b: `You’ve finished the ${phase} round. Now, please tell us about what you remembered about the stories. You can recall anything you remember from any of the stories you read today. You don’t need to remember the information word for word. You can share anything you remember, even if you’re not sure it’s verbatim or fully accurate. Please say as much as you can!`,
        c: "Now, please tell us about what you remembered about the sentences. You can recall anything you remember from any of the texts you read. You don’t need to remember the information word for word. You can share anything you remember, even if you’re not sure it’s verbatim or fully accurate. Please say as much as you can!",
    }[part];

    const advance = () => {
        if (isRecall && part !== "c" && phase === "formal") {
            setTask("summary");
            setContent("");
            setError("");
            setRecording(false);
            submissionRef.current = null;
            window.scrollTo(0, 0);
        } else onComplete();
    };

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
            advance();
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Please try saving again.");
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    return <section className="max-w-4xl mx-auto bg-[var(--surface)] border-2 border-[var(--border)] p-6 sm:p-10 rounded-2xl mt-8" aria-labelledby="response-title">
        <TestSkip participantId={participantId} onSkip={advance} disabled={saving} />
        <p className="mb-3 font-semibold">Part {part.toUpperCase()}{part !== "c" && <> · {phase === "practice" ? "Practice" : "Formal"}</>} · {isRecall ? "Recall" : "Summary"}</p>
        <h2 id="response-title" className="text-3xl font-semibold mb-6">{isRecall ? "Tell Us What You Have Learned" : "Summarize What You Learned"}</h2>
        {isRecall ? <>
            <p className="mb-4">{recallPrompt}</p>
            <ol className="list-decimal pl-7 space-y-3 mb-6">
                <li>Select <strong>Start speaking</strong> and allow microphone access if asked.</li>
                <li>Wait for <strong>Listening</strong>, then speak clearly. Your words will appear below as you speak.</li>
                <li>When you have recalled everything you can, select <strong>Stop recording</strong>. Wait for the last words to appear before submitting.</li>
                <li>Your words will appear in the text box below for viewing only and cannot be edited.</li>
            </ol>
            <SummaryEditor key={`${part}-${phase}`} participantId={participantId} value={content} onChange={setContent} onRecordingChange={setRecording} disabled={saving} />
        </> : <>
            <p id="summary-guidance" className="mb-6">{isPartAFormalSummary
                ? "Based on what you have learned about health, please write down a summary (about 100 words) about what you found most important or interesting, or you remembered most from the articles you read today."
                : "Based on the stories you read today, please write down a summary (about 60 words) about what made the strongest impression on you or what you found most interesting. Focus on what stood out to you."}</p>
            <label htmlFor="formal-summary" className="block font-semibold mb-3">Your summary</label>
            <textarea id="formal-summary" aria-describedby="summary-guidance" className="w-full min-h-64 rounded-xl border-2 border-[var(--border)] p-5 text-lg leading-relaxed focus-ring" value={content} onChange={event => setContent(event.target.value)} disabled={saving} maxLength={16000} />
        </>}
        {error && <p role="alert" className="my-4 text-red-800">{error}</p>}
        {content.length > 16000 && <p role="alert">This response is too long to save. Please contact the researcher.</p>}
        <button type="button" onClick={submit} disabled={saving || recording || !content.trim() || content.length > 16000} className="mt-6 rounded-lg bg-[var(--primary)] text-white px-8 py-4 font-semibold focus-ring disabled:opacity-50">
            {saving ? "Saving…" : isRecall ? "Submit Recall" : isPartAFormalSummary ? "Save Summary and Continue to Part B" : "Submit Summary"}
        </button>
    </section>;
}
