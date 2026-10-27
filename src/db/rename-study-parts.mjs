import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import mysql from "mysql2/promise";

// One-time migration from the former A=sentences / C=multi-text naming.
// Never run the destructive schema/seed migration on an existing database.
const connection = await mysql.createConnection(process.env.MYSQL_URL ? {
    uri: process.env.MYSQL_URL,
    supportBigNumbers: true,
    bigNumberStrings: true,
} : {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    supportBigNumbers: true,
    bigNumberStrings: true,
});
const quote = name => {
    if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error("Invalid database identifier");
    return `\`${name}\``;
};
const digest = rows => createHash("sha256").update(rows.map(row => JSON.stringify(row)).sort().join("\n")).digest("hex");
let locked = false;
try {
    const [[database]] = await connection.query("SELECT DATABASE() AS name");
    const [[lock]] = await connection.execute("SELECT GET_LOCK(?, 10) AS acquired", [`${database.name}:rename-study-parts`]);
    assert.equal(Number(lock.acquired), 1, "Another naming migration is running");
    locked = true;
    const [tables] = await connection.query("SHOW TABLES");
    const names = tables.map(row => Object.values(row)[0]);
    const oldNaming = names.includes("part_a_sentences");
    if (oldNaming) {
        assert.ok(!names.includes("part_c_sentences"), "Mixed naming: both sentence tables exist; refusing to guess");
        const affected = names.filter(name => /^part_[ac]_/.test(name));
        const snapshot = [];
        for (const name of [...affected, "participants"]) {
            const [rows] = await connection.query(`SELECT * FROM ${quote(name)}`);
            const [[ddl]] = await connection.query(`SHOW CREATE TABLE ${quote(name)}`);
            snapshot.push({ name, createSql: ddl["Create Table"], rows, digest: digest(rows) });
        }
        const backupDir = await mkdtemp(path.join(os.tmpdir(), "read-or-switch-part-names-"));
        await writeFile(path.join(backupDir, "backup.json"), JSON.stringify(snapshot), { mode: 0o600 });
        console.log(`Pre-migration backup: ${backupDir}/backup.json`);
        // All swaps happen in one atomic RENAME TABLE statement, including collisions.
        const intermediate = name => `rename_study_${name}`;
        assert.ok(affected.every(name => !names.includes(intermediate(name))), "Temporary table name already exists");
        const target = name => name.startsWith("part_a_") ? name.replace(/^part_a_/, "part_c_") : name.replace(/^part_c_/, "part_a_");
        const renames = [
            ...affected.map(name => `${quote(name)} TO ${quote(intermediate(name))}`),
            ...affected.map(name => `${quote(intermediate(name))} TO ${quote(target(name))}`),
        ];
        await connection.query(`RENAME TABLE ${renames.join(", ")}`);
        for (const before of snapshot.filter(table => table.name !== "participants")) {
            const [after] = await connection.query(`SELECT * FROM ${quote(target(before.name))}`);
            assert.equal(digest(after), before.digest, `Data mismatch for ${before.name}`);
        }
        console.log(`Renamed ${affected.length} tables; all rows verified unchanged.`);
    } else {
        assert.ok(names.includes("part_c_sentences"), "Sentence tables not found; initialize a new database with the current schema instead");
        console.log("Table names already match A → B → C; checking remaining metadata.");
    }
    // These steps are safe to rerun if interrupted after the atomic table swap.
    const renameColumn = async (table, oldName, newName) => {
        const [columns] = await connection.execute(
            "SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?", [table]
        );
        if (columns.some(column => column.name === oldName)) {
            assert.ok(!columns.some(column => column.name === newName), `Both column names exist in ${table}`);
            await connection.query(`ALTER TABLE ${quote(table)} RENAME COLUMN ${quote(oldName)} TO ${quote(newName)}`);
        }
    };
    await renameColumn("participants", "part3_condition", "part1_condition");
    await renameColumn("part_c_sentences", "sp1_con_id", "sp3_con_id");
    await renameColumn("part_c_questions", "p1_con_id", "p3_con_id");
    for (const table of ["part_c_sentences", "part_c_questions"]) {
        await connection.execute(`UPDATE ${quote(table)} SET study_part_id = 3 WHERE study_part_id = 1`);
    }
    const [indexes] = await connection.execute(
        "SELECT INDEX_NAME AS name FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'part_c_logs'"
    );
    if (indexes.some(index => index.name === "part_a_logs_event_id_unique")) {
        await connection.query("ALTER TABLE part_c_logs RENAME INDEX part_a_logs_event_id_unique TO part_c_logs_event_id_unique");
    }
    console.log("Study part naming migration complete. No participant or response records deleted.");
} finally {
    if (locked) {
        const [[database]] = await connection.query("SELECT DATABASE() AS name");
        await connection.execute("SELECT RELEASE_LOCK(?)", [`${database.name}:rename-study-parts`]);
    }
    await connection.end();
}
