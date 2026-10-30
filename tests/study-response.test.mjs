import assert from "node:assert/strict";
import { test } from "node:test";

import { parseStudyResponse } from "../src/lib/study-response.ts";

const recall = {
    participantId: "12", submissionId: "e0123456-1234-4123-8123-0123456789ab",
    part: "a", phase: "practice", task: "recall", inputMethod: "speech", content: "  I learned this.  ",
};

test("speech recall is valid in both A/B phases and legacy C storage", () => {
    for (const part of ["a", "b", "c"]) {
        for (const phase of part === "c" ? ["formal"] : ["practice", "formal"]) {
            assert.equal(parseStudyResponse({ ...recall, part, phase }).content, "I learned this.");
        }
    }
});

test("Part C accepts recall without a phase and rejects practice or summaries", () => {
    const response = { ...recall };
    delete response.phase;
    const saved = parseStudyResponse({ ...response, part: "c" });
    assert.equal(saved.task, "recall");
    assert.equal(saved.phase, "formal", "preserve the existing database enum for compatibility");
    assert.equal(saved.content, "I learned this.");
    assert.equal(parseStudyResponse({ ...response, part: "c", phase: "practice" }), null);
    assert.equal(parseStudyResponse({ ...response, part: "c", task: "summary", inputMethod: "typed" }), null);
    assert.equal(parseStudyResponse({ ...response, part: "c", phase: "formal", task: "summary", inputMethod: "typed" }), null);
    assert.equal(parseStudyResponse({ ...response, part: "a" }), null);
    assert.equal(parseStudyResponse({ ...response, part: "b" }), null);
});

test("typed recall and practice summaries are rejected", () => {
    assert.equal(parseStudyResponse({ ...recall, inputMethod: "typed" }), null);
    assert.equal(parseStudyResponse({ ...recall, task: "summary", inputMethod: "typed" }), null);
    assert.equal(parseStudyResponse({ ...recall, part: "c" }), null);
    for (const part of ["a", "b"]) {
        const summary = parseStudyResponse({ ...recall, part, task: "summary", phase: "formal", inputMethod: "typed" });
        assert.equal(summary.task, "summary");
        assert.equal(summary.phase, "formal");
    }
});

test("invalid IDs, empty or excessive content, unknown phases and retry identifiers are rejected", () => {
    for (const change of [{ participantId: "9223372036854775808" }, { participantId: "x" }, { submissionId: "" }, { part: "d" }, { phase: "other" }, { task: "other" }, { inputMethod: "other" }, { content: " " }, { content: "x".repeat(16001) }]) {
        assert.equal(parseStudyResponse({ ...recall, ...change }), null);
    }
    assert.equal(parseStudyResponse(null), null);
});
