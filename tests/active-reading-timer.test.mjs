import assert from "node:assert/strict";
import { test } from "node:test";

import { createActiveReadingTimer, FORMAL_READING_DURATION_MS, PRACTICE_READING_DURATION_MS } from "../src/lib/active-reading-timer.ts";

test("practice has four cumulative minutes; instructions, selection and loading are free", () => {
    assert.equal(PRACTICE_READING_DURATION_MS, 240000);
    const clock = createActiveReadingTimer(PRACTICE_READING_DURATION_MS);
    assert.deepEqual(clock.snapshot(100000), { remainingMs: 240000, articleTimeMs: 0 });
    clock.startArticle("first", 100000);
    clock.resume(100000);
    assert.deepEqual(clock.pause(110250), { remainingMs: 229750, articleTimeMs: 10250 });
    assert.deepEqual(clock.snapshot(500000), { remainingMs: 229750, articleTimeMs: 10250 });
    clock.startArticle("next", 500000);
    clock.resume(500000);
    assert.deepEqual(clock.pause(501000), { remainingMs: 228750, articleTimeMs: 1000 });
});

test("hidden article pauses and resumes without resetting article or budget", () => {
    const clock = createActiveReadingTimer(240000);
    clock.startArticle("first", 0);
    clock.resume(0);
    clock.resume(200); // Duplicate effects must not reset the start time.
    clock.pause(1000);
    clock.pause(1500);
    clock.startArticle("first", 5000);
    clock.resume(5000);
    assert.deepEqual(clock.pause(5500), { remainingMs: 238500, articleTimeMs: 1500 });
});

test("deadline clips a delayed tick and feedback never changes saved article time", () => {
    const clock = createActiveReadingTimer(240000);
    clock.startArticle("first", 0);
    clock.resume(0);
    clock.pause(100000);
    clock.startArticle("second", 150000);
    clock.resume(150000);
    assert.equal(clock.snapshot(289999).remainingMs, 1);
    assert.deepEqual(clock.pause(300000), { remainingMs: 0, articleTimeMs: 140000 });
    assert.deepEqual(clock.snapshot(600000), { remainingMs: 0, articleTimeMs: 140000 });
    clock.resume(600000);
    assert.deepEqual(clock.snapshot(900000), { remainingMs: 0, articleTimeMs: 140000 });
});

test("formal reading expires after fifteen reading minutes and excludes ratings", () => {
    assert.equal(FORMAL_READING_DURATION_MS, 900000);
    const clock = createActiveReadingTimer(FORMAL_READING_DURATION_MS);
    clock.startArticle("first", 1000);
    clock.resume(1000);
    clock.pause(101000);
    clock.startArticle("second", 501000);
    clock.resume(501000);
    assert.deepEqual(clock.pause(1401000), { remainingMs: 0, articleTimeMs: 800000 });
    assert.deepEqual(clock.snapshot(2401000), { remainingMs: 0, articleTimeMs: 800000 });
});

for (const duration of [240000, 900000]) {
    test(`story budget ${duration} excludes initial selection, loading, switching and recall`, () => {
        const timer = createActiveReadingTimer(duration);
        assert.equal(timer.snapshot(1000000).remainingMs, duration);
        timer.startArticle("story-1:segment-1", 1000000);
        timer.resume(1000000);
        timer.pause(1001250);
        assert.equal(timer.snapshot(2000000).remainingMs, duration - 1250);
        timer.startArticle("story-2:segment-1", 2000000);
        timer.resume(2000000);
        assert.equal(timer.pause(2000750).remainingMs, duration - 2000);
        assert.equal(timer.snapshot(3000000).remainingMs, duration - 2000);
    });
}
