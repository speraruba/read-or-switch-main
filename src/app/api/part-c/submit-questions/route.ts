import type { RowDataPacket } from "mysql2";
import { NextResponse } from "next/server";

import { withParticipantTransaction } from "@/lib/participant-transaction";

export async function POST(request: Request): Promise<NextResponse> {
    const body = await request.json().catch(() => null);
    const { participantId, responses } = body ?? {};
    if (typeof participantId !== "string" || !/^\d{1,19}$/.test(participantId) || BigInt(participantId) > BigInt("9223372036854775807") ||
        !Array.isArray(responses) || responses.length === 0) {
        return NextResponse.json({ error: "Invalid comprehension submission" }, { status: 400 });
    }
    const ids = new Set<number>();
    for (const item of responses) {
        if (!item || !Number.isSafeInteger(item.questionId) || item.questionId < 1 || ids.has(item.questionId) ||
            !Number.isInteger(item.responseOption) || item.responseOption < 1 || item.responseOption > 4 ||
            !Number.isInteger(item.reactionTimeMs) || item.reactionTimeMs < 0 || item.reactionTimeMs > 2147483647) {
            return NextResponse.json({ error: "Invalid comprehension answer" }, { status: 400 });
        }
        ids.add(item.questionId);
    }
    try {
        return await withParticipantTransaction(participantId, async connection => {
            const [questions] = await connection.execute<RowDataPacket[]>("SELECT id, correct_option FROM part_c_questions");
            const key = new Map(questions.map(row => [row.id, row.correct_option]));
            if (responses.some(item => !key.has(item.questionId))) {
                return NextResponse.json({ error: "Unknown comprehension question" }, { status: 400 });
            }
            const [saved] = await connection.execute<RowDataPacket[]>(
                "SELECT question_id FROM part_c_responses WHERE participant_id=?", [participantId]
            );
            const savedIds = new Set(saved.map(row => row.question_id));
            const missing = responses.filter(item => !savedIds.has(item.questionId));
            if (missing.length) {
                const placeholders = missing.map(() => "(?, ?, ?, ?, ?)").join(", ");
                await connection.execute(
                    `INSERT INTO part_c_responses (participant_id, question_id, response_option, is_correct, reaction_time_ms)
                     VALUES ${placeholders}`,
                    missing.flatMap(item => [participantId, item.questionId, item.responseOption,
                        Number(item.responseOption === key.get(item.questionId)), item.reactionTimeMs])
                );
            }
            return NextResponse.json({ success: true });
        });
    } catch (error) {
        console.error("Failed to save comprehension responses:", error instanceof Error ? error.name : "Unknown error");
        return NextResponse.json({ error: "Failed to save responses" }, { status: 500 });
    }
}
