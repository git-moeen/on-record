import type { AskAnswer, GraphPayload, PersonId, TopicId } from "./types";

export type Fight = {
  a: string;
  b: string;
  stale: string;
  current: string;
};

export type LitPath = {
  people: Set<string>;
  topics: Set<string>;
  statements: Set<string>;
  fights: Fight[];
  active: boolean;
};

export function lightPath(
  graph: GraphPayload,
  answer: AskAnswer | null,
): LitPath {
  const empty: LitPath = {
    people: new Set(),
    topics: new Set(),
    statements: new Set(),
    fights: [],
    active: false,
  };
  if (!answer || answer.unsure || !answer.citations.length) return empty;

  const peopleByName = new Map(graph.people.map((p) => [p.name, p.id]));
  const people = new Set<string>();
  for (const name of answer.matchedPeople) {
    const id = peopleByName.get(name);
    if (id) people.add(id);
  }
  const topics = new Set<string>(answer.matchedTopics);
  const statements = new Set(answer.citations.map((c) => c.statementId));

  for (const row of graph.statements) {
    if (!statements.has(row.id)) continue;
    people.add(row.personId);
    for (const topic of row.topics) topics.add(topic);
  }

  const fights: Fight[] = answer.conflicts.map((c) => {
    const stale =
      c.left.date <= c.right.date ? c.left.statementId : c.right.statementId;
    const current = stale === c.left.statementId ? c.right.statementId : c.left.statementId;
    return {
      a: c.left.statementId,
      b: c.right.statementId,
      stale,
      current,
    };
  });

  return { people, topics, statements, fights, active: true };
}

export function isLit(
  lit: LitPath,
  id: string,
  kind: "person" | "topic" | "statement",
): boolean {
  if (!lit.active) return false;
  if (kind === "person") return lit.people.has(id as PersonId);
  if (kind === "topic") return lit.topics.has(id as TopicId);
  return lit.statements.has(id);
}

export function fightFor(lit: LitPath, id: string): Fight | undefined {
  return lit.fights.find((f) => f.a === id || f.b === id);
}
