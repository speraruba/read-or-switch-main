
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";

// Manual CSV parser to avoid dependency issues
function parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let currentValue = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (insideQuotes && line[i + 1] === '"') {
                currentValue += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === ',' && !insideQuotes) {
            values.push(currentValue.trim());
            currentValue = '';
        } else {
            currentValue += char;
        }
    }
    values.push(currentValue.trim());
    return values;
}

export async function GET() {
    // Log start
    try { fs.writeFileSync('seed_start.txt', 'started'); } catch (e) { }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Disable FK checks
        await connection.query("SET FOREIGN_KEY_CHECKS = 0");

        // 1. Populate part_c_sentences
        const sentencesPath = path.resolve(process.cwd(), 'docs/Study Material/part_c_sentences.csv');
        let sentencesCount = 0;

        if (fs.existsSync(sentencesPath)) {
            const fileContent = fs.readFileSync(sentencesPath, "utf-8");
            const lines = fileContent.split('\n').filter(l => l.trim().length > 0);

            // Assume first line is header, so skip it
            const dataLines = lines.slice(1);

            await connection.query("TRUNCATE TABLE part_c_sentences");

            const insertSentence = `
                INSERT INTO part_c_sentences
                (study_part_id, set_id, text_id, sentence_index, sp3_con_id, predictability, predict_id, make_sense, make_sense_id, text_type, text_type_id, gen_type, gen_type_id, note, content)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            for (const line of dataLines) {
                const cols = parseCSVLine(line);
                if (cols.length < 15) continue;
                // StudyPartID(0), SentSetID(1), TextID(2), Order(3), SP3ConID(4), Predictability(5), PredictID(6), Make_sense(7), Make_sense_ID(8), TextType(9), TextTypeID(10), GenType(11), GenTypeID(12), Note(13), SentenceText(14)

                await connection.execute(insertSentence, [
                    parseInt(cols[0]) || 0,
                    parseInt(cols[1]) || 0,
                    cols[2],
                    parseInt(cols[3]) || 0,
                    cols[4],
                    cols[5],
                    parseInt(cols[6]) || 0,
                    cols[7],
                    parseInt(cols[8]) || 0,
                    cols[9],
                    parseInt(cols[10]) || 0,
                    cols[11],
                    parseInt(cols[12]) || 0,
                    cols[13],
                    cols[14]
                ]);
            }
            sentencesCount = dataLines.length;
        } else {
            console.warn("Sentences CSV not found at", sentencesPath);
            fs.writeFileSync('seed_sent_missing.txt', sentencesPath);
        }

        // 2. Populate part_c_questions
        const questionsPath = path.resolve(process.cwd(), 'docs/Study Material/part_c_questions.csv');
        let questionsCount = 0;

        if (fs.existsSync(questionsPath)) {
            const fileContent = fs.readFileSync(questionsPath, "utf-8");
            const lines = fileContent.split('\n').filter(l => l.trim().length > 0);
            const dataLines = lines.slice(1);

            await connection.query("TRUNCATE TABLE part_c_questions");

            const insertQuestion = `
                INSERT INTO part_c_questions
                (study_part_id, sent_set, text_id, sent_order, p3_con_id, predict_id, make_sense_id, text_type_id, gen_type_id, question_text, option_1, option_2, option_3, option_4, correct_ans, correct_option)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            for (const line of dataLines) {
                const cols = parseCSVLine(line);
                if (cols.length < 15) continue;
                // StudyPartID(0), SentSet(1), TextID(2), SentOrder(3), P3ConID(4), PredictID(5), Make_sense_ID(6), TextTypeID(7), GenTypeID(8), Questions(9), Option_1(10), Option_2(11), Option_3(12), Option_4(13), CorrectAns(14)

                const correctAns = (cols[14] || "").trim();
                let correctOption = 0;
                if (correctAns === (cols[10] || "").trim()) correctOption = 1;
                else if (correctAns === (cols[11] || "").trim()) correctOption = 2;
                else if (correctAns === (cols[12] || "").trim()) correctOption = 3;
                else if (correctAns === (cols[13] || "").trim()) correctOption = 4;

                await connection.execute(insertQuestion, [
                    parseInt(cols[0]) || 0,
                    parseInt(cols[1]) || 0,
                    cols[2],
                    parseInt(cols[3]) || 0,
                    cols[4],
                    parseInt(cols[5]) || 0,
                    parseInt(cols[6]) || 0,
                    parseInt(cols[7]) || 0,
                    parseInt(cols[8]) || 0,
                    cols[9],
                    cols[10],
                    cols[11],
                    cols[12],
                    cols[13],
                    cols[14],
                    correctOption
                ]);
            }
            questionsCount = dataLines.length;
        } else {
            console.warn("Questions CSV not found at", questionsPath);
            fs.writeFileSync('seed_quest_missing.txt', questionsPath);
        }

        await connection.commit();
        await connection.query("SET FOREIGN_KEY_CHECKS = 1");

        fs.writeFileSync('seed_success.txt', JSON.stringify({ sentencesCount, questionsCount }));
        return NextResponse.json({
            success: true,
            sentencesSeeded: sentencesCount,
            questionsSeeded: questionsCount
        });

    } catch (error: unknown) {
        if (connection) await connection.rollback();
        console.error("Seeding error:", error);

        return NextResponse.json({ error: "Failed to seed study materials" }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}
