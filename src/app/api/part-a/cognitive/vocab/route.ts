import type { RowDataPacket } from "mysql2";
import { NextResponse } from "next/server";

import { query } from "@/lib/db";
import { withParticipantTransaction } from "@/lib/participant-transaction";

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
                .map((opt, idx) => `${idx + 1} - ${opt.toLowerCase() === "not sure about the answer" ? "Not Sure about the answer" : opt}`), // Add "1 - " prefix to match frontend expectation
            correctOption: q.correct_option
        }));

        return NextResponse.json({ questions: formatted });
    } catch (error) {
        console.error("Failed to fetch vocab questions:", error);
        return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 });
    }
}

interface Answer {
    questionId: number;
    option: number;
    reactionTimeMs: number;
}

function parseAnswers(responses: unknown): Answer[] | null {
    if (!Array.isArray(responses) || responses.length === 0) return null;
    const answers: Answer[] = [];
    const ids = new Set<number>();
    for (const item of responses) {
        if (!item || typeof item !== "object") return null;
        const { responseVal, reactionTimeMs } = item;
        const questionId = typeof item.questionId === "string" && /^\d+$/.test(item.questionId)
            ? Number(item.questionId) : item.questionId;
        const option = typeof responseVal === "string" && /^([1-6])(?: - |$)/.exec(responseVal);
        if (!Number.isSafeInteger(questionId) || questionId < 1 || ids.has(questionId) || !option ||
            !Number.isInteger(reactionTimeMs) || reactionTimeMs < 0 || reactionTimeMs > 2147483647) return null;
        ids.add(questionId);
        answers.push({ questionId, option: Number(option[1]), reactionTimeMs });
    }
    return answers;
}

export async function POST(request: Request): Promise<NextResponse> {
    const body = await request.json().catch(() => null);
    const participantId = body?.participantId;
    const answers = parseAnswers(body?.responses);
    if ((typeof participantId !== "string" && !Number.isSafeInteger(participantId)) ||
        !/^\d{1,19}$/.test(String(participantId)) || BigInt(participantId) > BigInt("9223372036854775807") || !answers) {
        return NextResponse.json({ error: "Invalid vocabulary submission" }, { status: 400 });
    }

    try {
        return await withParticipantTransaction(String(participantId), async connection => {
            const [saved] = await connection.execute<RowDataPacket[]>(
                "SELECT question_id FROM part_a_vocabulary_responses WHERE participant_id = ?", [participantId]
            );
            const savedIds = new Set(saved.map(row => Number(row.question_id)));
            const missing = answers.filter(answer => !savedIds.has(answer.questionId));
            if (missing.length) {
                const [questions] = await connection.execute<(RowDataPacket & { id: number; correct_option: number })[]>(
                    "SELECT id, correct_option FROM part_a_vocabulary_questions"
                );
                const correctOptions = new Map(questions.map(row => [row.id, row.correct_option]));
                if (missing.some(answer => !correctOptions.has(answer.questionId))) {
                    return NextResponse.json({ error: "Unknown vocabulary question" }, { status: 400 });
                }
                const placeholders = missing.map(() => "(?, ?, ?, ?, ?)").join(", ");
                const values = missing.flatMap(answer => [
                    participantId, String(answer.questionId), answer.option,
                    Number(answer.option === correctOptions.get(answer.questionId)), answer.reactionTimeMs,
                ]);
                await connection.execute(
                    `INSERT INTO part_a_vocabulary_responses
                     (participant_id, question_id, response_option, is_correct, reaction_time_ms)
                     VALUES ${placeholders}`, values
                );
            }
            return NextResponse.json({ success: true });
        });
    } catch (error) {
        console.error("Failed to save vocabulary responses:", error instanceof Error ? error.name : "Unknown error");
        return NextResponse.json({ error: "Failed to save responses" }, { status: 500 });
    }
}
