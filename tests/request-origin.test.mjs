import assert from "node:assert/strict";
import test from "node:test";

import { isAllowedRequestOrigin } from "../src/lib/request-origin.ts";

test("accepts local same-origin requests", () => {
    assert.equal(isAllowedRequestOrigin("http://localhost:3000", "http://localhost:3000/api/transcription/session"), true);
});

test("accepts the configured HTTPS domain behind Railway's proxy", () => {
    assert.equal(isAllowedRequestOrigin("https://study.up.railway.app", "http://0.0.0.0:8080/api/transcription/session", "study.up.railway.app"), true);
});

test("rejects foreign origins, insecure origins and domain lookalikes", () => {
    for (const origin of ["https://evil.example", "http://study.up.railway.app", "https://study.up.railway.app.evil.example", "null"]) {
        assert.equal(isAllowedRequestOrigin(origin, "http://0.0.0.0:8080/api/transcription/session", "study.up.railway.app"), false);
    }
    assert.equal(isAllowedRequestOrigin("https://study.up.railway.app", "http://0.0.0.0:8080/api/transcription/session"), false);
});
