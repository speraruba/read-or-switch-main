import type { RowDataPacket } from "mysql2";
import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { validateDemographicCategories } from "@/lib/demographics";

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid demographic details" }, { status: 400 });
  }
  const {
    participantId,
    dobMonth,
    dobDay,
    dobYear,
    gender,
    education,
    nativeSpeaker,
    firstLanguage,
    proficiencyReading,
    proficiencyWriting,
    isHispanic,
    race,
    knowledge,
  } = body;

  if (!participantId) {
    return NextResponse.json(
      { error: "Missing participant ID" },
      { status: 400 },
    );
  }

  const categoryError = validateDemographicCategories(body);
  if (categoryError) {
    return NextResponse.json({ error: categoryError }, { status: 400 });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Insert Participant (with conditions)
    const pid = BigInt(participantId);
    const part2Condition = Number(pid % BigInt(2)); // 0 or 1
    const part1Condition = Number(pid % BigInt(3)); // 0, 1, or 2

    try {
      await connection.execute(
        `INSERT INTO participants (participant_id, part2_condition, part1_condition)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                 part2_condition = IFNULL(part2_condition, VALUES(part2_condition)),
                 part1_condition = IFNULL(part1_condition, VALUES(part1_condition))`,
        [participantId, part2Condition, part1Condition],
      );
    } catch (err: unknown) {
      // Self-healing: invalid column
      if (err && typeof err === "object" && "code" in err && err.code === "ER_BAD_FIELD_ERROR") {
        console.log("Detected missing columns, attempting to fix schema...");
        await connection.rollback(); // Rollback current transaction to allow DDL

        // Add columns (one by one or together)
        // Note: IF NOT EXISTS available in newer MySQL/MariaDB, but standard MySQL might fail if exists.
        // We'll try adding them. If they exist, it might fail, which is fine, we just proceed to retry.
        try {
          await connection.query(
            `ALTER TABLE participants ADD COLUMN part2_condition INT COMMENT '0 or 1'`,
          );
        } catch (error) {
          if (!(error && typeof error === "object" && "code" in error && error.code === "ER_DUP_FIELDNAME")) throw error;
        }
        try {
          await connection.query(
            `ALTER TABLE participants ADD COLUMN part1_condition INT COMMENT '0, 1, or 2'`,
          );
        } catch (error) {
          if (!(error && typeof error === "object" && "code" in error && error.code === "ER_DUP_FIELDNAME")) throw error;
        }

        // Restart transaction
        await connection.beginTransaction();
        await connection.execute(
          `INSERT INTO participants (participant_id, part2_condition, part1_condition)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                     part2_condition = IFNULL(part2_condition, VALUES(part2_condition)),
                     part1_condition = IFNULL(part1_condition, VALUES(part1_condition))`,
          [participantId, part2Condition, part1Condition],
        );
      } else {
        throw err;
      }
    }

    // 2. Insert or Update Demographics
    const dob = `${dobYear}-${dobMonth}-${dobDay}`;
    // Delete existing demographics if any to simplify update
    await connection.execute(
      "DELETE FROM demographics WHERE participant_id = ?",
      [participantId],
    );

    await connection.execute(
      `INSERT INTO demographics (
        participant_id, dob, gender, education_level,
        native_speaker, first_language, proficiency_reading, proficiency_writing,
        is_hispanic, race
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        participantId,
        dob,
        gender,
        education,
        nativeSpeaker === "Yes",
        firstLanguage || null,
        proficiencyReading,
        proficiencyWriting,
        isHispanic === "Yes",
        race,
      ],
    );

    // 3. Insert Knowledge Ratings
    await connection.execute(
      "DELETE FROM participant_knowledge WHERE participant_id = ?",
      [participantId],
    );

    // Fetch topics from Part B and Part A Subtopics ONLY
    const [topicsB] = await connection.query<RowDataPacket[]>(
      "SELECT id, title FROM part_b_topic",
    );
    const [subtopicsC] = await connection.query<RowDataPacket[]>(
      "SELECT subtopID as id, subtopTitle as title FROM part_a_subtopic",
    );

    const topicMap = new Map<string, string>();

    const normalize = (s: string) => s.trim().toLowerCase();

    const addTopicsToMap = (topics: RowDataPacket[]) => {
      topics.forEach((t) => {
        if (t.title && t.id) {
          topicMap.set(normalize(t.title), t.id); // Map Name -> ID? Or Name -> Name?
          // User asked "topic id to topic". If the column is `topic`, we should probably store the ID if available, or the NAME?
          // Usually `topic` column implies the NAME. `topic_id` implies ID.
          // But if I store ID in `topic` column, it's just a rename.
          // If I store NAME in `topic` column, then I map Name -> Name.
          // "change the schema ... topic id to topic" + "participant knowledge didn't record"
          // If I store the ID, I maintain the foreign key relationship logic (conceptually).
          // However, let's look at `part_b_topic` IDs (T1, T2...) and `part_a_subtopic` IDs (101, 102...).
          // Storing IDs seems safer for uniqueness. I will continue to store IDs in the `topic` column.
          // If the user meant "store the text topic", they would usually say "change type to text" or "store name".
          // Given the ambiguity, I'll stick to storing the ID which was the previous working state, just column renamed.
        }
      });
    };

    addTopicsToMap(topicsB);
    addTopicsToMap(subtopicsC);

    for (const [topicName, rating] of Object.entries(knowledge)) {
      const normalizedName = normalize(topicName);
      let topicValue = topicMap.get(normalizedName);

      // Try singular/plural variations if not found
      if (!topicValue) {
        if (normalizedName.endsWith("s")) {
          topicValue = topicMap.get(normalizedName.slice(0, -1));
        } else {
          topicValue = topicMap.get(normalizedName + "s");
        }
      }

      // Fallback: use the name itself if no ID found
      if (!topicValue) {
        topicValue = topicName;
      }

      if (topicValue) {
        await connection.execute(
          "INSERT INTO participant_knowledge (participant_id, subtopic_title, rating) VALUES (?, ?, ?)",
          [participantId, topicValue, rating],
        );
      }
    }

    await connection.commit();
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (connection) await connection.rollback();
    console.error("Database error details:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Database error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
}
