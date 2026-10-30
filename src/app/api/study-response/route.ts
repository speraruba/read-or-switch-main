import { NextResponse } from "next/server";
import type { ResultSetHeader } from "mysql2";

import { pool } from "@/lib/db";
import { parseStudyResponse } from "@/lib/study-response";

export async function POST(request: Request): Promise<NextResponse> {
    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
    const data = parseStudyResponse(body);
    if (!data) return NextResponse.json({ error: "Invalid response. Recall requires voice input; summaries are only available after formal tasks in Parts A and B. Responses must contain 1–16000 characters." }, { status: 400 });
    try {
        const [result] = await pool.execute<ResultSetHeader>(
            `INSERT INTO study_text_responses (submission_id, participant_id, part, phase, task, input_method, content)
             SELECT ?, participant_id, ?, ?, ?, ?, ? FROM participants WHERE participant_id = ?
             ON DUPLICATE KEY UPDATE content = VALUES(content)`,
            [data.submissionId, data.part, data.phase, data.task, data.inputMethod, data.content, data.participantId]
        );
        // A retry can be a no-op, so verify the participant independently if needed.
        if (!result.affectedRows) {
            const [rows] = await pool.execute("SELECT participant_id FROM participants WHERE participant_id = ?", [data.participantId]);
            if (!Array.isArray(rows) || !rows.length) return NextResponse.json({ error: "Participant not found." }, { status: 404 });
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to save study response:", error instanceof Error ? error.name : "Unknown error");
        return NextResponse.json({ error: "Your response could not be saved. Please try again." }, { status: 500 });
    }
}
