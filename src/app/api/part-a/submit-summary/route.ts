import type { ResultSetHeader } from "mysql2";
import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

export async function POST(request: Request): Promise<NextResponse> {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object" || !("participantId" in body) || !("content" in body) ||
        typeof body.participantId !== "string" || !/^\d{1,18}$/.test(body.participantId) ||
        typeof body.content !== "string" || !body.content.trim() || body.content.length > 16000) {
        return NextResponse.json({ error: "A participant ID and recall of 1–16000 characters are required" }, { status: 400 });
    }
    const phase = "phase" in body ? body.phase : "formal";
    if (phase !== "practice" && phase !== "formal") {
        return NextResponse.json({ error: "Invalid phase" }, { status: 400 });
    }
    try {
        const [result] = await pool.execute<ResultSetHeader>(
            "INSERT INTO part_a_summaries (participant_id, phase, content) SELECT participant_id, ?, ? FROM participants WHERE participant_id = ?",
            [phase, body.content.trim(), body.participantId]
        );
        if (!result.affectedRows) return NextResponse.json({ error: "Participant not found" }, { status: 404 });
        return NextResponse.json({ success: true, id: result.insertId });
    } catch (error) {
        console.error("Failed to save Part A recall:", error);
        return NextResponse.json({ error: "Failed to save recall" }, { status: 500 });
    }
}
