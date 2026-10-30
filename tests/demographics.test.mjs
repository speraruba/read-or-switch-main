import assert from "node:assert/strict";
import { test } from "node:test";

import { GENDER_OPTIONS, RACE_OPTIONS, validateDemographicCategories } from "../src/lib/demographics.ts";

test("all four genders and six legacy ethnicity categories are accepted", () => {
    assert.deepEqual(GENDER_OPTIONS, ["Male", "Female", "Non-binary", "Prefer not to say"]);
    assert.equal(RACE_OPTIONS.length, 6);
    for (const gender of GENDER_OPTIONS) {
        for (const race of RACE_OPTIONS) {
            for (const isHispanic of ["Yes", "No"]) {
                assert.equal(validateDemographicCategories({ gender, race, isHispanic }), null);
            }
        }
    }
});

test("missing or invalid categories are rejected instead of silently stored", () => {
    const valid = { gender: "Prefer not to say", race: "Multiple categories", isHispanic: "No" };
    for (const key of Object.keys(valid)) {
        for (const value of [undefined, null, "", "unrecognized", 1, true, []]) {
            assert.ok(validateDemographicCategories({ ...valid, [key]: value }));
        }
    }
});
