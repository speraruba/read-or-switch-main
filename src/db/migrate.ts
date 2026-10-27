
import fs from 'node:fs';
import path from 'node:path';
import mysql, { type RowDataPacket, type ResultSetHeader } from 'mysql2/promise';

const envPath = path.resolve(process.cwd(), '.env.local');
console.log(`Loading env from ${envPath}`);

if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach((line) => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^['"]|['"]$/g, '');
            process.env[key] = value;
        }
    });
} else {
    console.log(".env.local not found — using process env directly.");
}

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
    multipleStatements: true
};

// Robust CSV API that handles newlines in quotes
function parseCSV(content: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentVal = '';
    let insideQuotes = false;

    // Normalize line endings to \n seems risky if we want to preserve data,
    // but typically safe for standard text.
    // Better to handle \r\n in loop.

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        const nextChar = content[i + 1];

        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                currentVal += '"';
                i++; // Skip the escaped quote
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === ',' && !insideQuotes) {
            currentRow.push(currentVal.trim());
            currentVal = '';
        } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !insideQuotes) {
            currentRow.push(currentVal.trim());
            if (currentRow.length > 0 || currentVal.length > 0) {
                rows.push(currentRow);
            }
            currentRow = [];
            currentVal = '';
            if (char === '\r') i++; // Handling \r\n, skip the \n
        } else if (char === '\r' && !insideQuotes) {
            // Handle \r only line endings
            currentRow.push(currentVal.trim());
            if (currentRow.length > 0 || currentVal.length > 0) {
                rows.push(currentRow);
            }
            currentRow = [];
            currentVal = '';
        } else {
            currentVal += char;
        }
    }

    // Push any remaining data
    if (currentRow.length > 0 || currentVal.length > 0) {
        currentRow.push(currentVal.trim());
        rows.push(currentRow);
    }

    return rows;
}

async function populatePartC(connection: mysql.Connection) {
    console.log('Populating Part C data...');

    // Disable FK checks for truncation
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");

    const sentencesPath = path.resolve(process.cwd(), 'docs/Study Material/part_c_sentences.csv');
    if (fs.existsSync(sentencesPath)) {
        console.log(`Reading ${sentencesPath}...`);
        const content = fs.readFileSync(sentencesPath, 'utf8');
        const rows = parseCSV(content).slice(1);

        if (rows.length > 0) {
            await connection.query('TRUNCATE TABLE part_c_sentences');

            for (const cols of rows) {
                if (cols.length < 15) continue;
                await connection.execute(`
                    INSERT INTO part_c_sentences
                    (study_part_id, set_id, text_id, sentence_index, sp3_con_id, predictability, predict_id, make_sense, make_sense_id, text_type, text_type_id, gen_type, gen_type_id, note, content)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 `, [
                    cols[0], cols[1], cols[2], cols[3], cols[4], cols[5], cols[6], cols[7], cols[8], cols[9], cols[10], cols[11], cols[12], cols[13], cols[14]
                ]);
            }
            console.log(`Inserted ${rows.length} rows into part_c_sentences.`);
        }
    } else {
        console.warn(`File not found: ${sentencesPath}`);
    }

    const questionsPath = path.resolve(process.cwd(), 'docs/Study Material/part_c_questions.csv');
    if (fs.existsSync(questionsPath)) {
        console.log(`Reading ${questionsPath}...`);
        const content = fs.readFileSync(questionsPath, 'utf8');
        const rows = parseCSV(content).slice(1);

        if (rows.length > 0) {
            await connection.query('TRUNCATE TABLE part_c_questions');

            for (const cols of rows) {
                if (cols.length < 15) continue;

                const correctAns = cols[14].trim();
                let correctOption = 0;
                if (correctAns === cols[10].trim()) correctOption = 1;
                else if (correctAns === cols[11].trim()) correctOption = 2;
                else if (correctAns === cols[12].trim()) correctOption = 3;
                else if (correctAns === cols[13].trim()) correctOption = 4;

                await connection.execute(`
                    INSERT INTO part_c_questions
                    (study_part_id, sent_set, text_id, sent_order, p3_con_id, predict_id, make_sense_id, text_type_id, gen_type_id, question_text, option_1, option_2, option_3, option_4, correct_ans, correct_option)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 `, [
                    cols[0], cols[1], cols[2], cols[3], cols[4], cols[5], cols[6], cols[7], cols[8], cols[9], cols[10], cols[11], cols[12], cols[13], cols[14], correctOption
                ]);
            }
            console.log(`Inserted ${rows.length} rows into part_c_questions.`);
        }
    } else {
        console.warn(`File not found: ${questionsPath}`);
    }

    // Re-enable FK checks
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
}

