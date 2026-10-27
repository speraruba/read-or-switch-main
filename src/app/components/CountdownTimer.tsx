interface CountdownTimerProps {
    seconds: number;
    label: string;
    paused?: boolean;
}

export default function CountdownTimer({ seconds, label, paused = false }: CountdownTimerProps): React.JSX.Element {
    const remaining = Math.max(0, Math.ceil(seconds));
    const time = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;

    return (
        <div
            role="timer"
            aria-label={label}
            aria-live="off"
            className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-mono text-lg font-medium text-[var(--primary)] shadow-sm tabular-nums"
        >
            <span>{time}</span>
            {paused && <span className="font-sans text-xs font-normal text-[var(--muted)]">Paused</span>}
        </div>
    );
}
