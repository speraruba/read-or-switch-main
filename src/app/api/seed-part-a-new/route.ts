import type { RowDataPacket } from "mysql2";

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
    try {
        const connection = await pool.getConnection();
        try {
            // No transaction start - auto commit

            const tablesToClear = [
                'part_a_pass_qop', 'part_a_passage', 'part_a_subtopic', 'part_a_topic',
                'part_a_prac_pass_qop', 'part_a_prac_passage', 'part_a_prac_subtopic', 'part_a_prac_topic',
                'part_a_practice_summaries', 'part_a_formal_summaries',
                'part_a_practice_responses', 'part_a_formal_responses',
                'part_a_questions'
            ];

            await connection.query('SET FOREIGN_KEY_CHECKS = 0');
            await connection.query("DELETE FROM study_text_responses WHERE part = ?", ["a"]);
            for (const table of tablesToClear) {
                // Ignore if not exists or error
                try {
                    await connection.query(`TRUNCATE TABLE ${table}`);
                } catch (e) { }
            }
            await connection.query('SET FOREIGN_KEY_CHECKS = 1');

            async function insertMockData(phase: 'practice' | 'formal', numStories: number) {
                const topicTable = phase === 'practice' ? 'part_a_prac_topic' : 'part_a_topic';
                const passageTable = phase === 'practice' ? 'part_a_prac_passage' : 'part_a_passage';

                for (let i = 1; i <= numStories; i++) {
                    const title = `Part A ${phase} Story ${i}`;
                    const topID = `TC${phase.charAt(0).toUpperCase()}${i}`;

                    await connection.query(
                        `INSERT INTO ${topicTable} (topID, topTitle, topIdeasBonusWords) VALUES (?, ?, ?)`,
                        [topID, title, '']
                    );

                    for (let s = 1; s <= 4; s++) {
                        const content = `This is content for segment ${s} of ${title}.`;
                        const subtopID = `${topID}-ST${s}`;
                        const conID = 'CON01';
                        const passID = `P${s}`;

                        await connection.query(
                            `INSERT INTO ${passageTable} 
                            (topID, subtopID, conID, passID, passOrder, passTitle, passText) 
                            VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            [topID, subtopID, conID, passID, s.toString(), `Segment ${s}`, content]
                        );

                        for (let qIdx = 0; qIdx < 4; qIdx++) {
                            const qID = `${topID}-Q${s}-${qIdx}`;
                            // Using IGNORE to prevent PK collision if run multiple times
                            await connection.query(
                                `INSERT IGNORE INTO part_a_questions 
                                (questionID, passID, topID, subtopID, conID, passOrder, passTitle, questionText, choiceA, choiceB, choiceC, choiceD, correctAns) 
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                [
                                    qID, passID, topID, subtopID, conID, s.toString(),
                                    `Segment ${s}`, `Question ${qIdx + 1}?`,
                                    "0", "100", "", "", "1"
                                ]
                            );
                        }
                    }
                }
            }

            await insertMockData('practice', 2);
            await insertMockData('formal', 4);

            const [rows] = await connection.query<(RowDataPacket & { c: number })[]>('SELECT COUNT(*) as c FROM part_a_prac_topic');
            const count = rows[0].c;

            return NextResponse.json({ success: true, message: "Part A seeded NEW", count });

        } finally {
            connection.release();
        }
    } catch (error: unknown) {
        console.error("Seed error:", error);
        return NextResponse.json({ error: "Failed to seed study materials" }, { status: 500 });
    }
}
