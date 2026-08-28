import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadOfficials, loadStatements } from "./graph";
import type { Official, PersonId, Stance, Statement, TopicId } from "./types";

const USER_AGENT = "on-record/0.1 (+https://github.com/git-moeen/on-record)";

const TOPIC_KEYS: Array<[TopicId, RegExp]> = [
  ["housing", /\b(housing|homeless(?:ness)?|zoning|rent(?:al|s)?|homeownership)\b/i],
  ["water", /\b(water|drought|salmon|reservoirs?|delta|aqueduct)\b/i],
  ["ai", /\b(ai|artificial intelligence|generative(?:-|\s)?ai|data centres?|data centers?)\b/i],
];

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function decode(html: string): string {
  return html
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripTags(html: string): string {
  return decode(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function topicsFrom(text: string): TopicId[] {
  return TOPIC_KEYS.filter(([, re]) => re.test(text)).map(([id]) => id);
}

function guessDate(html: string, fallback: string): string {
  const iso = html.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const long = html.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(20\d{2})\b/i,
  );
  if (long) {
    const month = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ].indexOf(long[1]!.toLowerCase()) + 1;
    const day = String(long[2]).padStart(2, "0");
    return `${long[3]}-${String(month).padStart(2, "0")}-${day}`;
  }
  return fallback;
}

type Scraped = {
  title: string;
  url: string;
  date: string;
  excerpt: string;
};

function absoluteUrl(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function extractCards(html: string, base: string): Scraped[] {
  const out: Scraped[] = [];
  const seen = new Set<string>();
  const linkRe = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRe.exec(html))) {
    const href = match[1]!;
    const title = stripTags(match[2]!);
    if (title.length < 24 || title.length > 220) continue;
    if (/^(see all|read more|home|newsroom|skip)/i.test(title)) continue;
    if (!/\/20\d{2}\/|press-release|news-mayor|news\//i.test(href) && title === title.toUpperCase()) {
      continue;
    }
    if (!/housing|water|homeless|zoning|drought|salmon|artificial|ai\b|data center|bond|climate/i.test(title)) {
      continue;
    }
    const url = absoluteUrl(href, base);
    if (seen.has(url)) continue;
    seen.add(url);
    const window = html.slice(Math.max(0, match.index - 400), match.index + 800);
    out.push({
      title,
      url,
      date: guessDate(window, new Date().toISOString().slice(0, 10)),
      excerpt: title,
    });
    if (out.length >= 8) break;
  }
  return out;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html" },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function stanceFor(topics: TopicId[], title: string): Stance {
  const t = title.toLowerCase();
  if (/protect|safeguard|guardrail|disclosure|watermark/.test(t)) return "protect";
  if (/oppos|block|halt|ban/.test(t)) return "restrict";
  if (topics.includes("housing") || topics.includes("water")) return "expand";
  if (topics.includes("ai")) return "fund";
  return "neutral";
}

function toStatement(official: Official, item: Scraped): Statement {
  const topics = topicsFrom(`${item.title} ${item.excerpt}`);
  return {
    id: `${official.id}-${slug(item.url)}`,
    personId: official.id as PersonId,
    date: item.date,
    datePrecision: item.date.endsWith("-01") ? "month" : "day",
    topics,
    stance: stanceFor(topics, item.title),
    text: item.title,
    sourceUrl: item.url,
    sourceLabel: official.sources[0]?.label ?? official.name,
    synthetic: false,
  };
}

export async function enrichFromOfficialPages(): Promise<{
  added: Statement[];
  fetched: number;
  failed: string[];
}> {
  const officials = loadOfficials().filter((o) => o.sources.length);
  const existing = new Set(loadStatements().map((s) => s.sourceUrl));
  const added: Statement[] = [];
  const failed: string[] = [];
  let fetched = 0;

  for (const official of officials) {
    for (const source of official.sources) {
      const html = await fetchText(source.url);
      if (!html) {
        failed.push(source.url);
        continue;
      }
      fetched += 1;
      for (const item of extractCards(html, source.url)) {
        if (existing.has(item.url)) continue;
        if (!topicsFrom(`${item.title} ${item.excerpt}`).length) continue;
        const row = toStatement(official, item);
        existing.add(item.url);
        added.push(row);
      }
    }
  }

  return { added, fetched, failed };
}

export function mergeLive(added: Statement[]): string {
  const path = join(process.cwd(), "data", "live.json");
  writeFileSync(
    path,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        note: "Overlay from npm run enrich. Public official newsrooms only. Seeded rows stay in statements.json.",
        statements: added,
      },
      null,
      2,
    ) + "\n",
  );
  return path;
}

export function statementsToCsv(rows: Statement[]): string {
  const headers = [
    "statement_id",
    "person",
    "office",
    "date",
    "topics",
    "stance",
    "text",
    "quote",
    "source_url",
    "source_label",
    "synthetic",
  ];
  const officials = new Map(loadOfficials().map((o) => [o.id, o]));
  const esc = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const lines = [headers.join(",")];
  for (const row of rows) {
    const person = officials.get(row.personId);
    lines.push(
      [
        row.id,
        person?.name ?? row.personId,
        person?.office ?? "",
        row.date,
        row.topics.join("|"),
        row.stance,
        row.text,
        row.quote ?? "",
        row.sourceUrl,
        row.sourceLabel,
        row.synthetic ? "true" : "false",
      ]
        .map(esc)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}
