import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { participantId, storyId, segmentId, actionType, readingTimeMs } = body;

        if (!participantId || !storyId || !actionType) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        await query(
            "INSERT INTO participant_actions (participant_id, story_id, segment_id, action_type, reading_time_ms) VALUES (?, ?, ?, ?, ?)",
            [participantId, storyId, segmentId, actionType, readingTimeMs]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to log action:", error);
        return NextResponse.json({ error: "Failed to log action" }, { status: 500 });
    }
}
