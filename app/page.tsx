"use client";

import { useEffect, useMemo, useState } from "react";
import type { AskAnswer, GraphPayload, StatusPayload } from "@/lib/types";

const STARTERS = [
  "What has Newsom said about housing this year?",
  "What has Padilla said about water?",
  "What has Schiff said about AI this year?",
  "What has the SF mayor said about housing?",
  "What has Katie Porter said about housing?",
];

function GraphView({ graph, activeIds }: { graph: GraphPayload | null; activeIds: string[] }) {
  const layout = useMemo(() => {
    if (!graph) return null;
    const people = graph.people.map((p, i) => ({
      ...p,
      x: 70,
      y: 36 + i * 52,
    }));
    const topics = graph.topics.map((t, i) => ({
      ...t,
      x: 430,
      y: 90 + i * 90,
    }));
    const statements = graph.statements.map((s, i) => {
      const person = people.find((p) => p.id === s.personId);
      const topic = topics.find((t) => t.id === s.topics[0]);
      const wobble = ((i * 37) % 28) - 14;
      return {
        ...s,
        x: 220 + wobble,
        y: (person?.y ?? 160) * 0.55 + (topic?.y ?? 160) * 0.45,
      };
    });
    return { people, topics, statements };
  }, [graph]);

  if (!graph || !layout) {
    return <div className="hint">Loading graph…</div>;
  }

  return (
    <svg className="graph" viewBox="0 0 500 360" role="img" aria-label="People, topics, and statements">
      {layout.statements.map((s) => {
        const person = layout.people.find((p) => p.id === s.personId);
        const topic = layout.topics.find((t) => t.id === s.topics[0]);
        if (!person || !topic) return null;
        const hot = activeIds.includes(s.id);
        return (
          <g key={s.id}>
            <line
              x1={person.x + 10}
              y1={person.y}
              x2={s.x}
              y2={s.y}
              stroke={hot ? "#c4a574" : "#3a342c"}
              strokeWidth={hot ? 1.6 : 1}
            />
            <line
              x1={s.x}
              y1={s.y}
              x2={topic.x - 10}
              y2={topic.y}
              stroke={hot ? "#c4a574" : "#3a342c"}
              strokeWidth={hot ? 1.6 : 1}
            />
            <circle
              cx={s.x}
              cy={s.y}
              r={hot ? 5 : 3.2}
              fill={s.synthetic ? "#c23a2b" : hot ? "#e8dfd0" : "#8a7d68"}
            />
          </g>
        );
      })}
      {layout.people.map((p) => (
        <g key={p.id}>
          <circle cx={p.x} cy={p.y} r="7" fill="#c4a574" />
          <text x={p.x + 14} y={p.y + 4} fontSize="12">
            {p.name.split(" ").slice(-1)} · {p.statementCount}
          </text>
        </g>
      ))}
      {layout.topics.map((t) => (
        <g key={t.id}>
          <rect x={t.x - 8} y={t.y - 8} width="16" height="16" fill="#c23a2b" />
          <text x={t.x + 14} y={t.y + 4} fontSize="13">
            {t.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function HomePage() {
  const [question, setQuestion] = useState(STARTERS[0]);
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [graph, setGraph] = useState<GraphPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus);
    void fetch("/api/graph")
      .then((r) => r.json())
      .then(setGraph);
    void submit(STARTERS[0]);
    // first paint should already have a cited answer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(next = question) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: next }),
      });
      const data = (await res.json()) as AskAnswer & { error?: string };
      if (!res.ok) throw new Error(data.error || "Ask failed");
      setAnswer(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ask failed");
    } finally {
      setBusy(false);
    }
  }

  const activeIds = answer?.citations.map((c) => c.statementId) ?? [];

  return (
    <main className="shell">
      <header className="top">
        <div className="brand">
          <div className="stamp">
            on
            <br />
            record
          </div>
          <div>
            <h1>on-record</h1>
            <p>What California politicians said, with the date and the link. If they contradicted themselves, you see both.</p>
          </div>
        </div>
        <div className="badge">
          mode <strong>{status?.mode ?? "…"}</strong>
          <br />
          {status?.statementCount ?? "—"} statements · {status?.officialCount ?? "—"} names
          {status?.infonaUrl ? (
            <>
              <br />
              Infona {status.infonaReachable ? "up" : "set, unreachable"}
            </>
          ) : (
            <>
              <br />
              fixture / no Neo4j
            </>
          )}
        </div>
      </header>

      <div className="layout">
        <section className="ask">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What has Newsom said about housing this year?"
            />
            <div className="row">
              <button type="submit" disabled={busy}>
                {busy ? "Looking…" : "Ask"}
              </button>
              <span className="meta">Public statements only. No voter files.</span>
            </div>
          </form>
          <div className="chips">
            {STARTERS.map((q) => (
              <button
                key={q}
                type="button"
                className={q === question ? "active" : ""}
                onClick={() => {
                  setQuestion(q);
                  void submit(q);
                }}
              >
                {q}
              </button>
            ))}
          </div>

          {error ? <p className="conflict">{error}</p> : null}

          {answer ? (
            <article className="answer">
              <div className="meta">
                {answer.mode}
                {answer.matchedPeople.length ? ` · ${answer.matchedPeople.join(", ")}` : ""}
                {answer.matchedTopics.length ? ` · ${answer.matchedTopics.join(", ")}` : ""}
                {answer.year ? ` · ${answer.year}` : ""}
                {answer.infonaNote ? ` · ${answer.infonaNote}` : ""}
              </div>
              <pre>{answer.answer}</pre>
              {answer.conflicts.map((c) => (
                <div className="conflict" key={`${c.left.statementId}-${c.right.statementId}`}>
                  <h3>Conflict kept · {c.personName} / {c.topic}</h3>
                  <p>
                    {c.left.date}: {c.left.excerpt}
                    <br />
                    {c.right.date}: {c.right.excerpt}
                    <br />
                    {c.note}
                  </p>
                </div>
              ))}
              <div className="citations">
                {answer.citations.map((c) => (
                  <div className={`cite${c.synthetic ? " demo" : ""}`} key={c.statementId}>
                    <div className="who">
                      {c.personName} · {c.date}
                      {c.synthetic ? " · DEMO" : ""} · {c.sourceLabel}
                    </div>
                    <p>
                      {c.sourceUrl ? (
                        <a href={c.sourceUrl} target="_blank" rel="noreferrer">
                          {c.excerpt}
                        </a>
                      ) : (
                        c.excerpt
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          ) : null}
        </section>

        <aside className="panel">
          <h2>Roster</h2>
          <p className="hint">Statewide plus the SF and LA mayors. Not the legislature.</p>
          <ul className="roster">
            {(graph?.people ?? []).map((p) => (
              <li key={p.id}>
                {p.name}
                <span>{p.office}</span>
              </li>
            ))}
          </ul>
          <h2>Graph</h2>
          <p className="hint">
            Gold = people. Red squares = topics. Dots = statements. Red dots are DEMO rows.
          </p>
          <GraphView graph={graph} activeIds={activeIds} />
        </aside>
      </div>

      <footer className="foot">
        Infona is the data layer — ingest, entity resolution, ask — not the product.{" "}
        <a href="https://github.com/infona-ai/infona-oss">infona-oss</a>
        . Fixture mode runs on a laptop with no Neo4j. Point <code>INFONA_URL</code> at a running
        Infona API when you have one.
      </footer>
    </main>
  );
}
