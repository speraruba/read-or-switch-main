import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { participantId, responses } = body;

        if (!participantId || !Array.isArray(responses)) {
            return NextResponse.json({ error: "Invalid data" }, { status: 400 });
        }

        const conn = await pool.getConnection();

        try {
            await conn.beginTransaction();

            for (const r of responses) {
                await conn.execute(
                    `INSERT INTO part_c_responses 
                    (participant_id, question_id, response_option, is_correct, reaction_time_ms)
                    VALUES (?, ?, ?, ?, ?)`,
                    [participantId, r.questionId, r.responseOption, r.isCorrect, r.reactionTimeMs]
                );
            }

            await conn.commit();
            return NextResponse.json({ success: true });

        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }

    } catch (error) {
        console.error("Error submitting Part C responses:", error);
        return NextResponse.json({ error: "Failed to submit" }, { status: 500 });
    }
}
