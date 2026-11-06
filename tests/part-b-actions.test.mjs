import assert from "node:assert/strict";
import { test } from "node:test";
import { createPartBActionWriter, parsePartBAction } from "../src/lib/part-b-actions.ts";
import { createActiveReadingTimer } from "../src/lib/active-reading-timer.ts";

const base = { eventId: "12345678-1234-1234-1234-123456789012", participantId: "123", phase: "practice", storyId: 1, segmentId: 2, action: "continue", readingTimeMs: 1500 };

test("validates phases, IDs, actions and phase budgets before writes", () => {
    assert.deepEqual(parsePartBAction(base), base);
    for (const patch of [{phase:"other"}, {participantId:"9223372036854775808"}, {participantId:"0"}, {storyId:-1}, {segmentId:1.5}, {action:"other"}, {eventId:"bad"}, {readingTimeMs:-1}, {readingTimeMs:0.1}, {readingTimeMs:240001}, {action:"start_story"}, {action:"test_skip"}]) {
        assert.equal(parsePartBAction({...base,...patch}), null, JSON.stringify(patch));
    }
    for (const action of ["start_story", "continue", "switch", "timeout", "test_skip"]) {
        assert.ok(parsePartBAction({...base, action, participantId:"88888888", readingTimeMs:0}));
    }
    assert.ok(parsePartBAction({...base, phase:"formal", readingTimeMs:600000}));
    assert.equal(parsePartBAction({...base, phase:"formal", readingTimeMs:600001}), null);
});

test("failed/ambiguous saves retain event, duration and transition; double clicks do not add events", async () => {
    const events = [];
    let fail = true;
    let transitions = 0;
    const writer = createPartBActionWriter(async event => {events.push(event); if(fail) throw Error("response lost");});
    assert.equal(await writer.save(base, () => transitions++), false);
    assert.equal(writer.pending(), true);
    assert.equal(transitions, 0);
    fail = false;
    await Promise.all([writer.retry(), writer.save({...base,eventId:"different"},()=>transitions+=100)]);
    assert.deepEqual(events, [base, base]);
    assert.equal(transitions, 1);
    assert.equal(writer.pending(), false);
});

for (const duration of [240000, 600000]) {
    test(`Part B ${duration} durations attribute to outgoing segment and exclude pauses and save/retry delays`, () => {
        const timer = createActiveReadingTimer(duration);
        timer.startArticle("1:1", 1000); timer.resume(1000);
        timer.pause(2000); // hidden / outside fullscreen
        timer.resume(9000);
        const first = timer.pause(9500);
        assert.equal(first.articleTimeMs, 1500);
        assert.equal(timer.snapshot(20000).articleTimeMs, 1500); // save failure and retry
        timer.startArticle("1:2", 30000); timer.resume(30000);
        assert.equal(timer.pause(32000).articleTimeMs, 2000); // switch away
        timer.startArticle("2:3", 50000); timer.resume(50000); // survey/library excluded
        assert.deepEqual(timer.pause(50000+duration), {remainingMs:0, articleTimeMs:duration-3500}); // timeout
    });
}
