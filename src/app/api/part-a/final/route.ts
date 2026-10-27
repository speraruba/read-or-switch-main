import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { participantId, responses } = body;

        // responses: Array of { questionId, responseVal (string), isCorrect, reactionTimeMs }
        // DB part4_comprehension_responses expects response_option as INT? 
        // Checking schema.sql: "response_option INT NOT NULL COMMENT '1-4'"

        // We need to map the string response back to the index/option number.
        // But wait, the component sends text? Or I can update component to send index.
        // Ideally, component sends index 1-4.

        if (!participantId || !Array.isArray(responses)) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        for (const r of responses) {
            await query(
                `INSERT INTO part_a_formal_responses 
                (participant_id, question_id, response_option, is_correct, reaction_time_ms) 
                VALUES (?, ?, ?, ?, ?)`,
                [participantId, r.questionId, r.responseIndex, r.isCorrect, r.reactionTimeMs]
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to save final responses:", error);
        return NextResponse.json({ error: "Failed to save responses" }, { status: 500 });
    }
}
