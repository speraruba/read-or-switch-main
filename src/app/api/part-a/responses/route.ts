import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            participantId,
            storyId,
            phase,
            summary,
            q1,
            q2,
            q3,
            q4
        } = body;

        if (!participantId || !storyId || !phase) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        await query(
            `INSERT INTO story_responses (
                participant_id, story_id, phase, summary, 
                q1_new_info, q2_difficulty, q3_learning_article, q4_learning_overall
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [participantId, storyId, phase, summary, q1, q2, q3, q4]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to save story response:", error);
        return NextResponse.json({ error: "Failed to save story response" }, { status: 500 });
    }
}
