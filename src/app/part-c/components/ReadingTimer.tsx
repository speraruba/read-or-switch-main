"use client";

import { useEffect, useState } from "react";

import type { createReadingClock } from "@/lib/part-c-timing";

interface ReadingTimerProps {
    clock: ReturnType<typeof createReadingClock>;
    getReadingTime: () => number;
    finished: boolean;
    wordKey: string;
}

export default function ReadingTimer({ clock, getReadingTime, finished, wordKey }: ReadingTimerProps): React.JSX.Element {
    const [elapsed, setElapsed] = useState({ sentenceReadingTimeMs: 0, wordReadingTimeMs: 0 });

    useEffect(() => {
        // Only this small display rerenders; the sentence presentation stays stable.
        const interval = window.setInterval(() => setElapsed(clock.elapsed(getReadingTime())), 50);
        return () => window.clearInterval(interval);
    }, [clock, getReadingTime]);

    return (
        <dl className="absolute right-4 top-4 grid grid-cols-[auto_auto] gap-x-3 gap-y-1 text-xs leading-4 text-[var(--muted)]" aria-label="Reading times in seconds" aria-live="off">
            <dt>Sentence</dt>
            <dd className="min-w-[10ch] text-right font-mono tabular-nums">{(elapsed.sentenceReadingTimeMs / 1000).toFixed(2)} s</dd>
            <dt>{finished ? "Last word" : "Current word"}</dt>
            <dd className="min-w-[10ch] text-right font-mono tabular-nums">
                <span key={wordKey} className="word-timer-reset inline-block rounded px-1 -mr-1">
                    {(elapsed.wordReadingTimeMs / 1000).toFixed(2)} s
                </span>
            </dd>
        </dl>
    );
}
