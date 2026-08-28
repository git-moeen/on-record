import assert from "node:assert/strict";
import { test } from "node:test";
import { findOfficials, findTopics, findYear, opposingStance } from "./graph";

test("resolves CA names from messy questions", () => {
  const people = findOfficials("what did the SF mayor and Newsom say");
  const ids = people.map((p) => p.id).sort();
  assert.deepEqual(ids, ["lurie", "newsom"]);
});

test("topics and year", () => {
  assert.deepEqual(findTopics("housing and water, also AI data centers"), [
    "housing",
    "water",
    "ai",
  ]);
  assert.equal(findYear("this year"), new Date().getUTCFullYear());
});

test("expand vs restrict is a conflict", () => {
  assert.equal(opposingStance("expand", "restrict"), true);
  assert.equal(opposingStance("expand", "expand"), false);
  assert.equal(opposingStance("protect", "fund"), false);
});
