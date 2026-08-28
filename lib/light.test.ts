import assert from "node:assert/strict";
import { test } from "node:test";
import { askLocal } from "./ask";
import { graphPayload } from "./graph";
import { fightFor, lightPath } from "./light";

test("Newsom housing lights only that path", () => {
  const graph = graphPayload("fixture");
  const lit = lightPath(
    graph,
    askLocal("What has Newsom said about housing this year?"),
  );
  assert.equal(lit.active, true);
  assert.ok(lit.people.has("newsom"));
  assert.ok(lit.topics.has("housing"));
  assert.ok(lit.statements.has("newsom-housing-2026-07-13"));
  assert.ok(lit.statements.has("newsom-housing-2026-06-25"));
  assert.equal(lit.statements.has("newsom-ai-2026-03-30"), false);
  assert.equal(lit.fights.length, 0);
});

test("Porter conflict keeps both statement nodes", () => {
  const graph = graphPayload("fixture");
  const lit = lightPath(graph, askLocal("What has Katie Porter said about housing?"));
  assert.equal(lit.fights.length, 1);
  const fight = lit.fights[0]!;
  assert.ok(lit.statements.has(fight.a));
  assert.ok(lit.statements.has(fight.b));
  assert.notEqual(fight.stale, fight.current);
  assert.equal(fight.stale, "demo-porter-housing-2026-01-15");
  assert.equal(fight.current, "demo-porter-housing-2026-06-02");
  assert.ok(fightFor(lit, fight.a));
});

test("unsure ask lights nothing", () => {
  const graph = graphPayload("fixture");
  const lit = lightPath(
    graph,
    askLocal("What has Newsom said about cheese pizza on Mars?"),
  );
  assert.equal(lit.active, false);
  assert.equal(lit.statements.size, 0);
});
