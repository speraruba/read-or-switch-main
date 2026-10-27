import { NextResponse } from "next/server";

import { query } from "@/lib/db";
import { validateParticipantRegistration } from "@/lib/participant-registration";

export async function POST(request: Request): Promise<Response> {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid registration details." }, { status: 400 });
    }
    const result = validateParticipantRegistration(body);
    if (result.error !== undefined) return NextResponse.json({ error: result.error }, { status: 400 });
    const { participantId, name, email } = result.value;
    const pid = BigInt(participantId);
    try {
        await query(
            `INSERT INTO participants (participant_id, name, email, consent, part1_condition, part2_condition)
             VALUES (?, ?, ?, TRUE, ?, ?)
             ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), consent = TRUE,
             part1_condition = IFNULL(part1_condition, VALUES(part1_condition)),
             part2_condition = IFNULL(part2_condition, VALUES(part2_condition))`,
            [participantId, name, email, Number(pid % BigInt(3)), Number(pid % BigInt(2))]
        );
        return NextResponse.json({ success: true, participantId });
    } catch (error) {
        console.error("Failed to save participant registration:", error instanceof Error ? error.name : "Unknown error");
        return NextResponse.json({ error: "Your details could not be saved. Please try again." }, { status: 500 });
    }
}
