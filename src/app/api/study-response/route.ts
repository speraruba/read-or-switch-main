import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

import { withParticipantTransaction } from "@/lib/participant-transaction";
import { parseStudyResponse } from "@/lib/study-response";

export async function POST(request: Request): Promise<NextResponse> {
    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
    const data = parseStudyResponse(body);
    if (!data) return NextResponse.json({ error: "Invalid response. Recall requires voice input; summaries are only available after formal tasks in Parts A and B. Responses must contain 1–16000 characters." }, { status: 400 });
    try {
        return await withParticipantTransaction(data.participantId, async connection => {
            const [existing] = await connection.execute<RowDataPacket[]>(
                "SELECT CAST(participant_id AS CHAR) AS participant_id, part, phase, task FROM study_text_responses WHERE submission_id=?",
                [data.submissionId]
            );
            if (existing.length) {
                const saved = existing[0];
                if (saved.participant_id !== BigInt(data.participantId).toString() || saved.part !== data.part ||
                    saved.phase !== data.phase || saved.task !== data.task) {
                    return NextResponse.json({ error: "Submission ID conflict." }, { status: 409 });
                }
                await connection.execute("UPDATE study_text_responses SET content=? WHERE submission_id=?", [data.content, data.submissionId]);
            } else {
                await connection.execute(
                    `INSERT INTO study_text_responses (submission_id, participant_id, part, phase, task, input_method, content)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [data.submissionId, data.participantId, data.part, data.phase, data.task, data.inputMethod, data.content]
                );
            }
            return NextResponse.json({ success: true });
        });
    } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY") {
            return NextResponse.json({ error: "Submission ID conflict." }, { status: 409 });
        }
        console.error("Failed to save study response:", error instanceof Error ? error.name : "Unknown error");
        return NextResponse.json({ error: "Your response could not be saved. Please try again." }, { status: 500 });
    }
}
