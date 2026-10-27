
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { RowDataPacket } from "mysql2";

export async function GET() {
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT id, set_id, sentence_index, content FROM part_c_sentences ORDER BY set_id, sentence_index"
        );
        return NextResponse.json(rows);
    } catch (error: unknown) {
        console.error("Database error:", error);
        return NextResponse.json({ error: "Failed to fetch sentences" }, { status: 500 });
    }
}
