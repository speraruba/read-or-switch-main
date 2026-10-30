import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

import { query } from "@/lib/db";
import { isAllowedRequestOrigin } from "@/lib/request-origin";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
    const origin = request.headers.get("origin");
    if (!isAllowedRequestOrigin(origin, request.url, process.env.RAILWAY_PUBLIC_DOMAIN)) {
        return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "Voice input is not configured yet. Please contact the researcher." }, { status: 503 });
    }
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    if (!body || typeof body !== "object" || !("sdp" in body) || typeof body.sdp !== "string" ||
        !body.sdp.startsWith("v=0") || body.sdp.length > 65536 ||
        !("participantId" in body) || typeof body.participantId !== "string" || !/^\d{1,19}$/.test(body.participantId) ||
        !("language" in body) || !["auto", "en", "zh"].includes(String(body.language))) {
        return NextResponse.json({ error: "Invalid voice session request." }, { status: 400 });
    }
    try {
        const participants = await query("SELECT participant_id FROM participants WHERE participant_id = ?", [body.participantId]) as RowDataPacket[];
        if (!participants.length) {
            return NextResponse.json({ error: "Please start the study from the welcome page before recording." }, { status: 404 });
        }
        const session = {
            type: "transcription",
            audio: { input: {
                transcription: {
                    model: "gpt-live-transcribe",
                    delay: "low",
                    ...(body.language === "auto" ? {} : { languages: [body.language] }),
                },
                turn_detection: null,
            } },
        };
        const signal = AbortSignal.any([request.signal, AbortSignal.timeout(25000)]);
        // Transcription sessions are configured through client_secrets. Keep even
        // the short-lived credential on the server and return only the SDP answer.
        const tokenResponse = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ session }),
            signal,
        });
        if (!tokenResponse.ok) {
            console.error("Failed to create transcription credentials:", tokenResponse.status);
            return NextResponse.json({ error: "Voice input could not connect. Please contact the researcher." }, { status: 502 });
        }
        const token: unknown = await tokenResponse.json();
        if (!token || typeof token !== "object" || !("value" in token) || typeof token.value !== "string") {
            throw new Error("Invalid transcription credentials response");
        }
        const response = await fetch("https://api.openai.com/v1/realtime/calls", {
            method: "POST",
            headers: { Authorization: `Bearer ${token.value}`, "Content-Type": "application/sdp" },
            body: body.sdp,
            signal,
        });
        if (!response.ok) {
            console.error("Failed to create transcription session:", response.status);
            return NextResponse.json({ error: "Voice input could not connect. Please try again or contact the researcher." }, { status: 502 });
        }
        return NextResponse.json({ sdp: await response.text() }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("Failed to create transcription session:", error instanceof Error ? error.name : "Unknown error");
        return NextResponse.json({ error: "Voice input is temporarily unavailable. Please try again or contact the researcher." }, { status: 500 });
    }
}
