"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { getApiPath } from "@/lib/api";
import { createEditableTranscript } from "@/lib/editable-transcript";
import { createSummaryTranscription } from "@/lib/summary-transcription";
import type { TranscriptionSession } from "@/lib/summary-transcription";

interface SummaryEditorProps {
    participantId: string;
    value: string;
    onChange: (value: string) => void;
    onRecordingChange: (active: boolean) => void;
    disabled: boolean;
}

export default function SummaryEditor({ participantId, value, onChange, onRecordingChange, disabled }: SummaryEditorProps): React.JSX.Element {
    const id = useId();
    const sessionRef = useRef<TranscriptionSession | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [status, setStatus] = useState<"idle" | "starting" | "listening" | "stopping">("idle");
    const [message, setMessage] = useState("");
    const draftRef = useRef<ReturnType<typeof createEditableTranscript> | null>(null);
    const composingRef = useRef(false);
    const pendingTranscriptRef = useRef<string | null>(null);
    const selectionRef = useRef<{ start: number; end: number } | null>(null);
    const active = status !== "idle";

    useLayoutEffect(() => {
        const selection = selectionRef.current;
        if (selection && textareaRef.current) {
            textareaRef.current.setSelectionRange(selection.start, selection.end);
            selectionRef.current = null;
        }
    }, [value]);

    const applyTranscript = (transcript: string) => {
        if (composingRef.current) {
            pendingTranscriptRef.current = transcript;
            return;
        }
        const textarea = textareaRef.current;
        if (textarea && document.activeElement === textarea) {
            selectionRef.current = { start: textarea.selectionStart, end: textarea.selectionEnd };
        }
        if (draftRef.current) onChange(draftRef.current.update(transcript));
    };

    useEffect(() => () => { sessionRef.current?.cancel(); }, []);
    useEffect(() => {
        if (active && textareaRef.current && document.activeElement !== textareaRef.current) {
            textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
        }
    }, [value, active]);

    const toggleRecording = () => {
        if (sessionRef.current) {
            setStatus("stopping");
            sessionRef.current.stop();
            return;
        }
        const draft = createEditableTranscript(value);
        draftRef.current = draft;
        pendingTranscriptRef.current = null;
        const session = createSummaryTranscription({
            endpoint: getApiPath("/api/transcription/session"),
            participantId,
            language: "auto",
            onReady: () => setStatus("listening"),
            onText: applyTranscript,
            onEnd: error => {
                sessionRef.current = null;
                // Keep the draft through IME composition if a final result arrives while typing.
                setStatus("idle");
                onRecordingChange(false);
                setMessage(error || "");
            },
        });
        sessionRef.current = session;
        setMessage("");
        setStatus("starting");
        onRecordingChange(true);
        void session.start();
    };

    const buttonText = status === "starting" ? "Cancel connecting" : status === "stopping" ? "Finishing…" : status === "listening" ? "Stop recording" : "Start speaking";
    const statusText = status === "starting" ? "Connecting your microphone… Allow access when prompted."
        : status === "listening" ? "Listening. Speak naturally, then click again to finish."
        : status === "stopping" ? "Microphone paused. Finishing your last words…"
        : message || "Click the microphone to speak. Click again to finish.";

    return (
        <div className="mb-6 text-left">
            <div className="px-5 py-6 text-center mb-4">
                <button type="button" onClick={toggleRecording} disabled={disabled || status === "stopping"}
                    aria-label={buttonText} aria-pressed={active} aria-controls={id} aria-describedby={`${id}-status`}
                    className="group inline-flex flex-col items-center gap-4 rounded-2xl px-8 py-2 focus-ring disabled:opacity-60">
                    <span className={`flex h-20 w-20 items-center justify-center rounded-full transition-all duration-200 ${active ? "bg-[var(--primary)] text-[var(--primary-fg)] ring-8 ring-[var(--border)]" : "bg-[var(--primary)] text-[var(--primary-fg)] shadow-lg group-hover:scale-105"}`}>
                        <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="2" width="6" height="12" rx="3" />
                            <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
                        </svg>
                    </span>
                </button>
                <p id={`${id}-status`} role="status" className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--foreground)]/70">{statusText}</p>
            </div>

            <div className="flex items-center justify-between mb-3">
                <label htmlFor={id} className="text-sm font-semibold">Your summary</label>
                <span className="text-xs text-[var(--muted)]">Edit anytime</span>
            </div>
            <textarea ref={textareaRef} id={id} disabled={disabled}
                className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-base leading-8 text-[var(--foreground)] min-h-[180px] focus-ring placeholder:text-[var(--muted)]"
                placeholder="Speak or type your summary here…"
                value={value}
                onCompositionStart={() => { composingRef.current = true; }}
                onCompositionEnd={event => {
                    composingRef.current = false;
                    draftRef.current?.edit(event.currentTarget.value);
                    const pending = pendingTranscriptRef.current;
                    pendingTranscriptRef.current = null;
                    if (pending !== null) applyTranscript(pending);
                }}
                onChange={event => {
                    draftRef.current?.edit(event.target.value);
                    onChange(event.target.value);
                }} />
        </div>
    );
}
