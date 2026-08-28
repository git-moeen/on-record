import { Client, InfonaError } from "@infona-ai/cli";
import { askLocal } from "./ask";
import { lastEnrichedAt, loadOfficials, loadStatements } from "./graph";
import type { AskAnswer, Citation, StatusPayload } from "./types";

const KG = process.env.INFONA_KG ?? "on-record";

export function infonaUrl(): string | null {
  const raw = process.env.INFONA_URL || process.env.INFONA_API_URL || "";
  return raw.trim() || null;
}

export function createInfonaClient(): Client | null {
  const baseUrl = infonaUrl();
  if (!baseUrl) return null;
  return new Client({
    baseUrl,
    apiKey: process.env.INFONA_API_KEY,
    tenant: process.env.INFONA_TENANT || "default",
  });
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function mapInfonaCitations(raw: unknown): Citation[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item, i) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const excerpt =
      asString(row.excerpt) ??
      asString(row.text) ??
      asString(row.fact) ??
      asString(row.value);
    if (!excerpt) return [];
    return [
      {
        statementId: asString(row.id) ?? `infona-${i}`,
        personName: asString(row.entity) ?? asString(row.subject) ?? "Infona",
        date: asString(row.date) ?? asString(row.timestamp) ?? "",
        sourceUrl: asString(row.source_url) ?? asString(row.url) ?? "",
        sourceLabel: asString(row.source) ?? "Infona citation",
        excerpt,
        synthetic: false,
      },
    ];
  });
}

export async function probeInfona(): Promise<boolean> {
  const url = infonaUrl();
  if (!url) return false;
  try {
    const res = await fetch(new URL("/health", url), {
      signal: AbortSignal.timeout(2500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function askQuestion(question: string): Promise<AskAnswer> {
  const local = askLocal(question);
  const client = createInfonaClient();
  if (!client) return local;

  try {
    const result = await client.ask(question, { kg: KG });
    const answer =
      asString(result.narrative_answer) ??
      asString(result.answer) ??
      local.answer;
    const citations = mapInfonaCitations(result.citations);
    return {
      ...local,
      answer,
      citations: citations.length ? citations : local.citations,
      mode: "infona",
      infonaNote:
        "Answered through Infona /ask on the on-record graph. Local receipts stay attached when Infona returns none.",
    };
  } catch (err) {
    const message =
      err instanceof InfonaError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Infona ask failed";
    return {
      ...local,
      infonaNote: `Infona is configured but ask failed (${message}). Fell back to the local fixture graph.`,
    };
  }
}

export async function ingestStatementsCsv(
  csvPath: string,
): Promise<Record<string, unknown>> {
  const client = createInfonaClient();
  if (!client) {
    throw new Error("INFONA_URL is not set. Fixture mode has nothing to ingest into.");
  }
  try {
    await client.createKg(
      KG,
      "Public statements by a handful of California officials",
    );
  } catch {
    // already exists
  }
  const ingested = await client.ingest(csvPath, {
    kg: KG,
    typeName: "Statement",
  });
  try {
    await client.erRebuild(KG);
  } catch {
    // ER is a second pass; ingest still counts if it is missing
  }
  return ingested;
}

export async function status(): Promise<StatusPayload> {
  const url = infonaUrl();
  const reachable = await probeInfona();
  return {
    mode: url && reachable ? "infona" : "fixture",
    infonaUrl: url,
    infonaReachable: reachable,
    statementCount: loadStatements().length,
    officialCount: loadOfficials().length,
    lastEnrichedAt: lastEnrichedAt(),
  };
}
