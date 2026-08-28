import assert from "node:assert/strict";
import { test } from "node:test";
import {
  filterStatements,
  findOfficials,
  findTopics,
  findYear,
  opposingStance,
} from "./graph";

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
  assert.deepEqual(findTopics("What has Newsom said about housing this year?"), [
    "housing",
  ]);
  assert.equal(findYear("this year"), new Date().getUTCFullYear());
});

test("expand vs restrict is a conflict", () => {
  assert.equal(opposingStance("expand", "restrict"), true);
  assert.equal(opposingStance("expand", "expand"), false);
  assert.equal(opposingStance("protect", "fund"), false);
});

test("filter fails closed without a person or topic", () => {
  const newsom = findOfficials("Newsom");
  assert.equal(filterStatements({ people: [], topics: [] }).length, 0);
  assert.equal(filterStatements({ people: newsom, topics: [] }).length, 0);
  assert.ok(filterStatements({ people: newsom, topics: ["housing"] }).length >= 1);
});
