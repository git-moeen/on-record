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
  assert.match(out.answer, /do not have a cited statement/i);
});
