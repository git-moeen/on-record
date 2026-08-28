import assert from "node:assert/strict";
import { test } from "node:test";
import { askLocal } from "./ask";

test("answers a housing question with Newsom citations", () => {
  const out = askLocal("What has Newsom said about housing this year?");
  assert.equal(out.mode, "fixture");
  assert.ok(out.citations.length >= 1);
  assert.ok(out.citations.every((c) => c.personName === "Gavin Newsom"));
  assert.ok(out.citations.some((c) => c.sourceUrl.includes("gov.ca.gov")));
  assert.ok(!out.unsure);
  assert.match(out.answer, /Californian|housing/i);
});

test("keeps both sides of a labeled DEMO conflict", () => {
  const out = askLocal("What has Katie Porter said about housing?");
  assert.ok(out.conflicts.length >= 1);
  assert.ok(out.citations.every((c) => c.synthetic));
  assert.match(out.answer, /DEMO/);
  assert.match(out.answer, /synthetic/i);
});

test("says so when the graph has nothing", () => {
  const out = askLocal("What has Padilla said about AI this year?");
  assert.equal(out.unsure, true);
  assert.equal(out.citations.length, 0);
  assert.match(out.answer, /do not have a cited statement/i);
});

test("nonsense does not dump the graph", () => {
  const out = askLocal("asdf qwerty zxcvb purple elephant congress");
  assert.equal(out.unsure, true);
  assert.equal(out.citations.length, 0);
  assert.equal(out.conflicts.length, 0);
  assert.equal(out.matchedPeople.length, 0);
  assert.equal(out.matchedTopics.length, 0);
  assert.match(out.answer, /do not have a cited statement/i);
});

test("person with an unknown topic does not dump their rows", () => {
  const out = askLocal("What has Newsom said about cheese pizza on Mars?");
  assert.equal(out.unsure, true);
  assert.equal(out.citations.length, 0);
  assert.equal(out.conflicts.length, 0);
  assert.deepEqual(out.matchedPeople, ["Gavin Newsom"]);
  assert.deepEqual(out.matchedTopics, []);
  assert.match(out.answer, /do not have a cited statement from Gavin Newsom about that topic/i);
});
