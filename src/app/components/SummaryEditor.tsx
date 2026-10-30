"use client";

import { useEffect, useId, useRef, useState } from "react";

import { isStudyVisible } from "@/lib/study-display";
import { getApiPath } from "@/lib/api";

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
    const active = status !== "idle";

    useEffect(() => () => { sessionRef.current?.cancel(); }, []);
    useEffect(() => {
        if (active && textareaRef.current && document.activeElement !== textareaRef.current) {
            textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
        }
    }, [value, active]);

    useEffect(() => {
        const pauseRecording = () => {
            if ((!isStudyVisible()) && sessionRef.current) {
                setStatus("stopping");
                sessionRef.current.stop();
            }
        };
        document.addEventListener("fullscreenchange", pauseRecording);
        document.addEventListener("visibilitychange", pauseRecording);
        return () => {
            document.removeEventListener("fullscreenchange", pauseRecording);
            document.removeEventListener("visibilitychange", pauseRecording);
        };
    }, []);

    const toggleRecording = () => {
        if (sessionRef.current) {
            setStatus("stopping");
            sessionRef.current.stop();
            return;
        }
        const previousText = value.trim();
        const session = createSummaryTranscription({
            endpoint: getApiPath("/api/transcription/session"),
            participantId,
            language: "auto",
            onReady: () => setStatus("listening"),
            onText: transcript => onChange([previousText, transcript.trim()].filter(Boolean).join(" ")),
            onEnd: error => {
                sessionRef.current = null;
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
                    <span className="font-semibold">{buttonText}</span>
                </button>
                <p id={`${id}-status`} role="status" className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--foreground)]/70">{statusText}</p>
            </div>

            <div className="flex items-center justify-between mb-3">
                <label htmlFor={id} className="text-sm font-semibold">Your live transcript</label>
            </div>
            <textarea ref={textareaRef} id={id} disabled={disabled}
                className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-base leading-8 text-[var(--foreground)] min-h-[180px] focus-ring placeholder:text-[var(--muted)]"
                placeholder="Your spoken recall will appear here…"
                value={value}
                readOnly
                aria-readonly="true" />
        </div>
    );
}
