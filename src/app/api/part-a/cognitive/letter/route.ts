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

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { participantId, responses } = body;

        // responses: Array of { problemId, response, isCorrect, reactionTimeMs }

        if (!participantId || !Array.isArray(responses)) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        if (!/^\d+$/.test(String(participantId))) {
            console.error(`Invalid participant ID: ${participantId}`);
            return NextResponse.json({ error: "Invalid participant ID format" }, { status: 400 });
        }

        const sid = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        for (const r of responses) {
            const pid = parseInt(r.problemId);
            const roundNumber = Math.ceil(pid / 10);
            const itemIndex = (pid - 1) % 10; // 0-based for array
            // DB might want 0 or 1 based. Let's store 0-based index to match array index.

            const roundData = LETTER_COMPARISON_ROUNDS[roundNumber];
            if (!roundData || !roundData[itemIndex]) {
                console.warn(`Invalid problem ID ${pid}`);
                continue;
            }

            const problem = roundData[itemIndex];

            // Mapping to DB Schema:
            // participant_id, sid, round_number, item_index, left_str, right_str, correct_answer, response, is_correct, reaction_time_ms

            await query(
                `INSERT INTO part_a_letter_item 
                (participant_id, sid, round_number, item_index, left_str, right_str, correct_answer, response, is_correct, reaction_time_ms) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                response = VALUES(response), 
                is_correct = VALUES(is_correct), 
                reaction_time_ms = VALUES(reaction_time_ms),
                updated_at = CURRENT_TIMESTAMP(6)`,
                [
                    participantId,
                    sid,
                    roundNumber,
                    itemIndex,
                    problem.left,
                    problem.right,
                    problem.answer,
                    r.response,
                    r.isCorrect ? 1 : 0, // tinyint
                    r.reactionTimeMs
                ]
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to save letter comparison responses:", error);
        return NextResponse.json({ error: "Failed to save responses" }, { status: 500 });
    }
}
