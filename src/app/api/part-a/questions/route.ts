import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { RowDataPacket } from "mysql2";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const phase = searchParams.get("phase");
    const participantId = searchParams.get("participantId");

    if (!phase) {
        return NextResponse.json({ error: "Phase is required" }, { status: 400 });
    }

    try {
        const questionsTable = 'part_a_questions';

        // If participantId is provided, we perform the logic requested by the user:
        // 1. Get user's assigned con_id (1-3)
        // 2. Identify articles read in Part A
        // 3. Filter questions by conID, subID, passID

        if (participantId) {
            // 1. Get Participant Condition
            const participants = await query(
                "SELECT part1_condition FROM participants WHERE participant_id = ?",
                [participantId]
            ) as RowDataPacket[];

            if (participants.length === 0) {
                return NextResponse.json({ error: "Participant not found" }, { status: 404 });
            }

            // part1_condition is now 1-3
            const assignedConId = participants[0].part1_condition + 1; // Map 0-2 to 1-3

            // 2. Identify Read Articles
            // Reading history is stored in part_a_pass_qop (Formal) or part_a_prac_pass_qop (Practice)
            const readingTable = phase === 'practice' ? 'part_a_prac_pass_qop' : 'part_a_pass_qop';

            // We need unique passIDs that the user has read.
            // Also need subtopID just in case.
            const readPassages = await query(
                `SELECT DISTINCT subtopID, passID
                 FROM ${readingTable}
                 WHERE uid = ?`,
                [participantId]
            ) as RowDataPacket[];

            if (readPassages.length === 0) {
                // User hasn't read anything? Return empty or default?
                // If they haven't read, they shouldn't be seeing comprehension questions based on reading.
                return NextResponse.json([]);
            }

            // 3. Filter Questions
            // Query part_a_questions matching conID and (passID/subtopID)

            // Build a list of (passID) or (subtopID, passID) to filter IN
            // The safest is to filter by passID as it seems granular.
            // However, ensuring subtopID matches is also good.

            // Construct OR clause or use IN tuple if MySQL supports (subtopID, passID) IN (...)
            // MySQL supports row constructors.

            const passageConditions = readPassages.map(() => "(subtopID = ? AND passID = ?)").join(" OR ");
            const passageParams = readPassages.flatMap((r) => [r.subtopID, r.passID]);

            const sql = `
                SELECT *
                FROM ${questionsTable}
                WHERE conID = ?
                AND (${passageConditions})
            `;

            const questions = await query(sql, [assignedConId, ...passageParams]);
            return NextResponse.json(questions);

        } else {
            // Legacy / Fallback behavior: Return all questions for the phase's topics
            // Used by FormalTask/PracticeTask at start
            const storiesTable = phase === 'practice' ? 'part_a_prac_topic' : 'part_a_topic';

            // This join ensures we only get questions related to topics in the current phase
            const questions = await query(
                `SELECT q.*, s.topTitle as story_title
                 FROM ${questionsTable} q
                 JOIN ${storiesTable} s ON q.topID = s.topID`
            );
            return NextResponse.json(questions);
        }

    } catch (error) {
        console.error("Failed to fetch questions:", error);
        return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 });
    }
}
