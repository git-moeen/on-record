import {
  filterStatements,
  findOfficials,
  findTopics,
  findYear,
  officialById,
  opposingStance,
} from "./graph";
import type {
  AskAnswer,
  Citation,
  Conflict,
  Official,
  Statement,
  TopicId,
} from "./types";

function cite(row: Statement): Citation {
  const person = officialById(row.personId);
  return {
    statementId: row.id,
    personName: person?.name ?? row.personId,
    date: row.date,
    sourceUrl: row.sourceUrl,
    sourceLabel: row.sourceLabel,
    excerpt: row.quote ?? row.text,
    synthetic: row.synthetic,
  };
}

function detectConflicts(rows: Statement[]): Conflict[] {
  const found: Conflict[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i]!;
      const b = rows[j]!;
      if (a.personId !== b.personId) continue;
      const topic = a.topics.find((t) => b.topics.includes(t));
      if (!topic) continue;
      if (!opposingStance(a.stance, b.stance)) continue;
      const person = officialById(a.personId);
      found.push({
        topic,
        personName: person?.name ?? a.personId,
        left: cite(a),
        right: cite(b),
        note: "These two statements pull in different directions. Both are on the record; neither is dropped.",
      });
    }
  }
  return found;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d || 1));
  return dt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: d ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

function composeAnswer(opts: {
  question: string;
  people: Official[];
  topics: TopicId[];
  year?: number;
  rows: Statement[];
  conflicts: Conflict[];
}): { answer: string; unsure: boolean } {
  const { people, topics, year, rows, conflicts } = opts;
  if (rows.length === 0) {
    const who = people.map((p) => p.name).join(" / ") || "that official";
    const about = topics.length ? ` about ${topics.join(" / ")}` : "";
    const when = year ? ` in ${year}` : "";
    return {
      unsure: true,
      answer: `I do not have a cited statement from ${who}${about}${when} in this graph. That is not the same as them never saying it — the file is small on purpose. Try another name, drop the year, or run \`npm run enrich\`.`,
    };
  }

  const lines: string[] = [];
  const byPerson = new Map<string, Statement[]>();
  for (const row of rows) {
    const name = officialById(row.personId)?.name ?? row.personId;
    const list = byPerson.get(name) ?? [];
    list.push(row);
    byPerson.set(name, list);
  }

  for (const [name, stmts] of byPerson) {
    const bits = stmts.map((row) => {
      const stamp = formatDate(row.date);
      const demo = row.synthetic ? " [DEMO]" : "";
      const body = row.quote ? `“${row.quote}”` : row.text;
      return `${stamp}${demo}: ${body}`;
    });
    lines.push(`${name} — ${bits.join(" ")}`);
  }

  if (conflicts.length) {
    lines.push(
      `Conflict: ${conflicts
        .map(
          (c) =>
            `${c.personName} on ${c.topic} (${formatDate(c.left.date)} vs ${formatDate(c.right.date)}). Both kept.`,
        )
        .join(" ")}`,
    );
  } else if (rows.length > 1 && topics.length) {
    lines.push(
      "I do not see a direct contradiction in these rows. If the wording is softer than it looks, that is me saying so — not a silent merge.",
    );
  }

  const demoCount = rows.filter((r) => r.synthetic).length;
  if (demoCount) {
    lines.push(
      `${demoCount} row${demoCount === 1 ? "" : "s"} ${demoCount === 1 ? "is" : "are"} labeled DEMO / synthetic and must not be treated as a real quote.`,
    );
  }

  return { answer: lines.join("\n\n"), unsure: false };
}

export function askLocal(question: string): AskAnswer {
  const trimmed = question.trim();
  const people = findOfficials(trimmed);
  const topics = findTopics(trimmed);
  const year = findYear(trimmed);
  const rows = filterStatements({ people, topics, year });
  const conflicts = detectConflicts(rows);
  const { answer, unsure } = composeAnswer({
    question: trimmed,
    people,
    topics,
    year,
    rows,
    conflicts,
  });

  return {
    question: trimmed,
    answer,
    citations: rows.map(cite),
    conflicts,
    unsure,
    mode: "fixture",
    matchedPeople: people.map((p) => p.name),
    matchedTopics: topics,
    year,
  };
}
