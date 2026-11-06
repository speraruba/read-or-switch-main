"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

import { canSkipStudyPage } from "@/lib/test-participant";

interface TestSkipProps {
    participantId: string;
    onSkip: () => void;
    disabled?: boolean;
}

export default function TestSkip({ participantId, onSkip, disabled }: TestSkipProps): React.JSX.Element | null {
    const [enabledFor, setEnabledFor] = useState<string | null>(null);
    useEffect(() => {
        setEnabledFor(canSkipStudyPage(participantId) ? participantId : null);
    }, [participantId]);

    if (enabledFor !== participantId) return null;
    const container = document.getElementById("study-test-navigation");
    if (!container) return null;
    return createPortal(<button type="button" disabled={disabled} onKeyDown={event => event.stopPropagation()} onClick={() => {
        if (canSkipStudyPage(participantId)) onSkip();
    }} className="fixed right-4 top-20 z-[60] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-2 font-semibold shadow-sm focus-ring disabled:opacity-50">
        Skip
    </button>, container);
}
