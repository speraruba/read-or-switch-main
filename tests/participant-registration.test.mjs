import assert from "node:assert/strict";
import { test } from "node:test";

import { validateParticipantRegistration } from "../src/lib/participant-registration.ts";

const valid = { participantId: "0011", name: "  Test Participant  ", email: "  test@example.com  ", consented: true };

test("registration trims details and normalizes IDs without losing BIGINT precision", () => {
    assert.deepEqual(validateParticipantRegistration(valid).value, { participantId: "11", name: "Test Participant", email: "test@example.com" });
    assert.equal(validateParticipantRegistration({ ...valid, participantId: "9223372036854775807" }).value.participantId, "9223372036854775807");
});

test("registration requires a valid ID, name, email and explicit consent", () => {
    for (const body of [null, [], {}, { ...valid, participantId: "9223372036854775808" }, { ...valid, participantId: "1e3" }, { ...valid, participantId: "-1" }, { ...valid, name: "   " }, { ...valid, name: "x".repeat(256) }, { ...valid, email: "bad email@example.com" }, { ...valid, email: "" }, { ...valid, email: "x".repeat(250) + "@example.com" }, { ...valid, consented: false }, { ...valid, consented: "true" }]) {
        assert.ok(validateParticipantRegistration(body).error);
    }
});
