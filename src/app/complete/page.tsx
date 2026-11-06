export default function CompletePage(): React.JSX.Element {
    return (
        <main className="min-h-screen flex items-center justify-center p-6 bg-[var(--background)]">
            <div className="glass-panel max-w-xl w-full rounded-xl p-12 text-center shadow-sm">
                <h1 className="text-3xl font-semibold mb-6 text-[var(--foreground)]">Debriefing and Thank You</h1>
                <p className="text-[var(--muted)]">Thank you very much for participating in our study. You have completed all tasks.</p>
                <p className="mt-6 text-[var(--muted)]">If you would like to learn the study findings, please let the researchers know.</p>
            </div>
        </main>
    );
}
