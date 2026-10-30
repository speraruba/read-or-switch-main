export interface ReadingDuration {
    wordReadingTimeMs: number;
    sentenceReadingTimeMs: number | null;
}

export interface ReadingElapsed {
    wordReadingTimeMs: number;
    sentenceReadingTimeMs: number;
}

/** Times DOM presentation to the completing key press with a monotonic clock. */
export function createReadingClock(): {
    show: (sentenceId: number, wordIndex: number, now: number) => void;
    finish: (now: number, lastWord: boolean) => ReadingDuration | null;
    elapsed: (now: number) => ReadingElapsed;
} {
    let sentenceId: number | null = null;
    let wordIndex = -1;
    let sentenceStart = 0;
    let wordStart = 0;
    let consumed = true;
    let wordEnd: number | null = null;
    let sentenceEnd: number | null = null;
    return {
        show(nextSentenceId, nextWordIndex, now) {
            // Repeated layout effects must not restart an already displayed word.
            if (sentenceId === nextSentenceId && wordIndex === nextWordIndex) return;
            if (sentenceId !== nextSentenceId) {
                sentenceStart = now;
                sentenceEnd = null;
            }
            sentenceId = nextSentenceId;
            wordIndex = nextWordIndex;
            wordStart = now;
            wordEnd = null;
            consumed = false;
        },
        finish(now, lastWord) {
            if (consumed) return null;
            consumed = true;
            wordEnd = now;
            if (lastWord) sentenceEnd = now;
            return {
                wordReadingTimeMs: Math.max(0, Math.round(now - wordStart)),
                sentenceReadingTimeMs: lastWord ? Math.max(0, Math.round(now - sentenceStart)) : null,
            };
        },
        elapsed(now) {
            if (sentenceId === null) return { wordReadingTimeMs: 0, sentenceReadingTimeMs: 0 };
            return {
                wordReadingTimeMs: Math.max(0, Math.round((wordEnd ?? now) - wordStart)),
                sentenceReadingTimeMs: Math.max(0, Math.round((sentenceEnd ?? now) - sentenceStart)),
            };
        },
    };
}

export interface PartCLogEvent {
    eventId: string;
    participantId: string;
    setId: number;
    sentenceIndex: number;
    wordIndex: number | null;
    action: "word_reveal" | "continue" | "switch" | "timeout";
    wordReadingTimeMs: number | null;
    sentenceReadingTimeMs: number | null;
}

function isDuration(value: unknown): value is number {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 4294967295;
}

export function parsePartCLogEvent(value: unknown): PartCLogEvent | null {
    if (!value || typeof value !== "object") return null;
    const data = value as Record<string, unknown>;
    if (typeof data.eventId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.eventId) ||
        typeof data.participantId !== "string" || !/^\d{1,18}$/.test(data.participantId) ||
        typeof data.setId !== "number" || !Number.isSafeInteger(data.setId) || data.setId < 1 ||
        typeof data.sentenceIndex !== "number" || !Number.isSafeInteger(data.sentenceIndex) || data.sentenceIndex < 1 ||
        (data.action !== "word_reveal" && data.action !== "continue" && data.action !== "switch" && data.action !== "timeout")) return null;
    const common = { eventId: data.eventId, participantId: data.participantId, setId: data.setId, sentenceIndex: data.sentenceIndex };
    if (data.action === "word_reveal" || (data.action === "timeout" && data.wordIndex !== null)) {
        if (typeof data.wordIndex !== "number" || !Number.isSafeInteger(data.wordIndex) || data.wordIndex < 0 ||
            !isDuration(data.wordReadingTimeMs) ||
            (data.sentenceReadingTimeMs !== null && (!isDuration(data.sentenceReadingTimeMs) || data.sentenceReadingTimeMs < data.wordReadingTimeMs))) return null;
        if (data.action === "timeout" && data.sentenceReadingTimeMs === null) return null;
        return { ...common, action: data.action, wordIndex: data.wordIndex, wordReadingTimeMs: data.wordReadingTimeMs, sentenceReadingTimeMs: data.sentenceReadingTimeMs };
    }
    if (data.wordIndex !== null || data.wordReadingTimeMs !== null || data.sentenceReadingTimeMs !== null) return null;
    return { ...common, action: data.action, wordIndex: null, wordReadingTimeMs: null, sentenceReadingTimeMs: null };
}

/** Retains failed writes and reuses event IDs so ambiguous retries are idempotent. */
export function createLogQueue(send: (event: PartCLogEvent) => Promise<void>): {
    add: (event: PartCLogEvent) => void;
    flush: () => Promise<boolean>;
} {
    const pending: PartCLogEvent[] = [];
    let running: Promise<boolean> | null = null;
    return {
        add(event) { pending.push(event); },
        flush() {
            if (running) return running;
            const write = async () => {
                try {
                    while (pending.length) {
                        await send(pending[0]);
                        pending.shift();
                    }
                    return true;
                } catch {
                    return false;
                }
            };
            running = write().finally(() => { running = null; });
            return running;
        },
    };
}
