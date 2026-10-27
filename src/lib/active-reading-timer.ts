export const PRACTICE_READING_DURATION_MS = 4 * 60 * 1000;
export const FORMAL_READING_DURATION_MS = 15 * 60 * 1000;

interface ReadingBudgetSnapshot {
    remainingMs: number;
    articleTimeMs: number;
}

interface ActiveReadingTimer {
    startArticle: (key: string, now: number) => void;
    resume: (now: number) => void;
    pause: (now: number) => ReadingBudgetSnapshot;
    snapshot: (now: number) => ReadingBudgetSnapshot;
}

/** Accumulates only visible article time; feedback/loading/selection never start it. */
export function createActiveReadingTimer(durationMs: number): ActiveReadingTimer {
    let usedMs = 0;
    let articleMs = 0;
    let activeSince: number | null = null;
    let articleKey: string | null = null;
    const delta = (now: number) => activeSince === null ? 0 : Math.min(Math.max(0, now - activeSince), Math.max(0, durationMs - usedMs));
    const snapshot = (now: number): ReadingBudgetSnapshot => {
        const elapsed = delta(now);
        return { remainingMs: Math.max(0, durationMs - usedMs - elapsed), articleTimeMs: Math.round(articleMs + elapsed) };
    };
    const pause = (now: number): ReadingBudgetSnapshot => {
        const elapsed = delta(now);
        usedMs += elapsed;
        articleMs += elapsed;
        activeSince = null;
        return snapshot(now);
    };
    return {
        startArticle(key, now) {
            if (key !== articleKey) {
                pause(now);
                articleKey = key;
                articleMs = 0;
            }
        },
        resume(now) {
            if (articleKey !== null && activeSince === null && usedMs < durationMs) activeSince = now;
        },
        pause,
        snapshot,
    };
}
