export default function CompletePage(): React.JSX.Element {
    return (
        <main className="min-h-screen flex items-center justify-center p-6 bg-[var(--background)]">
            <div className="glass-panel max-w-xl w-full rounded-xl p-12 text-center shadow-sm">
                <h1 className="text-3xl font-semibold mb-6 text-[var(--foreground)]">Debriefing and Thank You</h1>
                <p className="text-[var(--muted)]">Thank you for participating in this study. You have completed all tasks.</p>
                <p className="mt-6 text-[var(--muted)] leading-relaxed">This study explores how people learn from multiple texts and decide when to keep reading or switch to another topic or story. Your reading choices, reading times, recall, and comprehension answers help us understand these decisions.</p>
                <p className="mt-6 text-[var(--muted)]">If you have questions about the study, contact <a className="underline focus-ring" href="mailto:chin5@illinois.edu">Jessie Chin</a>.</p>
                <p className="mt-6 text-[var(--foreground)]">You may now close this page.</p>
            </div>
        </main>
    );
}
