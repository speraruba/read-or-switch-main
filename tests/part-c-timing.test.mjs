import assert from "node:assert/strict";
import { test } from "node:test";

import { createLogQueue, createReadingClock, parsePartCLogEvent, PART_C_DURATION_MS } from "../src/lib/part-c-timing.ts";

import { createActiveReadingTimer } from "../src/lib/active-reading-timer.ts";

const event = {
    eventId: "e0123456-1234-4123-8123-0123456789ab", participantId: "00", setId: 1,
    sentenceIndex: 1, wordIndex: 0, action: "word_reveal",
    wordReadingTimeMs: 250, sentenceReadingTimeMs: null,
};

test("visible counters run, freeze at completion, and reset independently", () => {
    const clock = createReadingClock();
    assert.deepEqual(clock.elapsed(80), { wordReadingTimeMs: 0, sentenceReadingTimeMs: 0 });
    clock.show(1, 0, 100);
    assert.deepEqual(clock.elapsed(250), { wordReadingTimeMs: 150, sentenceReadingTimeMs: 150 });
    clock.finish(300, false);
    assert.deepEqual(clock.elapsed(310), { wordReadingTimeMs: 200, sentenceReadingTimeMs: 210 });
    clock.show(1, 1, 320);
    assert.deepEqual(clock.elapsed(400), { wordReadingTimeMs: 80, sentenceReadingTimeMs: 300 });
    const saved = clock.finish(500, true);
    assert.deepEqual(clock.elapsed(9000), saved);
    clock.show(2, 0, 10000);
    assert.deepEqual(clock.elapsed(10020), { wordReadingTimeMs: 20, sentenceReadingTimeMs: 20 });
});

test("includes first and last word; sentence total excludes decision and network time", () => {
    const clock = createReadingClock();
    clock.show(1, 0, 100);
    assert.deepEqual(clock.finish(350, false), { wordReadingTimeMs: 250, sentenceReadingTimeMs: null });
    clock.show(1, 1, 360);
    assert.deepEqual(clock.finish(860, true), { wordReadingTimeMs: 500, sentenceReadingTimeMs: 760 });
    // Ten seconds spent deciding/saving must not become part of the next sentence.
    clock.show(2, 0, 10860);
    assert.deepEqual(clock.finish(11060, true), { wordReadingTimeMs: 200, sentenceReadingTimeMs: 200 });
});

test("duplicate effects and key presses cannot reset timing or emit duplicate events", () => {
    const clock = createReadingClock();
    assert.equal(clock.finish(50, true), null);
    clock.show(1, 0, 100);
    clock.show(1, 0, 120);
    assert.deepEqual(clock.finish(450.6, true), { wordReadingTimeMs: 351, sentenceReadingTimeMs: 351 });
    assert.equal(clock.finish(500, true), null);
});

test("switching topics starts a new sentence clock and retains partial-word timings", () => {
    const clock = createReadingClock();
    clock.show(1, 0, 0);
    assert.equal(clock.finish(80, false).sentenceReadingTimeMs, null);
    clock.show(7, 0, 5000);
    assert.deepEqual(clock.finish(5400, true), { wordReadingTimeMs: 400, sentenceReadingTimeMs: 400 });
});

test("validates millisecond numbers, actions, IDs and nullable decision durations", () => {
    assert.deepEqual(parsePartCLogEvent(event), event);
    assert.ok(parsePartCLogEvent({ ...event, sentenceReadingTimeMs: 600 }));
    for (const value of [-1, NaN, Infinity, 2.5, "250", 4294967296, undefined]) {
        assert.equal(parsePartCLogEvent({ ...event, wordReadingTimeMs: value }), null);
    }
    for (const patch of [{ eventId: "bad" }, { wordIndex: -1 }, { setId: 0 }, { participantId: "abc" }, { action: "unknown" }, { sentenceReadingTimeMs: 100 }]) {
        assert.equal(parsePartCLogEvent({ ...event, ...patch }), null);
    }
    const decision = { ...event, action: "switch", wordIndex: null, wordReadingTimeMs: null, sentenceReadingTimeMs: null };
    assert.deepEqual(parsePartCLogEvent(decision), decision);
    assert.equal(parsePartCLogEvent({ ...decision, wordReadingTimeMs: 5 }), null);
});

