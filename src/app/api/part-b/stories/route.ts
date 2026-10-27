import type { RowDataPacket } from "mysql2";

import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const phase = searchParams.get("phase");
    const participantId = searchParams.get("participantId");

    if (!phase) {
        return NextResponse.json({ error: "Phase is required" }, { status: 400 });
    }

    try {
        const tableName = phase === 'practice' ? 'part_b_practice_stories' : 'part_b_formal_stories';

        // Filter by condition for formal phase
        if (phase === 'formal' && participantId) {
            const participantRows = await query(
                'SELECT part2_condition FROM participants WHERE participant_id = ?',
                [participantId]
            ) as (RowDataPacket & { part2_condition: number })[];

            if (participantRows.length > 0) {
                const conditionId = participantRows[0].part2_condition;

                // Only filter if we have a valid condition ID (0 or 1)
                if (conditionId !== null && conditionId !== undefined) {
                    // Join with segments table to check sp2_con_id
                    // Ensure we select from the correct stories table and join with correct segments table
                    const segmentsTable = 'part_b_formal_segments';

                    const stories = await query(
                        `SELECT DISTINCT s.*
                         FROM ${tableName} s
                         JOIN ${segmentsTable} seg ON s.id = seg.story_id
                         WHERE seg.sp2_con_id = ?`,
                        [conditionId.toString()]
                    );
                    return NextResponse.json(stories);
                }
            }
        }

        const stories = await query(
            `SELECT * FROM ${tableName}`
        );
        return NextResponse.json(stories);
    } catch (error) {
        console.error("Failed to fetch stories:", error);
        return NextResponse.json({ error: "Failed to fetch stories" }, { status: 500 });
    }
}
