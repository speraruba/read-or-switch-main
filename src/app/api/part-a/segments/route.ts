import type { RowDataPacket } from "mysql2";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const storyId = searchParams.get("storyId"); // This is actually topicId (topID)
    const subtopicId = searchParams.get("subtopicId"); // This corresponds to subtopID
    const phase = searchParams.get("phase");
    const participantId = searchParams.get("participantId");

    if (!storyId || !phase || !participantId) {
        return NextResponse.json({ error: "Story ID (Topic ID), Phase, and Participant ID are required" }, { status: 400 });
    }

    try {
        // 1. Get Participant Condition
        const participants = await query(
            "SELECT part1_condition FROM participants WHERE participant_id = ?",
            [participantId]
        ) as (RowDataPacket & { part1_condition: number })[];

        if (!participants.length) {
            return NextResponse.json({ error: "Participant not found" }, { status: 404 });
        }

        const condition = participants[0].part1_condition;

        // 2. Fetch Segments filtered by condition
        const segmentsTable = phase === 'practice' ? 'part_a_prac_passage' : 'part_a_passage';

        const selectFields = "passID as id, topID as story_id, subtopID as subtopic_id, passText as content, passOrder as segment_order, passID as pass_id, conID as con_id";

        // Base query: filter by Topic (topID)
        let whereClause = "topID = ?";
        const queryParams: (string | number)[] = [storyId];

        // Optional: filter by Subtopic (subtopID)
        if (subtopicId) {
            whereClause += " AND subtopID = ?";
            queryParams.push(subtopicId);
        }

        let querySql = `SELECT ${selectFields} FROM ${segmentsTable} WHERE ${whereClause} ORDER BY CAST(passOrder AS UNSIGNED) ASC`;

        if (phase === 'formal') {
            // Note: conID is the column in schema, not sp2_con_id
            whereClause += " AND conID = ?";
            queryParams.push(condition + 1); // Map 0-2 (DB) to 1-3 (CSV content)
            querySql = `SELECT ${selectFields} FROM ${segmentsTable} WHERE ${whereClause} ORDER BY CAST(passOrder AS UNSIGNED) ASC`;
        }

        const segments = await query(querySql, queryParams);
        return NextResponse.json(segments);
    } catch (error) {
        console.error("Failed to fetch segments:", error);
        return NextResponse.json({ error: "Failed to fetch segments" }, { status: 500 });
    }
}