test("serializes writes, retains failed events, and reuses their IDs on retry", async () => {
    let fail = true;
    const sent = [];
    const queue = createLogQueue(async value => {
        sent.push(value);
        if (fail) throw new Error("offline");
    });
    queue.add(event);
    assert.equal(await queue.flush(), false);
    const second = { ...event, eventId: "e0123456-1234-4123-8123-0123456789ac", wordIndex: 1 };
    queue.add(second);
    fail = false;
    assert.equal(await queue.flush(), true);
    assert.deepEqual(sent, [event, event, second]);
    assert.equal(await queue.flush(), true);
    assert.equal(sent.length, 3);
});

test("events added during an in-flight request are drained before navigation", async () => {
    let release;
    const sent = [];
    const queue = createLogQueue(async value => {
        sent.push(value.wordIndex);
        if (value.wordIndex === 0) await new Promise(resolve => { release = resolve; });
    });
    queue.add(event);
    const first = queue.flush();
    queue.add({ ...event, wordIndex: 1 });
    assert.equal(queue.flush(), first);
    release();
    assert.equal(await first, true);
    assert.deepEqual(sent, [0, 1]);
});

test("sentence countdown and logged durations exclude decisions, saving and hidden time", () => {
    assert.equal(PART_C_DURATION_MS, 600000);
    const budget = createActiveReadingTimer(PART_C_DURATION_MS);
    const words = createReadingClock();
    const readingTime = now => PART_C_DURATION_MS - budget.snapshot(now).remainingMs;
    budget.startArticle("sentences", 10000);
    words.show(1, 0, readingTime(10000));
    budget.resume(10000);
    budget.pause(11000); // Hidden tab.
    assert.equal(readingTime(61000), 1000);
    assert.equal(words.elapsed(readingTime(61000)).wordReadingTimeMs, 1000);
    budget.resume(61000);
    const first = words.finish(readingTime(62000), true);
    budget.pause(62000); // Sentence completed; decision and saving begin.
    assert.deepEqual(first, { wordReadingTimeMs: 2000, sentenceReadingTimeMs: 2000 });
    assert.equal(budget.snapshot(900000).remainingMs, 598000);
    assert.deepEqual(words.elapsed(readingTime(900000)), first);
    words.show(2, 0, readingTime(900000));
    budget.resume(900000);
    assert.equal(budget.snapshot(1497999).remainingMs, 1);
    // A late tick must clip both the budget and partial-word log at 10 active minutes.
    budget.pause(1500000);
    const timeout = words.finish(readingTime(1500000), true);
    assert.deepEqual(timeout, { wordReadingTimeMs: 598000, sentenceReadingTimeMs: 598000 });
    assert.equal(budget.snapshot(2000000).remainingMs, 0);
});

test("timeout preserves partial reading durations without marking a sentence as completed", () => {
    const clock = createReadingClock();
    clock.show(1, 0, 100);
    clock.finish(200, false);
    clock.show(1, 1, 210);
    const duration = clock.finish(600, true);
    const timeout = { ...event, action: "timeout", wordIndex: 1, ...duration };
    assert.deepEqual(parsePartCLogEvent(timeout), timeout);
    assert.equal(timeout.wordReadingTimeMs, 390);
    assert.equal(timeout.sentenceReadingTimeMs, 500);
    assert.deepEqual(clock.elapsed(900), duration);
    assert.equal(clock.finish(900, true), null);
    assert.equal(parsePartCLogEvent({ ...timeout, sentenceReadingTimeMs: null }), null);
    const decisionTimeout = { ...event, action: "timeout", wordIndex: null, wordReadingTimeMs: null, sentenceReadingTimeMs: null };
    assert.deepEqual(parsePartCLogEvent(decisionTimeout), decisionTimeout);
    assert.equal(parsePartCLogEvent({ ...decisionTimeout, wordReadingTimeMs: 10 }), null);
});
