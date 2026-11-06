import { setTimeout as delay } from "node:timers/promises";

import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// Duplicated from CognitiveTests.tsx to ensure data consistency
const LETTER_COMPARISON_ROUNDS: Record<number, Array<{ left: string; right: string; answer: "S" | "D" }>> = {
    1: [
        { "left": "PRDBZTYFN", "right": "PRDBZTYFN", "answer": "S" },
        { "left": "NCWJDZ", "right": "NCMJDZ", "answer": "D" },
        { "left": "KHW", "right": "KBW", "answer": "D" },
        { "left": "ZRBGMF", "right": "ZRBCMF", "answer": "D" },
        { "left": "BTH", "right": "BYH", "answer": "D" },
        { "left": "XWKQRYCNZ", "right": "XWKQRYCNZ", "answer": "S" },
        { "left": "HNPDLK", "right": "HNPDLK", "answer": "S" },
        { "left": "WMQTRSGLZ", "right": "WMQTRZGLZ", "answer": "D" },
        { "left": "JPN", "right": "JPN", "answer": "S" },
        { "left": "QLXSVT", "right": "QLNSVT", "answer": "D" },
    ],
    2: [
        { "left": "YXHKZVFPB", "right": "YXHKZVFPD", "answer": "D" },
        { "left": "RJZ", "right": "RJZ", "answer": "S" },
        { "left": "CLNPZD", "right": "CLNPZD", "answer": "S" },
        { "left": "DCBPFHXYJ", "right": "DCBPFHXYJ", "answer": "S" },
        { "left": "MWR", "right": "ZWR", "answer": "D" },
        { "left": "LPKXZW", "right": "LPKXZW", "answer": "S" },
        { "left": "TZL", "right": "TZQ", "answer": "D" },
        { "left": "CSDBFPHXZ", "right": "CSDBFPHXZ", "answer": "S" },
        { "left": "QHZXPC", "right": "QHZWPC", "answer": "D" },
        { "left": "JNWXHPFBD", "right": "JNWXHPFMD", "answer": "D" },
    ],
};

export async function POST(request: Request): Promise<NextResponse> {
    const body = await request.json().catch(() => null);
    const { participantId, responses, roundDurations, submissionId } = body ?? {};
    if ((typeof participantId !== "string" && !Number.isSafeInteger(participantId)) ||
        !/^\d{1,19}$/.test(String(participantId)) || BigInt(participantId) > BigInt("9223372036854775807") ||
        !Array.isArray(responses) || !responses.length || responses.length > 20 ||
        (submissionId !== undefined && (typeof submissionId !== "string" || !/^[0-9a-f-]{36}$/i.test(submissionId)))) {
        return NextResponse.json({ error: "Invalid speed task submission" }, { status: 400 });
    }

    // Older clients supplied only item times. New clients reuse the session ID on retries.
    const sid = submissionId ?? crypto.randomUUID();
    const values: (string | number | null)[] = [];
    const ids = new Set<number>();
    for (const item of responses) {
        const id = item?.problemId;
        if (!Number.isInteger(id) || id < 1 || id > 20 || ids.has(id) ||
            (item.response !== "S" && item.response !== "D") ||
            !Number.isInteger(item.reactionTimeMs) || item.reactionTimeMs < 0 || item.reactionTimeMs > 2147483647) {
            return NextResponse.json({ error: "Invalid speed task response" }, { status: 400 });
        }
        ids.add(id);
        const round = Math.ceil(id / 10);
        const index = (id - 1) % 10;
        const problem = LETTER_COMPARISON_ROUNDS[round][index];
        const duration = roundDurations?.[round] ?? null;
        if (roundDurations !== undefined && (!Number.isInteger(duration) || duration < item.reactionTimeMs || duration > 4294967295)) {
            return NextResponse.json({ error: "Invalid round duration" }, { status: 400 });
        }
        values.push(participantId, sid, round, index, problem.left, problem.right, problem.answer,
            item.response, item.response === problem.answer ? 1 : 0, item.reactionTimeMs, duration);
    }

    try {
        const placeholders = responses.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
        const insert = `INSERT INTO part_a_letter_item
             (participant_id, sid, round_number, item_index, left_str, right_str, correct_answer, response,
              is_correct, reaction_time_ms, round_completion_time_ms)
             VALUES ${placeholders}
             ON DUPLICATE KEY UPDATE response=VALUES(response), is_correct=VALUES(is_correct),
             reaction_time_ms=VALUES(reaction_time_ms), round_completion_time_ms=VALUES(round_completion_time_ms)`;
        // InnoDB rolls back the entire statement when simultaneous upserts deadlock.
        for (let attempt = 0; ; attempt++) {
            try {
                await query(insert, values);
                break;
            } catch (error) {
                if (attempt >= 4 || !error || typeof error !== "object" ||
                    !("code" in error) || error.code !== "ER_LOCK_DEADLOCK") throw error;
                await delay((10 + Math.random() * 20) * 2 ** attempt);
            }
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to save speed task responses:", error);
        return NextResponse.json({ error: "Failed to save responses" }, { status: 500 });
    }
}
