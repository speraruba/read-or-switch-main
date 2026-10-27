import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
    try {
        const [rows] = await pool.query("SELECT * FROM part_c_questions");
        return NextResponse.json(rows);
    } catch (error) {
        console.error("Error fetching Part C questions:", error);
        return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 });
    }
}
