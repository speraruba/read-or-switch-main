import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { RowDataPacket } from "mysql2";

export async function GET() {
    try {
        const questions = await query(
            `SELECT id, word, option_1, option_2, option_3, option_4, option_5, option_6, correct_option 
             FROM part_a_vocabulary_questions 
             ORDER BY id ASC`
        ) as RowDataPacket[];

        // Transform to frontend format if needed, but returning direct is fine too
        // Frontend expects: { id, word, options: string[], correctOption: number }
        const formatted = questions.map(q => ({
            id: q.id,
            word: q.word,
            options: [
                q.option_1,
                q.option_2,
                q.option_3,
                q.option_4,
                q.option_5,
                q.option_6
            ].filter(Boolean) // In case some are null, though schema says NOT NULL
                .map((opt, idx) => `${idx + 1} - ${opt}`), // Add "1 - " prefix to match frontend expectation
            correctOption: q.correct_option
        }));

        return NextResponse.json({ questions: formatted });
    } catch (error) {
        console.error("Failed to fetch vocab questions:", error);
        return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { participantId, responses } = body;

        // responses: Array of { questionId, responseVal, isCorrect, reactionTimeMs }

        if (!participantId || !Array.isArray(responses)) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        if (!/^\d+$/.test(String(participantId))) {
            console.error(`Invalid participant ID: ${participantId}`);
            return NextResponse.json({ error: "Invalid participant ID format" }, { status: 400 });
        }


        for (const r of responses) {
            // Extract number from "1 - speak..."
            // Frontend sends "1 - speak...", we want just the number part cs INT
            let optionNum = 0;
            if (typeof r.responseVal === 'string') {
                optionNum = parseInt(r.responseVal.split(' - ')[0], 10);
            }
            
            if (isNaN(optionNum)) {
                console.warn(`Invalid response value: ${r.responseVal} for question ${r.questionId}`);
                continue; // Skip invalid response
            }

            await query(
                `INSERT INTO part_a_vocabulary_responses 
                (participant_id, question_id, response_option, is_correct, reaction_time_ms) 
                VALUES (?, ?, ?, ?, ?)`,
                [
                    participantId, 
                    String(r.questionId), 
                    optionNum, 
                    r.isCorrect ? 1 : 0, 
                    r.reactionTimeMs
                ]
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to save vocab responses:", error);
        return NextResponse.json({ error: "Failed to save responses" }, { status: 500 });
    }
}
