import type { RowDataPacket } from "mysql2";
import { NextResponse } from "next/server";

import { withParticipantTransaction } from "@/lib/participant-transaction";

export async function POST(request: Request): Promise<NextResponse> {
    const body = await request.json().catch(() => null);
    const { participantId, phase, storyId, subtopicId, conId, passId, segmentOrder, passRT, responses } = body ?? {};
    if (typeof participantId !== "string" || !/^\d{1,19}$/.test(participantId) || BigInt(participantId) > BigInt("9223372036854775807") ||
        (phase !== "practice" && phase !== "formal") ||
        ![storyId, subtopicId, conId, passId, segmentOrder].every(id => (typeof id === "string" && id.length > 0) || Number.isSafeInteger(id)) ||
        !Number.isInteger(passRT) || passRT < 0 || passRT > 2147483647 || !Array.isArray(responses) || responses.length !== 4) {
        return NextResponse.json({ error: "Invalid article submission" }, { status: 400 });
    }
    const ratings = new Map<string, number>();
    for (const item of responses) {
        if (!item || !["c1", "c2", "c3", "c4"].includes(item.questionId) || ratings.has(item.questionId) ||
            !Number.isInteger(item.value) || item.value < 0 || item.value > 100) {
            return NextResponse.json({ error: "Four distinct article ratings are required" }, { status: 400 });
        }
        ratings.set(item.questionId, item.value);
    }

    const table = phase === "practice" ? "part_a_prac_pass_qop" : "part_a_pass_qop";
    const article = [participantId, storyId, subtopicId, conId, passId];
    try {
        return await withParticipantTransaction(participantId, async connection => {
            const [saved] = await connection.execute<RowDataPacket[]>(
                `SELECT id FROM ${table} WHERE uid=? AND topID=? AND subtopID=? AND conID=? AND passID=? LIMIT 1`, article
            );
            if (!saved.length) {
                await connection.execute(
                    `INSERT INTO ${table} (uid, topID, subtopID, conID, passID, sid, passOrder, passRT, c1Ans, c2Ans, c3Ans, c4Ans)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [...article, crypto.randomUUID(), segmentOrder, passRT, ...["c1","c2","c3","c4"].map(id => ratings.get(id))]
                );
            }
            return NextResponse.json({ success: true });
        });
    } catch (error) {
        console.error("Failed to save article ratings:", error instanceof Error ? error.name : "Unknown error");
        return NextResponse.json({ error: "Failed to save responses" }, { status: 500 });
    }
}
