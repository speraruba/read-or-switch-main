import type { ResultSetHeader, RowDataPacket } from "mysql2";

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";
import { parse } from 'csv-parse/sync';

export async function GET() {
    try {
        const connection = await pool.getConnection();

        try {
            // await connection.beginTransaction();

            const tablesToDrop = [
                'part_b_practice_responses', 'part_b_practice_questions', 'part_b_practice_actions', 'part_b_practice_segments', 'part_b_practice_stories', 'part_b_practice_summaries',
                'part_b_formal_responses', 'part_b_formal_questions', 'part_b_formal_actions', 'part_b_formal_segments', 'part_b_formal_stories', 'part_b_formal_summaries'
            ];

            await connection.query('SET FOREIGN_KEY_CHECKS = 0');
            for (const table of tablesToDrop) {
                await connection.query(`TRUNCATE TABLE ${table}`);
            }
            await connection.query('SET FOREIGN_KEY_CHECKS = 1');

            const formalPath = path.resolve(process.cwd(), 'docs/Study Material/Part B Formal Study-Table 1.csv');
            const practicePath = path.resolve(process.cwd(), 'docs/Study Material/Part B Practice-Table 1.csv');
            const questionsPath = path.resolve(process.cwd(), 'docs/Study Material/Part B Comprehension Questions-Table 1.csv');

            // Check if files exist
            if (!fs.existsSync(formalPath) || !fs.existsSync(practicePath)) {
                throw new Error("CSV files not found");
            }

            const formalContent = fs.readFileSync(formalPath, 'utf8');
            const practiceContent = fs.readFileSync(practicePath, 'utf8');
            const questionsContent = fs.existsSync(questionsPath) ? fs.readFileSync(questionsPath, 'utf8') : null;

            const formalRecords = parse(formalContent, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
            const practiceRecords = parse(practiceContent, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
            const questionRecords = questionsContent ? parse(questionsContent, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[] : [];

            async function insertRecords(records: Record<string, string>[], phase: 'practice' | 'formal') {
                const suffix = phase;
                const storyTable = `part_b_${suffix}_stories`;
                const segmentTable = `part_b_${suffix}_segments`;

                const storiesMap = new Map<string, Record<string, string>[]>();
                for (const row of records) {
                    const title = row.StoryTitle;
                    if (!storiesMap.has(title)) storiesMap.set(title, []);
                    storiesMap.get(title)?.push(row);
                }

                const insertedStories = new Map<string, number>();

                for (const [title, rows] of storiesMap) {
                    const firstRow = rows[0];
                    const storyTopicId = firstRow.StoryTopicID;

                    const [result] = await connection.query<ResultSetHeader>(
                        `INSERT INTO ${storyTable} (title, story_topic_id) VALUES (?, ?)`,
                        [title, storyTopicId]
                    );
                    const storyId = result.insertId;
                    insertedStories.set(title, storyId);

                    for (const row of rows) {
                        const content = row.StoryText;
                        const order = parseInt(row.Order, 10);
                        const textId = row.TextID;
                        const predictability = row.Predictability || null;
                        const predictId = row.PredictID ? parseInt(row.PredictID, 10) : null;
                        let sp2ConId = row.SP2ConID || null;
                        if (!sp2ConId && row['SP2ConID']) sp2ConId = row['SP2ConID'];

                        await connection.query(
                            `INSERT INTO ${segmentTable}
                            (story_id, content, segment_order, text_id, predictability, predict_id, sp2_con_id)
                            VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            [storyId, content, order, textId, predictability, predictId, sp2ConId]
                        );
                    }
                }
                return insertedStories;
            }

            const formalStories = await insertRecords(formalRecords, 'formal');
            const practiceStories = await insertRecords(practiceRecords, 'practice');

            // Questions
            if (questionRecords.length > 0) {
                for (const row of questionRecords) {
                    const title = row.StoryTitle;
                    let storyId = formalStories.get(title);
                    let phase = 'formal';
                    if (!storyId) {
                        storyId = practiceStories.get(title);
                        phase = 'practice';
                    }

                    if (!storyId) continue;

                    const questionsTable = `part_b_${phase}_questions`;
                    const questionText = row.Questions;
                    const order = row.Order ? parseInt(row.Order, 10) : 0;
                    const op1 = row.Option_1;
                    const op2 = row.Option_2;
                    const op3 = row.Option_3;
                    const op4 = row.Option_4;
                    const correctStr = row.CorrectAns;

                    let correctOption = 1;
                    if (correctStr === op1) correctOption = 1;
                    else if (correctStr === op2) correctOption = 2;
                    else if (correctStr === op3) correctOption = 3;
                    else if (correctStr === op4) correctOption = 4;

                    await connection.query(
                        `INSERT INTO ${questionsTable}
                        (story_id, question_text, question_order, option_1, option_2, option_3, option_4, correct_option)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [storyId, questionText, order, op1, op2, op3, op4, correctOption]
                    );
                }
            }

            // await connection.commit();

            const [rows] = await connection.query<(RowDataPacket & { c: number })[]>('SELECT COUNT(*) as c FROM part_b_practice_stories');
            const [rows2] = await connection.query<(RowDataPacket & { c: number })[]>('SELECT COUNT(*) as c FROM part_b_practice_segments');
            const countStories = rows[0].c;
            const countSegments = rows2[0].c;

            return NextResponse.json({ success: true, message: "Part B seeded (v2)", countStories, countSegments });

        } catch (error) {
            // await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error: unknown) {
        console.error("Seed error:", error);
        return NextResponse.json({ error: "Failed to seed study materials" }, { status: 500 });
    }
}