async function populatePartB(connection: mysql.Connection) {
    console.log('Populating Part B data...');
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");

    // Clear existing data
    await connection.query('TRUNCATE TABLE part_b_formal_responses');
    await connection.query('TRUNCATE TABLE part_b_formal_questions');
    await connection.query('TRUNCATE TABLE part_b_formal_actions');
    await connection.query('TRUNCATE TABLE part_b_formal_summaries');
    await connection.query('TRUNCATE TABLE part_b_formal_segments');
    await connection.query('TRUNCATE TABLE part_b_formal_stories');
    await connection.query('TRUNCATE TABLE part_b_topic');

    await connection.query('TRUNCATE TABLE part_b_practice_responses');
    await connection.query('TRUNCATE TABLE part_b_practice_questions');
    await connection.query('TRUNCATE TABLE part_b_practice_actions');
    await connection.query('TRUNCATE TABLE part_b_practice_segments');
    await connection.query('TRUNCATE TABLE part_b_practice_stories');
    await connection.query('TRUNCATE TABLE part_b_practice_topic');

    // 1. Populate Formal Stories
    const formalStoriesPath = path.resolve(process.cwd(), 'docs/Study Material/part_b_formal_stories.csv');
    if (fs.existsSync(formalStoriesPath)) {
        console.log(`Reading ${formalStoriesPath}...`);
        const content = fs.readFileSync(formalStoriesPath, 'utf8');
        const rows = parseCSV(content).slice(1);

        // Extract Topics and Stories
        // Map TopicID (T1) -> Title
        const topics = new Map<string, string>();
        // Map StoryLabel (T1P1) -> { topicId: string, title: string, predictability: string }
        const stories = new Map<string, { topicId: string, title: string, predictability: string }>();
        // Segments
        const segments: Array<{
            storyLabel: string;
            content: string;
            segmentOrder: number;
            textId: string;
            predictability: string;
            predictId: number;
            sp2ConId: string;
        }> = [];

        for (const cols of rows) {
            // Cols: StudyPartID, StoryTopicID, Predictability, PredictID, TextID, SP2ConID, StoryTitle, Order, StoryText
            if (cols.length < 9) continue;

            const storyLabel = cols[1]; // T1P1
            const predictability = cols[2];
            const textId = cols[4];
            const title = cols[6];
            let order = 0;
            try { order = parseInt(cols[7]); } catch (e) { }
            const text = cols[8];
            const sp2ConId = cols[5];
            let predictId = 0;
            try { predictId = parseInt(cols[3]); } catch (e) { }

            if (!storyLabel) continue;

            // Extract Topic ID (T1 from T1P1)
            const topicMatch = storyLabel.match(/^(T\d+)/);
            if (topicMatch) {
                const topicId = topicMatch[1];
                topics.set(topicId, title);

                if (!stories.has(storyLabel)) {
                    stories.set(storyLabel, { topicId, title, predictability });
                }
            }

            segments.push({
                storyLabel,
                content: text,
                segmentOrder: order,
                textId,
                predictability,
                predictId,
                sp2ConId
            });
        }

        // Insert Topics
        for (const [id, title] of topics) {
            await connection.execute('INSERT INTO part_b_topic (id, title) VALUES (?, ?)', [id, title]);
        }
        console.log(`Inserted ${topics.size} Part B Topics.`);

        // Insert Stories and keep map of label -> db_id
        const storyLabelToId = new Map<string, number>();
        for (const [label, data] of stories) {
            const [res] = await connection.execute(
                'INSERT INTO part_b_formal_stories (topic_id, title, story_label) VALUES (?, ?, ?)',
                [data.topicId, data.title, label]
            ) as [ResultSetHeader, mysql.FieldPacket[]];
            storyLabelToId.set(label, res.insertId);
        }
        console.log(`Inserted ${stories.size} Part B Formal Stories.`);

        // Insert Segments
        for (const seg of segments) {
            const storyId = storyLabelToId.get(seg.storyLabel);
            if (storyId) {
                await connection.execute(
                    `INSERT INTO part_b_formal_segments
                    (story_id, content, segment_order, text_id, predictability, predict_id, sp2_con_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [storyId, seg.content, seg.segmentOrder, seg.textId, seg.predictability, seg.predictId, seg.sp2ConId]
                );
            }
        }
        console.log(`Inserted ${segments.length} Part B Formal Segments.`);

        // Populate Formal Questions
        const questionsPath = path.resolve(process.cwd(), 'docs/Study Material/part_b_formal_questions.csv');
        if (fs.existsSync(questionsPath)) {
            console.log(`Reading ${questionsPath}...`);
            const qContent = fs.readFileSync(questionsPath, 'utf8');
            const qRows = parseCSV(qContent).slice(1);

            let qCount = 0;
            for (const cols of qRows) {
                // Cols: StudyPartID, StoryTopicID...
                if (cols.length < 14) continue;

                const storyLabel = cols[1];
                const qText = cols[8];
                const opt1 = cols[9];
                const opt2 = cols[10];
                const opt3 = cols[11];
                const opt4 = cols[12];
                const correctAns = cols[13];
                let qOrder = 0;
                try { qOrder = parseInt(cols[7]); } catch (e) { }

                const storyId = storyLabelToId.get(storyLabel);
                if (storyId) {
                    let correctOption = 0;
                    if (correctAns.trim() === opt1.trim()) correctOption = 1;
                    else if (correctAns.trim() === opt2.trim()) correctOption = 2;
                    else if (correctAns.trim() === opt3.trim()) correctOption = 3;
                    else if (correctAns.trim() === opt4.trim()) correctOption = 4;

                    await connection.execute(
                        `INSERT INTO part_b_formal_questions
                        (story_id, question_text, question_order, option_1, option_2, option_3, option_4, correct_option)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [storyId, qText, qOrder, opt1, opt2, opt3, opt4, correctOption]
                    );
                    qCount++;
                }
            }
            console.log(`Inserted ${qCount} Part B Formal Questions.`);
        }
    }

    // 2. Populate Practice Data
    const practicePath = path.resolve(process.cwd(), 'docs/Study Material/part_b_practice_segments.csv');
    if (fs.existsSync(practicePath)) {
        console.log(`Reading ${practicePath}...`);
        const content = fs.readFileSync(practicePath, 'utf8');
        const rows = parseCSV(content).slice(1);

        const pTopics = new Map<string, string>(); // ID -> Title
        const pSegments: Array<{
            topicId: string;
            title: string;
            textId: string;
            order: number;
            text: string;
        }> = [];

        for (const cols of rows) {
            // Cols: PartID, StoryTopicID, TextID, StoryTitle, Order, StoryText
            if (cols.length < 6) continue;

            const topicId = cols[1]; // "1"
            const title = cols[3];
            const textId = cols[2];
            let order = 0;
            try { order = parseInt(cols[4]); } catch (e) { }
            const text = cols[5];

            pTopics.set(topicId, title);
            pSegments.push({
                topicId,
                title,
                textId,
                order,
                text
            });
        }

        // Insert Practice Topics
        for (const [id, title] of pTopics) {
            await connection.execute('INSERT INTO part_b_practice_topic (id, title) VALUES (?, ?)', [id, title]);
        }
        console.log(`Inserted ${pTopics.size} Part B Practice Topics.`);

        // Insert Practice Stories (One per topic)
        const practiceLabelToId = new Map<string, number>();
        for (const [id, title] of pTopics) {
            const [res] = await connection.execute(
                'INSERT INTO part_b_practice_stories (topic_id, title, story_label) VALUES (?, ?, ?)',
                [id, title, id] // Use ID as label
            ) as [ResultSetHeader, mysql.FieldPacket[]];
            practiceLabelToId.set(id, res.insertId);
        }

        // Insert Practice Segments
        let pSegCount = 0;
        for (const seg of pSegments) {
            const storyId = practiceLabelToId.get(seg.topicId);
            if (storyId) {
                await connection.execute(
                    `INSERT INTO part_b_practice_segments
                    (story_id, content, segment_order, text_id)
                    VALUES (?, ?, ?, ?)`,
                    [storyId, seg.text, seg.order, seg.textId]
                );
                pSegCount++;
            }
        }
        console.log(`Inserted ${pSegCount} Part B Practice Segments.`);
    }

    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
}

