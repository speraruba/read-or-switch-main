"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { enterStudyFullscreen, FULLSCREEN_REQUIRED } from "@/lib/study-display";

export default function FullscreenGuard({ children }: { children: React.ReactNode }): React.JSX.Element {
    const pathname = usePathname();
    const required = FULLSCREEN_REQUIRED && /\/(demographics|part-a|part-b|part-c|assessment)(\/|$)/.test(pathname);
    const [fullscreen, setFullscreen] = useState(false);
    const [error, setError] = useState("");
    const buttonRef = useRef<HTMLButtonElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const blocked = required && !fullscreen;

    useEffect(() => {
        const update = () => setFullscreen(document.fullscreenElement !== null);
        update();
        document.addEventListener("fullscreenchange", update);
        return () => document.removeEventListener("fullscreenchange", update);
    }, []);

    useEffect(() => {
        if (blocked) {
            previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            buttonRef.current?.focus();
        } else if (previousFocusRef.current?.isConnected) {
            previousFocusRef.current.focus({ preventScroll: true });
            previousFocusRef.current = null;
        }
    }, [blocked]);

    return <>
        <div inert={blocked} aria-hidden={blocked || undefined} style={blocked ? { visibility: "hidden" } : undefined}>{children}</div>
        {blocked && <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[var(--background)] p-6" role="dialog" aria-modal="true" aria-labelledby="fullscreen-title">
            <div className="max-w-2xl rounded-2xl border-2 border-[var(--border)] bg-white p-10 space-y-6">
                <h1 id="fullscreen-title" className="text-3xl font-semibold">Return to full screen</h1>
                <p>Please keep the study in full screen. Your answers are kept, and reading time is paused while this message is shown.</p>
                {error && <p role="alert" className="text-red-800">{error}</p>}
                <button ref={buttonRef} type="button" className="rounded-lg bg-[var(--primary)] px-8 py-4 font-semibold text-white focus-ring" onClick={async () => {
                    setError("");
                    try { await enterStudyFullscreen(); }
                    catch (failure) { setError(failure instanceof Error ? failure.message : "Please try entering full screen again."); }
                }}>Enter Full Screen to Continue</button>
            </div>
        </div>}
    </>;
}
