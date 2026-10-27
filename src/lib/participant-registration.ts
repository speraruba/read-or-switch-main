export type ParticipantRegistration = {
    participantId: string;
    name: string;
    email: string;
};

export function validateParticipantRegistration(body: unknown): { value: ParticipantRegistration; error?: never } | { error: string; value?: never } {
    if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Invalid registration details." };
    const data = body as Record<string, unknown>;
    const participantId = typeof data.participantId === "string" ? data.participantId.trim() : "";
    const name = typeof data.name === "string" ? data.name.trim() : "";
    const email = typeof data.email === "string" ? data.email.trim() : "";
    if (!/^\d{1,19}$/.test(participantId) || BigInt(participantId) > BigInt("9223372036854775807")) {
        return { error: "Please enter a valid numeric participant ID." };
    }
    if (!name || name.length > 255) return { error: "Please enter your name (up to 255 characters)." };
    if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please enter a valid email address." };
    if (data.consented !== true) return { error: "Please confirm your consent before continuing." };
    return { value: { participantId: BigInt(participantId).toString(), name, email } };
}
