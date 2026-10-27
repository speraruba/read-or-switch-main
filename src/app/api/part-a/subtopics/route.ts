import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const phase = searchParams.get("phase");
    const topicId = searchParams.get("topicId");

    if (!phase) {
        return NextResponse.json({ error: "Phase is required" }, { status: 400 });
    }

    try {
        const tableName = phase === 'practice' ? 'part_a_prac_subtopic' : 'part_a_subtopic';

        // If topicId is provided, filter by it. Otherwise fetch all.
        let querySql = `SELECT subtopID as id, subtopTitle as title, topID as topic_id FROM ${tableName}`;
        const queryParams: string[] = [];

        if (topicId) {
            querySql += " WHERE topID = ?";
            queryParams.push(topicId);
        }

        const subtopics = await query(querySql, queryParams);
        return NextResponse.json(subtopics);
    } catch (error) {
        console.error("Failed to fetch subtopics:", error);
        return NextResponse.json({ error: "Failed to fetch subtopics" }, { status: 500 });
    }
}
