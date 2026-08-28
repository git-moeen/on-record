import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type {
  GraphPayload,
  Official,
  PersonId,
  Stance,
  Statement,
  TopicId,
} from "./types";

const TOPIC_LABELS: Record<TopicId, string> = {
  housing: "Housing",
  water: "Water",
  ai: "AI",
};

const DATA_DIR = join(process.cwd(), "data");

type RosterFile = { officials: Official[] };
type StatementFile = { statements: Statement[]; generatedAt?: string };

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function loadOfficials(): Official[] {
  const file = readJson<RosterFile>(join(DATA_DIR, "roster.json"));
  return file.officials;
}

export function loadStatements(): Statement[] {
  const seeded = readJson<StatementFile>(join(DATA_DIR, "statements.json"));
  const livePath = join(DATA_DIR, "live.json");
  if (!existsSync(livePath)) return seeded.statements;
  const live = readJson<StatementFile>(livePath);
  const byId = new Map<string, Statement>();
  for (const row of seeded.statements) byId.set(row.id, row);
  for (const row of live.statements ?? []) byId.set(row.id, row);
  return [...byId.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function lastEnrichedAt(): string | null {
  const livePath = join(DATA_DIR, "live.json");
  if (!existsSync(livePath)) return null;
  const live = readJson<StatementFile>(livePath);
  return live.generatedAt ?? null;
}

export function officialById(id: PersonId): Official | undefined {
  return loadOfficials().find((o) => o.id === id);
}

export function findOfficials(question: string): Official[] {
  const q = question.toLowerCase();
  return loadOfficials().filter((o) =>
    o.aliases.some((alias) => q.includes(alias)),
  );
}

export function findTopics(question: string): TopicId[] {
  const q = question.toLowerCase();
  const hits: TopicId[] = [];
  const rules: Array<[TopicId, RegExp]> = [
    [
      "housing",
      /\b(housing|homeless(?:ness)?|rent(?:al|s|ers)?|zoning|homeownership|affordable homes?)\b/,
    ],
    [
      "water",
      /\b(water|drought|reservoirs?|salmon|delta|aqueduct|recycling)\b/,
    ],
    [
      "ai",
      /\b(ai|artificial intelligence|generative(?:-|\s)?ai|data centres?|data centers?|anthropic|llms?)\b/,
    ],
  ];
  for (const [topic, re] of rules) {
    if (re.test(q)) hits.push(topic);
  }
  return hits;
}

export function findYear(question: string): number | undefined {
  const q = question.toLowerCase();
  const explicit = q.match(/\b(20\d{2})\b/);
  if (explicit) return Number(explicit[1]);
  if (/\bthis year\b/.test(q)) return new Date().getUTCFullYear();
  if (/\blast year\b/.test(q)) return new Date().getUTCFullYear() - 1;
  return undefined;
}

export function statementYear(row: Statement): number {
  return Number(row.date.slice(0, 4));
}

export function opposingStance(a: Stance, b: Stance): boolean {
  const pairs: Array<[Stance, Stance]> = [
    ["expand", "restrict"],
    ["fund", "restrict"],
  ];
  return pairs.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x),
  );
}

export function filterStatements(opts: {
  people: Official[];
  topics: TopicId[];
  year?: number;
}): Statement[] {
  const { people, topics, year } = opts;
  if (!people.length || !topics.length) return [];
  return loadStatements().filter((row) => {
    if (people.length && !people.some((p) => p.id === row.personId)) {
      return false;
    }
    if (topics.length && !row.topics.some((t) => topics.includes(t))) {
      return false;
    }
    if (year && statementYear(row) !== year) return false;
    return true;
  });
}

export function graphPayload(mode: "fixture" | "infona"): GraphPayload {
  const officials = loadOfficials();
  const statements = loadStatements();
  const topicCounts = new Map<TopicId, number>();
  const edges: GraphPayload["edges"] = [];

  for (const row of statements) {
    edges.push({ from: row.personId, to: row.id, kind: "said" });
    for (const topic of row.topics) {
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
      edges.push({ from: row.id, to: topic, kind: "about" });
    }
  }

  return {
    mode,
    people: officials.map((o) => ({
      id: o.id,
      name: o.name,
      office: o.office,
      statementCount: statements.filter((s) => s.personId === o.id).length,
    })),
    topics: (["housing", "water", "ai"] as TopicId[]).map((id) => ({
      id,
      label: TOPIC_LABELS[id],
      statementCount: topicCounts.get(id) ?? 0,
    })),
    statements: statements.map((row) => ({
      id: row.id,
      personId: row.personId,
      topics: row.topics,
      date: row.date,
      synthetic: row.synthetic,
      label: row.text.slice(0, 72),
    })),
    edges,
  };
}

export { TOPIC_LABELS };
