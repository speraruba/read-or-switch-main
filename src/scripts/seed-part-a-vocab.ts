
import { query } from "../lib/db";
import { RowDataPacket } from "mysql2";

const questions = [
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

async function seedVocab() {
    console.log("Seeding Vocabulary Questions...");

    try {
        // Clear existing
        await query("TRUNCATE TABLE part_a_vocabulary_questions");

        for (const q of questions) {
            await query(
                `INSERT INTO part_a_vocabulary_questions 
                (word, option_1, option_2, option_3, option_4, option_5, option_6, correct_option) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [q.word, q.options[0], q.options[1], q.options[2], q.options[3], q.options[4], q.options[5], q.correct]
            );
        }

        console.log("Vocabulary Questions Seeded Successfully!");
        process.exit(0);
    } catch (e) {
        console.error("Error seeding vocab:", e);
        process.exit(1);
    }
}

seedVocab();
