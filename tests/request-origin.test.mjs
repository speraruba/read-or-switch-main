import assert from "node:assert/strict";
import test from "node:test";

import { isAllowedRequestOrigin } from "../src/lib/request-origin.ts";

test("accepts local same-origin requests", () => {
    assert.equal(isAllowedRequestOrigin("http://localhost:3000", "http://localhost:3000/api/transcription/session"), true);
});

test("recognizes the matching development loopback Host after Next normalizes the URL", () => {
    const url = "http://localhost:3000/api/transcription/session";
    for (const host of ["127.0.0.1:3000", "[::1]:3000"]) {
        assert.equal(isAllowedRequestOrigin(`http://${host}`, url, undefined, host), true);
        assert.equal(isAllowedRequestOrigin(`http://${host}`, url), false);
        assert.equal(isAllowedRequestOrigin(`http://${host}`, url, undefined, "localhost:3000"), false);
    }
    for (const origin of ["http://127.0.0.1:3001", "https://127.0.0.1:3000", "http://evil.example:3000"]) {
        assert.equal(isAllowedRequestOrigin(origin, url, undefined, "127.0.0.1:3000"), false);
    }
    assert.equal(isAllowedRequestOrigin("http://evil.example:3000", url, undefined, "evil.example:3000"), false);
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
