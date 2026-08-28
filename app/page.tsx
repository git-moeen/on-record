"use client";

import { useEffect, useMemo, useState } from "react";
import { RecordGraph } from "@/app/RecordGraph";
import { lightPath } from "@/lib/light";
import type { AskAnswer, GraphPayload, StatusPayload } from "@/lib/types";

const STARTERS = [
  "What has Newsom said about housing this year?",
  "What has Padilla said about water?",
  "What has Schiff said about AI this year?",
  "What has the SF mayor said about housing?",
  "What has Katie Porter said about housing?",
];

export default function HomePage() {
  const [question, setQuestion] = useState(STARTERS[0]);
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [graph, setGraph] = useState<GraphPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus);
    void fetch("/api/graph")
      .then((r) => r.json())
      .then(setGraph);
    const preset = new URLSearchParams(window.location.search).get("q");
    const first = preset?.trim() || STARTERS[0];
    setQuestion(first);
    void submit(first);
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
      setFocusId(data.citations[0]?.statementId ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ask failed");
    } finally {
      setBusy(false);
    }
  }

  const lit = useMemo(
    () => (graph ? lightPath(graph, answer) : null),
    [graph, answer],
  );

  return (
    <main className="stage">
      <header className="hud">
        <div className="brand">
          <div className="stamp">
            on
            <br />
            record
          </div>
          <div>
            <h1>on-record</h1>
            <p>Ask. The path lights. If they fought themselves, both nodes stay.</p>
          </div>
        </div>
        <div className="badge">
          {status?.infonaUrl
            ? `infona ${status.infonaReachable ? "up" : "unreachable"}`
            : (status?.mode ?? "…")}
        </div>
      </header>

      <section className="hero" aria-label="Record graph">
        <RecordGraph
          graph={graph}
          answer={answer}
          focusId={focusId}
          onFocus={setFocusId}
        />
        <div className="hero-legend">
          <span className="swatch gold" /> people
          <span className="swatch stamp" /> topics
          <span className="swatch paper" /> statements
          <span className="swatch fight" /> conflict · both kept
        </div>
      </section>

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
            rows={2}
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
      </section>

      {answer ? (
        <article className="receipt">
          <div className="meta">
            {answer.mode}
            {answer.matchedPeople.length ? ` · ${answer.matchedPeople.join(", ")}` : ""}
            {answer.matchedTopics.length ? ` · ${answer.matchedTopics.join(", ")}` : ""}
            {answer.year ? ` · ${answer.year}` : ""}
            {lit?.fights.length ? " · conflict kept" : ""}
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
              </p>
            </div>
          ))}
          <div className="citations">
            {answer.citations.map((c) => (
              <button
                type="button"
                className={`cite${c.synthetic ? " demo" : ""}${focusId === c.statementId ? " on" : ""}`}
                key={c.statementId}
                onClick={() => setFocusId(c.statementId)}
                onMouseEnter={() => setFocusId(c.statementId)}
              >
                <div className="who">
                  {c.personName} · {c.date}
                  {c.synthetic ? " · DEMO" : ""} · {c.sourceLabel}
                </div>
                <p>
                  {c.sourceUrl ? (
                    <a href={c.sourceUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                      {c.excerpt}
                    </a>
                  ) : (
                    c.excerpt
                  )}
                </p>
              </button>
            ))}
          </div>
        </article>
      ) : null}

      <footer className="foot">
        Infona is the data layer — ingest, entity resolution, ask — not the product.{" "}
        <a href="https://github.com/infona-ai/infona-oss">infona-oss</a>
        . Point <code>INFONA_URL</code> at a running Infona API when you have one.
      </footer>
    </main>
  );
}
