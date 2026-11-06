export interface PartBAction {
    eventId: string;
    participantId: string;
    phase: "practice" | "formal";
    storyId: number;
    segmentId: number;
    action: "start_story" | "continue" | "switch" | "timeout" | "test_skip";
    readingTimeMs: number;
}

/** Duration belongs to the segment being LEFT, not the next segment. Start has zero duration. */
export function parsePartBAction(value: unknown): PartBAction | null {
    if (!value || typeof value !== "object") return null;
    const data = value as Record<string, unknown>;
    if (typeof data.eventId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.eventId) ||
        typeof data.participantId !== "string" || !/^[1-9]\d{0,18}$/.test(data.participantId) ||
        BigInt(data.participantId) > BigInt("9223372036854775807") ||
        (data.phase !== "practice" && data.phase !== "formal") ||
        typeof data.storyId !== "number" || !Number.isSafeInteger(data.storyId) || data.storyId < 1 ||
        typeof data.segmentId !== "number" || !Number.isSafeInteger(data.segmentId) || data.segmentId < 1 ||
        !["start_story", "continue", "switch", "timeout", "test_skip"].includes(String(data.action)) ||
        typeof data.readingTimeMs !== "number" || !Number.isInteger(data.readingTimeMs) || data.readingTimeMs < 0 ||
        data.readingTimeMs > (data.phase === "practice" ? 240000 : 600000) ||
        (data.action === "start_story" && data.readingTimeMs !== 0) ||
        (data.action === "test_skip" && data.participantId !== "88888888")) return null;
    return {
        eventId: data.eventId, participantId: data.participantId, phase: data.phase,
        storyId: data.storyId, segmentId: data.segmentId,
        action: data.action as PartBAction["action"], readingTimeMs: data.readingTimeMs,
    };
}

/** Hold one transition until acknowledged; retries keep the exact same event and duration. */
export function createPartBActionWriter(send: (event: PartBAction) => Promise<void>): {
    pending: () => boolean;
    save: (event: PartBAction, onSaved: () => void) => Promise<boolean>;
    retry: () => Promise<boolean>;
} {
    let pending: { event: PartBAction; onSaved: () => void } | null = null;
    let running: Promise<boolean> | null = null;
    const retry = (): Promise<boolean> => {
        if (running) return running;
        running = (async () => {
            if (!pending) return true;
            try {
                await send(pending.event);
            } catch {
                return false;
            }
            const completed = pending;
            pending = null;
            completed.onSaved();
            return true;
        })().finally(() => { running = null; });
        return running;
    };
    return {
        pending: () => pending !== null,
        save(event, onSaved) {
            if (pending) return retry();
            pending = { event, onSaved };
            return retry();
        },
        retry,
    };
}
