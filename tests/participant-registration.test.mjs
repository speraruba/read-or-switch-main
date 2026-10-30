import assert from "node:assert/strict";
import { test } from "node:test";

import { validateParticipantRegistration } from "../src/lib/participant-registration.ts";

const valid = { participantId: "0011", confirmParticipantId: "0011", consented: true };

test("registration requires matching IDs, normalizes only after comparison, and preserves BIGINT precision", () => {
    assert.deepEqual(validateParticipantRegistration(valid).value, { participantId: "11" });
    const id = "9223372036854775807";
    assert.equal(validateParticipantRegistration({ ...valid, participantId: id, confirmParticipantId: id }).value.participantId, id);
    assert.deepEqual(validateParticipantRegistration({ ...valid, participantId: " 0011 ", confirmParticipantId: "0011 " }).value, { participantId: "11" });
    assert.ok(validateParticipantRegistration({ ...valid, confirmParticipantId: "11" }).error);
});

test("registration rejects invalid or mismatching IDs and missing consent", () => {
    for (const body of [null, [], {}, { ...valid, participantId: "9223372036854775808", confirmParticipantId: "9223372036854775808" }, { ...valid, participantId: "1e3" }, { ...valid, participantId: "-1" }, { ...valid, participantId: "" }, { ...valid, confirmParticipantId: "" }, { ...valid, confirmParticipantId: "0012" }, { ...valid, confirmParticipantId: 11 }, { ...valid, consented: false }, { ...valid, consented: "true" }]) {
        assert.ok(validateParticipantRegistration(body).error);
    }
});

test("name and email are no longer collected or returned", () => {
    assert.deepEqual(validateParticipantRegistration({ ...valid, name: "Old name", email: "old@example.com" }).value, { participantId: "11" });
});
