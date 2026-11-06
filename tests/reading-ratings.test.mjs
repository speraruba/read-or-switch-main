import assert from "node:assert/strict";
import { test } from "node:test";

import { getReadingRatingQuestions } from "../src/lib/reading-ratings.ts";

test("legacy display order preserves the existing storage meaning of ease and novelty", () => {
    const questions = getReadingRatingQuestions();
    assert.deepEqual(questions.map(question => question.id), ["c2", "c1", "c3", "c4"]);
    assert.equal(questions[0].text, "How easy was this article to read?");
    assert.equal(questions[1].text, "Including the other articles that you have read today, how much new information was in this article?");
    const valuesById = Object.fromEntries(questions.map((question, index) => [question.id, [10, 90, 30, 40][index]]));
    assert.equal(valuesById.c2, 10);
    assert.equal(valuesById.c1, 90);
});

test("the overall learning item includes the current article", () => {
    assert.equal(getReadingRatingQuestions()[3].text, "How much did you learn overall from the articles you have read so far today (including this article)?");
});
