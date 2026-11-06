import type { RowDataPacket } from "mysql2";
import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { parsePartBAction } from "@/lib/part-b-actions";

export async function POST(request: Request): Promise<NextResponse> {
    const event = parsePartBAction(await request.json().catch(() => null));
    if (!event) return NextResponse.json({ error: "Invalid Part B reading event" }, { status: 400 });
    // The phase is validated above; table names never come directly from client input.
    const table = event.phase === "practice" ? "part_b_practice_actions" : "part_b_formal_actions";
    const segments = event.phase === "practice" ? "part_b_practice_segments" : "part_b_formal_segments";
    try {
        const [matches] = await pool.execute<RowDataPacket[]>(
            `SELECT s.id FROM ${segments} s JOIN participants p ON p.participant_id = ?
             WHERE s.id = ? AND s.story_id = ?${event.phase === "formal" ? " AND s.sp2_con_id = p.part2_condition" : ""}`,
            [event.participantId, event.segmentId, event.storyId]
        );
        if (!matches.length) return NextResponse.json({ error: "Unknown participant or assigned story segment" }, { status: 404 });
        await pool.execute(
            `INSERT INTO ${table} (event_id, participant_id, story_id, segment_id, action_type, reading_time_ms)
             VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE event_id = ${table}.event_id`,
            [event.eventId, event.participantId, event.storyId, event.segmentId, event.action, event.readingTimeMs]
        );
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to save Part B reading event:", error);
        return NextResponse.json({ error: "Failed to save reading progress" }, { status: 500 });
    }
}
