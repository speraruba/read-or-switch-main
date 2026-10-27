import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { participantId, phase, subtopicId, storyId, conId, passId, segmentOrder, passRT, responses } = body;

        // No summary saving needed.

        // Save Ratings to part_a_pass_qop / part_a_prac_pass_qop
        const table = phase === 'practice' ? 'part_a_prac_pass_qop' : 'part_a_pass_qop';

        // Responses is an array: [{questionId: "c1", value: 50}, ...]
        // We need to map these to c1Ans, c2Ans, c3Ans, c4Ans
        const ratingsMap: { [key: string]: number } = {};
        if (responses && Array.isArray(responses)) {
            for (const r of responses) {
                if (!r || typeof r.questionId !== "string" || typeof r.value !== "number" || !Number.isFinite(r.value)) {
                    return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
                }
                ratingsMap[r.questionId] = r.value;
            }
        }

        // We need a unique session ID 'sid'. For now we can generate one or use a placeholder if not provided.
        // The DB requires `sid`. Let's use a timestamp or uuid if available, or just empty string if allowed?
        // Checking schema: `sid` varchar(100) NOT NULL.
        // We might need to generate it or reuse session.
        const sid = `session_${Date.now()}`;

        await query(
            `INSERT INTO ${table} 
            (uid, sid, topID, subtopID, conID, passID, passOrder, c1Ans, c2Ans, c3Ans, c4Ans, passRT) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                participantId,
                sid,
                storyId,
                subtopicId,
                conId,
                passId,
                segmentOrder,
                ratingsMap['c1'] || 0,
                ratingsMap['c2'] || 0,
                ratingsMap['c3'] || 0,
                ratingsMap['c4'] || 0,
                passRT || 0
            ]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to submit part a responses:", error);
        return NextResponse.json({ error: "Failed to submit responses" }, { status: 500 });
    }
}
