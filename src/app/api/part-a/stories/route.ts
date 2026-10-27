
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const phase = searchParams.get("phase");

    if (!phase) {
        return NextResponse.json({ error: "Phase is required" }, { status: 400 });
    }

    try {
        const tableName = phase === 'practice' ? 'part_a_prac_topic' : 'part_a_topic';
        const stories = await query(
            `SELECT topID as id, topTitle as title FROM ${tableName}`
        );
        return NextResponse.json(stories);
    } catch (error) {
        console.error("Failed to fetch stories:", error);
        return NextResponse.json({ error: "Failed to fetch stories" }, { status: 500 });
    }
}