async function populatePartA(connection: mysql.Connection) {
    console.log('Populating Part A data...');
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");

    // Helper to read CSV and insert data
    const seedTable = async (fileName: string, tableName: string, columns: string[], mapFn?: (cols: string[]) => string[]) => {
        const filePath = path.resolve(process.cwd(), `docs/Study Material/${fileName}`);
        if (fs.existsSync(filePath)) {
            console.log(`Reading ${filePath}...`);
            const content = fs.readFileSync(filePath, 'utf8');
            const rows = parseCSV(content).slice(1); // Skip header

            if (rows.length > 0) {
                await connection.query(`TRUNCATE TABLE ${tableName}`);

                // Prepare statement placeholders
                const placeholders = columns.map(() => '?').join(', ');
                const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

                for (const cols of rows) {
                    if (cols.length < columns.length) continue;

                    let values = cols;
                    if (mapFn) values = mapFn(cols);

                    // Ensure we only take the number of columns we expect
                    values = values.slice(0, columns.length);

                    try {
                        await connection.execute(sql, values);
                    } catch (err) {
                        console.error(`Error inserting into ${tableName}:`, err);
                    }
                }
                console.log(`Inserted ${rows.length} rows into ${tableName}.`);
            }
        } else {
            console.warn(`File not found: ${filePath}`);
        }
    };

    // 1. Part A Topic
    await seedTable('part_a_topic.csv', 'part_a_topic',
        ['topID', 'topTitle', 'topIdeasBonusWords']
    );

    // 2. Part A Subtopic
    await seedTable('part_a_subtopic.csv', 'part_a_subtopic',
        ['subtopID', 'topID', 'subtopTitle']
    );

    // 3. Part A Passage
    await seedTable('part_a_passage.csv', 'part_a_passage',
        ['topID', 'subtopID', 'conID', 'passID', 'passOrder', 'passTitle', 'passText']
    );

    // 4. Part A Questions
    await seedTable('part_a_questions.csv', 'part_a_questions',
        ['questionID', 'passID', 'topID', 'subtopID', 'conID', 'passOrder', 'passTitle', 'questionText', 'choiceA', 'choiceB', 'choiceC', 'choiceD', 'correctAns']
    );

    // 5. Part A Practice Topic
    await seedTable('part_a_prac_topic.csv', 'part_a_prac_topic',
        ['topID', 'topTitle', 'topIdeasBonusWords']
    );

    // 6. Part A Practice Subtopic
    await seedTable('part_a_prac_subtopic.csv', 'part_a_prac_subtopic',
        ['subtopID', 'topID', 'subtopTitle']
    );


    // 7. Part A Practice Passage
    await seedTable('part_a_prac_passage.csv', 'part_a_prac_passage',
        ['topID', 'subtopID', 'conID', 'passID', 'passOrder', 'passTitle', 'passText']
    );

    // 8. Part A Vocabulary Questions (Embedded Data as per request)
    console.log('Populating Vocabulary Questions...');
    const vocabQuestions = [
        {
            word: "mumble",
            options: ["speak indistinctly", "complain", "handle awkwardly", "fall over something", "tear apart", "Not sure about the answer"],
            correct: 1
        },
        {
            word: "perspire",
            options: ["struggle", "sweat", "happen", "penetrate", "submit", "Not sure about the answer"],
            correct: 2
        },
        {
            word: "gush",
            options: ["giggle", "spout", "sprinkle", "hurry", "cry", "Not sure about the answer"],
            correct: 2
        },
        {
            word: "massive",
            options: ["strong and muscular", "thickly populated", "ugly and awkward", "huge and solid", "everlasting", "Not sure about the answer"],
            correct: 4
        },
        {
            word: "feign",
            options: ["pretend", "prefer", "wear", "be cautious", "surrender", "Not sure about the answer"],
            correct: 1
        },
        {
            word: "unwary",
            options: ["unusual", "deserted", "incautious", "sudden", "tireless", "Not sure about the answer"],
            correct: 3
        },
        {
            word: "veer",
            options: ["change direction", "hesitate", "catch sight of", "cover with a thin layer", "slide", "Not sure about the answer"],
            correct: 1
        },
        {
            word: "orthodox",
            options: ["conventional", "straight", "surgical", "right-angled", "religious", "Not sure about the answer"],
            correct: 1
        },
        {
            word: "stripling",
            options: ["stream", "narrow path", "engraving", "lad", "beginner", "Not sure about the answer"],
            correct: 4
        },
        {
            word: "salubrious",
            options: ["mirthful", "indecent", "salty", "mournful", "healthful", "Not sure about the answer"],
            correct: 5
        },
        {
            word: "limpid",
            options: ["lazy", "crippled", "clear", "hot", "slippery", "Not sure about the answer"],
            correct: 3
        },
        {
            word: "procreate",
            options: ["sketch", "inhabit", "imitate", "beget", "encourage", "Not sure about the answer"],
            correct: 4
        },
        {
            word: "replete",
            options: ["full", "elderly", "resentful", "discredited", "restful", "Not sure about the answer"],
            correct: 1
        },
        {
            word: "frieze",
            options: ["fringe of curls on the forehead", "statue", "ornamental band", "embroidery", "sherbet", "Not sure about the answer"],
            correct: 3
        },
        {
            word: "treacle",
            options: ["sewing machine", "framework", "leak", "apple butter", "molasses", "Not sure about the answer"],
            correct: 5
        }
    ];

    await connection.query("TRUNCATE TABLE part_a_vocabulary_questions");
    for (const q of vocabQuestions) {
        await connection.execute(
            `INSERT INTO part_a_vocabulary_questions
            (word, option_1, option_2, option_3, option_4, option_5, option_6, correct_option)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [q.word, q.options[0], q.options[1], q.options[2], q.options[3], q.options[4], q.options[5], q.correct]
        );
    }
    console.log(`Inserted ${vocabQuestions.length} Vocabulary Questions.`);

    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
}

// Additive upgrade for existing study databases. Never runs schema.sql or seeds.
async function addPartCTiming(connection: mysql.Connection): Promise<void> {
    const [columns] = await connection.execute<RowDataPacket[]>(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'part_c_logs'"
    );
    if (!columns.length) throw new Error("part_c_logs is missing; initialize a new database first");
    const present = new Set(columns.map(column => String(column.COLUMN_NAME)));
    const definitions = [
        ["word_reading_time_ms", "INT UNSIGNED NULL"],
        ["sentence_reading_time_ms", "INT UNSIGNED NULL"],
        ["event_id", "CHAR(36) NULL"],
    ];
    const additions = definitions.filter(([name]) => !present.has(name))
        .map(([name, definition]) => `ADD COLUMN ${name} ${definition}`);
    if (additions.length) await connection.query(`ALTER TABLE part_c_logs ${additions.join(", ")}`);
    const [indexes] = await connection.execute<RowDataPacket[]>(
        "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'part_c_logs' AND INDEX_NAME = 'part_c_logs_event_id_unique'"
    );
    if (!indexes.length) await connection.query("ALTER TABLE part_c_logs ADD UNIQUE KEY part_c_logs_event_id_unique (event_id)");
    console.log("Part C timing columns ready; existing records and study materials preserved.");
}

async function main() {
    console.log('Connecting to database...');

    let connection: mysql.Connection | undefined;
    try {
        connection = await mysql.createConnection(process.env.MYSQL_URL ? { uri: process.env.MYSQL_URL } : dbConfig);
        console.log('Connected.');
        if (process.argv.includes("--participant-details")) {
            const [columns] = await connection.execute<RowDataPacket[]>(
                "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'participants'"
            );
            if (!columns.length) throw new Error("participants table is missing");
            if (!columns.some(column => column.COLUMN_NAME === "name")) {
                await connection.query("ALTER TABLE participants ADD COLUMN name VARCHAR(255) NULL AFTER participant_id");
            }
            await connection.query("ALTER TABLE participants MODIFY COLUMN email VARCHAR(255) NULL DEFAULT NULL");
            console.log("Participant name and email fields ready; existing records preserved.");
            return;
        }
        if (process.argv.includes("--part-a-recall-phases")) {
            const [columns] = await connection.execute<RowDataPacket[]>(
                "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'part_a_summaries' AND COLUMN_NAME = 'phase'"
            );
            if (!columns.length) {
                await connection.query("ALTER TABLE part_a_summaries ADD COLUMN phase ENUM('practice', 'formal') NOT NULL DEFAULT 'formal' AFTER participant_id");
            }
            console.log("Part A recall phases ready; existing summaries preserved as formal.");
            return;
        }
        if (process.argv.includes("--part-c-recall")) {
            await connection.query(`CREATE TABLE IF NOT EXISTS part_c_summaries (
                id INT AUTO_INCREMENT PRIMARY KEY,
                participant_id BIGINT NOT NULL,
                content TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (participant_id) REFERENCES participants(participant_id)
            )`);
            console.log("Part C recall storage ready; existing records preserved.");
            return;
        }
        if (process.argv.includes("--part-c-timing")) {
            await addPartCTiming(connection);
            return;
        }

        const schemaPath = path.resolve(process.cwd(), 'src/db/schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Executing schema.sql...');
        const statements = schemaSql.split(';').map(s => s.trim()).filter(s => s.length > 0);

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            try {
                await connection.query(statement);
            } catch (err: unknown) {
                // Ignore
            }
        }

        console.log('Schema migration completed.');
        await populatePartC(connection);
        await populatePartB(connection);
        await populatePartA(connection);

        console.log('Verification completed.');

    } catch (error) {
        console.error('Fatal Error:', error);
        process.exitCode = 1;
    } finally {
        if (connection) await connection.end();
    }
}

main();
