import type { RowDataPacket } from "mysql2";
import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { parsePartCLogEvent } from "@/lib/part-c-timing";

interface SentenceRow extends RowDataPacket {
    content: string;
}

export async function POST(request: Request): Promise<NextResponse> {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const event = parsePartCLogEvent(body);
    if (!event) {
        return NextResponse.json({ error: "Invalid reading log or millisecond durations" }, { status: 400 });
    }
    try {
        const [sentences] = await pool.execute<SentenceRow[]>(
            "SELECT content FROM part_c_sentences WHERE set_id = ? AND sentence_index = ?",
            [event.setId, event.sentenceIndex]
        );
        if (!sentences.length) {
            return NextResponse.json({ error: "Sentence not found" }, { status: 404 });
        }
        if (event.action === "word_reveal" || (event.action === "timeout" && event.wordIndex !== null)) {
            const wordCount = sentences[0].content.split(" ").filter(Boolean).length;
            if (event.wordIndex === null || event.wordIndex >= wordCount ||
                (event.action === "word_reveal" && (event.wordIndex === wordCount - 1) !== (event.sentenceReadingTimeMs !== null))) {
                return NextResponse.json({ error: "Sentence duration is required only for the last word" }, { status: 400 });
            }
        }
        await pool.execute(
            `INSERT INTO part_c_logs
                (event_id, participant_id, set_id, sentence_index, word_index, action_type,
                 word_reading_time_ms, sentence_reading_time_ms, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE event_id = part_c_logs.event_id`,
            [event.eventId, event.participantId, event.setId, event.sentenceIndex, event.wordIndex, event.action,
                event.wordReadingTimeMs, event.sentenceReadingTimeMs,
                new Date().toISOString().slice(0, 23).replace("T", " ")]
        );
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && error.code === "ER_NO_REFERENCED_ROW_2") {
            return NextResponse.json({ error: "Participant not found" }, { status: 404 });
        }
        console.error("Failed to save Part C reading log:", error);
        return NextResponse.json({ error: "Failed to save log" }, { status: 500 });
    }
}
