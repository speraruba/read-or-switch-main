import mysql from "mysql2/promise";

const connection = await mysql.createConnection(process.env.MYSQL_URL ? {
    uri: process.env.MYSQL_URL,
} : {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

try {
    // Match only the original placeholder row. Keep its ID and correct-option
    // position, so existing participant responses retain their references.
    // Wording comes from docs/Study Material/part_c_questions.csv.
    const [result] = await connection.execute(`
        UPDATE part_c_questions
        SET option_1 = ?, option_2 = ?, option_3 = ?, option_4 = ?, correct_ans = ?
        WHERE text_id = ? AND sent_set = 1 AND sent_order = 1
            AND TRIM(question_text) = ?
            AND option_1 = 'Word_1' AND option_2 = 'Word_2'
            AND option_3 = 'Word_3' AND option_4 = 'Word_4'
            AND correct_ans = 'Word_3' AND correct_option = 3
    `, [
        "stripes", "spots", "cries", "manes", "cries", "SP1SS0101",
        "Giraffes are known for their long necks and zebras for their ____.",
    ]);
    console.log(`Repaired ${result.affectedRows} placeholder question(s); question IDs and responses preserved.`);
} finally {
    await connection.end();
}
