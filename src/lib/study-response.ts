export interface StudyResponse {
    participantId: string;
    submissionId: string;
    part: "a" | "b" | "c";
    phase: "practice" | "formal";
    task: "recall" | "summary";
    inputMethod: "speech" | "typed";
    content: string;
}

export function parseStudyResponse(body: unknown): StudyResponse | null {
    if (!body || typeof body !== "object") return null;
    const data = body as Record<string, unknown>;
    // Part C has no study phase. Retain the existing database enum value for storage compatibility.
    const phase = data.part === "c" && data.phase === undefined ? "formal" : data.phase;
    if (typeof data.participantId !== "string" || !/^\d{1,19}$/.test(data.participantId) || BigInt(data.participantId) > BigInt("9223372036854775807") ||
        typeof data.submissionId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.submissionId) ||
        (data.part !== "a" && data.part !== "b" && data.part !== "c") ||
        (phase !== "practice" && phase !== "formal") ||
        (data.task !== "recall" && data.task !== "summary") ||
        (data.inputMethod !== "speech" && data.inputMethod !== "typed") ||
        (data.task === "recall" && data.inputMethod !== "speech") ||
        (data.task === "summary" && phase !== "formal") ||
        (data.part === "c" && (phase !== "formal" || data.task !== "recall")) ||
        typeof data.content !== "string" || !data.content.trim() || data.content.length > 16000) return null;
    return { participantId: data.participantId, submissionId: data.submissionId, part: data.part, phase, task: data.task, inputMethod: data.inputMethod, content: data.content.trim() };
}
