import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import mysql from "mysql2/promise";

const host = process.env.DB_HOST;
assert(["localhost", "127.0.0.1", "::1"].includes(host), "A local DB_HOST is required.");
const database = "qa_concurrent_" + randomBytes(8).toString("hex");
const connection = await mysql.createConnection({
    host, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT || 3306), multipleStatements: true,
});
let created = false;
let child;
try {
    await connection.query("CREATE DATABASE ??", [database]);
    created = true;
    await connection.query("USE ??", [database]);
    await connection.query(await readFile("src/db/schema.sql", "utf8"));

    const listener = createServer();
    listener.listen(0, "127.0.0.1");
    await once(listener, "listening");
    const port = listener.address().port;
    await new Promise(resolveClose => listener.close(resolveClose));
    child = spawn(process.execPath, [resolve(".next/standalone/server.js")], {
        env: { ...process.env, MYSQL_URL: "", DB_NAME: database, NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: String(port) },
        stdio: ["ignore", "pipe", "inherit"],
    });
    // Only send requests after this child has bound its port.
    const output = createInterface({ input: child.stdout });
    const timeout = setTimeout(() => child.kill(), 20000);
    try {
        let ready = false;
        for await (const line of output) {
            if (line.includes("Ready in")) { ready = true; break; }
        }
        assert(ready, "Build the standalone app before running this test.");
    } finally {
        clearTimeout(timeout);
    }

    async function post(path, body) {
        const response = await fetch(`http://127.0.0.1:${port}/api/${path}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
        });
        assert.equal(response.status, 200, `${path}: ${await response.text()}`);
    }

    const ids = Array.from({ length: 10 }, (_, i) => String(i + 1));
    const sessions = ids.map(() => randomUUID());
    await Promise.all(ids.map(participantId => post("participants", {
        participantId, confirmParticipantId: participantId, consented: true,
    })));
    for (let wave = 0; wave < 10; wave++) {
        await Promise.all(ids.map((participantId, index) => post("demographics", {
            participantId, dobYear: "1990", dobMonth: "04", dobDay: "01", gender: "Female",
            education: 4, nativeSpeaker: "Yes", proficiencyReading: 7, proficiencyWriting: 7,
            isHispanic: "No", race: "Asian", knowledge: { Vaccine: (index + wave) % 7 + 1 },
        })));
        await Promise.all(ids.map((participantId, index) => post("part-a/cognitive/letter", {
            participantId, submissionId: sessions[index], roundDurations: { 1: 100, 2: 200 },
            responses: Array.from({ length: 20 }, (_, i) => ({
                problemId: i + 1, response: i % 2 ? "D" : "S", reactionTimeMs: index + i,
            })),
        })));
    }
    for (const [index, id] of ids.entries()) {
        const [[demo]] = await connection.execute("SELECT COUNT(*) AS n FROM demographics WHERE participant_id=?", [id]);
        assert.equal(demo.n, 1);
        const [scores] = await connection.execute("SELECT rating FROM participant_knowledge WHERE participant_id=?", [id]);
        assert.deepEqual(scores, [{ rating: (index + 9) % 7 + 1 }]);
        const [items] = await connection.execute(
            "SELECT sid,reaction_time_ms FROM part_a_letter_item WHERE participant_id=? ORDER BY round_number,item_index", [id]
        );
        assert.equal(items.length, 20);
        items.forEach((item, i) => {
            assert.equal(item.sid, sessions[index]);
            assert.equal(item.reaction_time_ms, index + i);
        });
    }
    console.log("PASS: 10 participants, 10 simultaneous submission waves, participant-specific answers verified.");
} finally {
    if (child && child.exitCode === null && child.signalCode === null) {
        const exited = once(child, "exit");
        child.kill();
        await exited;
    }
    try {
        if (created) await connection.query("DROP DATABASE ??", [database]);
    } finally {
        await connection.end();
    }
}
