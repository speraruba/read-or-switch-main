import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

// Lock the participant before reading existing answers, including on the first submission.
export async function withParticipantTransaction(
    participantId: string,
    save: (connection: PoolConnection) => Promise<NextResponse>
): Promise<NextResponse> {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [participants] = await connection.execute<RowDataPacket[]>(
            "SELECT participant_id FROM participants WHERE participant_id = ? FOR UPDATE", [participantId]
        );
        const response = participants.length
            ? await save(connection)
            : NextResponse.json({ error: "Participant not found" }, { status: 404 });
        if (response.ok) await connection.commit();
        else await connection.rollback();
        return response;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}
