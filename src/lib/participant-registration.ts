export type ParticipantRegistration = {
    participantId: string;
};

export function validateParticipantRegistration(body: unknown): { value: ParticipantRegistration; error?: never } | { error: string; value?: never } {
    if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Invalid registration details." };
    const data = body as Record<string, unknown>;
    const participantId = typeof data.participantId === "string" ? data.participantId.trim() : "";
    const confirmation = typeof data.confirmParticipantId === "string" ? data.confirmParticipantId.trim() : "";
    if (!/^\d{1,19}$/.test(participantId) || BigInt(participantId) > BigInt("9223372036854775807")) {
        return { error: "Please enter a valid numeric participant ID." };
    }
    if (participantId !== confirmation) return { error: "The participant IDs do not match. Please enter the same ID twice." };
    if (data.consented !== true) return { error: "Please confirm your consent before continuing." };
    return { value: { participantId: BigInt(participantId).toString() } };
}
