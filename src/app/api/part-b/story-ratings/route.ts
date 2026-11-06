import type { RowDataPacket } from "mysql2";
import { NextResponse } from "next/server";

import { query } from "@/lib/db";

export async function POST(request: Request): Promise<NextResponse> {
    const body = await request.json().catch(() => null);
    const { participantId, phase, storyId, ratings } = body ?? {};
    if (typeof participantId !== "string" || !/^\d{1,19}$/.test(participantId) ||
        BigInt(participantId) > BigInt("9223372036854775807") ||
        (phase !== "practice" && phase !== "formal") || !Number.isSafeInteger(storyId) || storyId < 1 ||
        !Array.isArray(ratings) || ratings.length !== 5 ||
        !ratings.every(value => Number.isInteger(value) && value >= 1 && value <= 7)) {
        return NextResponse.json({ error: "Invalid story ratings" }, { status: 400 });
    }
    try {
        const table = phase === "practice" ? "part_b_practice_stories" : "part_b_formal_stories";
        const matches = await query(
            `SELECT s.id FROM ${table} s JOIN participants p ON p.participant_id = ? WHERE s.id = ?`,
            [participantId, storyId]
        ) as RowDataPacket[];
        if (!matches.length) return NextResponse.json({ error: "Unknown participant or story" }, { status: 404 });

        await query(
            `INSERT INTO part_b_story_ratings
             (participant_id, phase, story_id, engaging, easy, informative, learned, continue_reading)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE engaging=VALUES(engaging), easy=VALUES(easy),
             informative=VALUES(informative), learned=VALUES(learned), continue_reading=VALUES(continue_reading)`,
            [participantId, phase, storyId, ...ratings]
        );
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to save story ratings:", error);
        return NextResponse.json({ error: "Failed to save story ratings" }, { status: 500 });
    }
}
