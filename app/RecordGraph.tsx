"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fightFor, isLit, lightPath } from "@/lib/light";
import type { AskAnswer, GraphPayload } from "@/lib/types";

const W = 1080;
const H = 680;

type SimNode = {
  id: string;
  kind: "person" | "topic" | "statement";
  label: string;
  sub?: string;
  personId?: string;
  topicId?: string;
  date?: string;
  synthetic?: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;
  fy: number | null;
  r: number;
};

function seedNodes(graph: GraphPayload): SimNode[] {
  const people = graph.people.map((p, i) => {
    const t = graph.people.length === 1 ? 0.5 : i / (graph.people.length - 1);
    return {
      id: p.id,
      kind: "person" as const,
      label: p.name.split(" ").slice(-1)[0] ?? p.name,
      sub: p.office.replace(" of California", "").replace("U.S. ", ""),
      x: 168 + Math.sin(t * Math.PI) * 18,
      y: 78 + t * 460,
      vx: 0,
      vy: 0,
      fx: 168 + Math.sin(t * Math.PI) * 18,
      fy: 78 + t * 460,
      r: 16,
    };
  });
  const topics = graph.topics.map((t, i) => ({
    id: t.id,
    kind: "topic" as const,
    label: t.label.toUpperCase(),
    x: 900,
    y: 130 + i * 180,
    vx: 0,
    vy: 0,
    fx: 900,
    fy: 130 + i * 180,
    r: 22,
  }));
  const personAt = new Map(people.map((p) => [p.id, p]));
  const topicAt = new Map(topics.map((t) => [t.id, t]));
  const statements = graph.statements.map((s, i) => {
    const person = personAt.get(s.personId);
    const topic = topicAt.get(s.topics[0] ?? "housing");
    const px = person?.x ?? 200;
    const py = person?.y ?? 300;
    const tx = topic?.x ?? 880;
    const ty = topic?.y ?? 300;
    const sameLane = graph.statements.filter(
      (other) => other.personId === s.personId && other.topics[0] === s.topics[0],
    );
    const laneIndex = Math.max(0, sameLane.findIndex((other) => other.id === s.id));
    const along = 0.34 + (laneIndex % 3) * 0.12;
    const perp = (laneIndex - (sameLane.length - 1) / 2) * 36;
    const dx = tx - px;
    const dy = ty - py;
    const len = Math.hypot(dx, dy) || 1;
    return {
      id: s.id,
      kind: "statement" as const,
      label: s.date.slice(5).replace("-", "."),
      sub: s.synthetic ? "DEMO" : s.date.slice(0, 4),
      personId: s.personId,
      topicId: s.topics[0],
      date: s.date,
      synthetic: s.synthetic,
      x: px + dx * along + (-dy / len) * perp,
      y: py + dy * along + (dx / len) * perp,
      vx: 0,
      vy: 0,
      fx: null,
      fy: null,
      r: 11,
    };
  });
  return [...people, ...topics, ...statements];
}

function tick(nodes: SimNode[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let d = Math.hypot(dx, dy) || 0.01;
      const min = a.r + b.r + 22;
      if (d < min) {
        const push = ((min - d) / d) * 0.08;
        dx *= push;
        dy *= push;
        if (a.fx == null) {
          a.vx += dx;
          a.vy += dy;
        }
        if (b.fx == null) {
          b.vx -= dx;
          b.vy -= dy;
        }
      } else if (d < 120 && a.kind === "statement" && b.kind === "statement") {
        const push = 12 / (d * d);
        if (a.fx == null) {
          a.vx += dx * push;
          a.vy += dy * push;
        }
        if (b.fx == null) {
          b.vx -= dx * push;
          b.vy -= dy * push;
        }
      }
    }
  }
  for (const n of nodes) {
    if (n.kind !== "statement") continue;
    const person = n.personId ? byId.get(n.personId) : undefined;
    const topic = n.topicId ? byId.get(n.topicId) : undefined;
    if (!person || !topic) continue;
    const tx = person.x * 0.42 + topic.x * 0.58;
    const ty = person.y * 0.42 + topic.y * 0.58;
    n.vx += (tx - n.x) * 0.012;
    n.vy += (ty - n.y) * 0.012;
  }
  for (const n of nodes) {
    if (n.fx != null && n.fy != null) {
      n.x += (n.fx - n.x) * 0.2;
      n.y += (n.fy - n.y) * 0.2;
      n.vx = 0;
      n.vy = 0;
      continue;
    }
    n.vx *= 0.82;
    n.vy *= 0.82;
    n.x = Math.min(W - 40, Math.max(40, n.x + n.vx));
    n.y = Math.min(H - 30, Math.max(30, n.y + n.vy));
  }
}

function shortDate(iso?: string): string {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return m && d ? `${m}.${d}` : iso;
}

export function RecordGraph({
  graph,
  answer,
  focusId,
  onFocus,
}: {
  graph: GraphPayload | null;
  answer: AskAnswer | null;
  focusId: string | null;
  onFocus: (id: string | null) => void;
}) {
  const seeded = useMemo(() => (graph ? seedNodes(graph) : []), [graph]);
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [t, setT] = useState(0);
  const lit = useMemo(() => (graph ? lightPath(graph, answer) : null), [graph, answer]);
  const running = useRef(true);

  useEffect(() => {
    setNodes(seeded.map((n) => ({ ...n })));
  }, [seeded]);

  useEffect(() => {
    running.current = true;
    let frames = 0;
    let raf = 0;
    const loop = () => {
      if (!running.current) return;
      frames += 1;
      if (frames < 90 || frames % 8 === 0) {
        setNodes((prev) => {
          if (!prev.length) return prev;
          const next = prev.map((n) => ({ ...n }));
          tick(next);
          return next;
        });
        setT(frames);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      running.current = false;
      cancelAnimationFrame(raf);
    };
  }, [seeded]);

  if (!graph || !nodes.length || !lit) {
    return <div className="hero-empty">Loading the record…</div>;
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const statements = nodes.filter((n) => n.kind === "statement");
  const breathe = Math.sin(t / 18) * 1.4;

  return (
    <svg
      className="hero-graph"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="People, topics, and statements"
    >
      <defs>
        <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width={W} height={H} fill="#0c0b09" />
      {statements.map((s) => {
        const person = s.personId ? byId.get(s.personId) : undefined;
        const topic = s.topicId ? byId.get(s.topicId) : undefined;
        if (!person || !topic) return null;
        const hot =
          isLit(lit, s.id, "statement") &&
          isLit(lit, person.id, "person") &&
          isLit(lit, topic.id, "topic");
        const dim = lit.active && !hot;
        return (
          <path
            key={`e-${s.id}`}
            d={`M ${person.x} ${person.y} Q ${s.x} ${s.y} ${topic.x} ${topic.y}`}
            fill="none"
            stroke={hot ? "#c4a574" : "#2a251e"}
            strokeWidth={hot ? 2.4 : 1}
            opacity={dim ? 0.18 : hot ? 0.95 : 0.45}
            className={hot ? "path-lit" : undefined}
            filter={hot ? "url(#glow)" : undefined}
          />
        );
      })}
      {nodes.map((n) => {
        if (n.kind !== "person") return null;
        const hot = isLit(lit, n.id, "person") || !lit.active;
        const dim = lit.active && !hot;
        return (
          <g
            key={n.id}
            transform={`translate(${n.x},${n.y})`}
            opacity={dim ? 0.22 : 1}
            className={hot && lit.active ? "node-hot" : undefined}
          >
            <circle r={n.r + (hot && lit.active ? breathe * 0.3 : 0)} fill="#c4a574" />
            <text x={n.r + 10} y={-2} className="node-name">
              {n.label}
            </text>
            <text x={n.r + 10} y={14} className="node-sub">
              {n.sub}
            </text>
          </g>
        );
      })}
      {nodes.map((n) => {
        if (n.kind !== "topic") return null;
        const hot = isLit(lit, n.id, "topic") || !lit.active;
        const dim = lit.active && !hot;
        return (
          <g
            key={n.id}
            transform={`translate(${n.x},${n.y})`}
            opacity={dim ? 0.22 : 1}
            className={hot && lit.active ? "node-hot" : undefined}
          >
            <rect
              x={-n.r}
              y={-n.r}
              width={n.r * 2}
              height={n.r * 2}
              fill="#c23a2b"
              transform="rotate(45)"
            />
            <text x={n.r + 12} y={5} className="topic-name">
              {n.label}
            </text>
          </g>
        );
      })}
      {statements.map((n) => {
        const hot = isLit(lit, n.id, "statement");
        const fight = fightFor(lit, n.id);
        const stale = fight?.stale === n.id;
        const current = fight?.current === n.id;
        const dim = lit.active && !hot;
        const focused = focusId === n.id;
        const r = n.r + (hot ? 3 : 0) + (focused ? 2 : 0);
        return (
          <g
            key={n.id}
            transform={`translate(${n.x},${n.y})`}
            opacity={dim ? 0.16 : 1}
            className="stmt"
            onMouseEnter={() => onFocus(n.id)}
            onMouseLeave={() => onFocus(null)}
            onClick={() => onFocus(n.id)}
          >
            <circle
              r={r + 4}
              fill="none"
              stroke={stale ? "#8a7d68" : current ? "#c23a2b" : hot ? "#e8dfd0" : "transparent"}
              strokeWidth={stale ? 1.4 : 2}
              strokeDasharray={stale ? "3 3" : undefined}
            />
            <circle
              r={r}
              fill={n.synthetic ? "#c23a2b" : hot ? "#e8dfd0" : "#6d6254"}
            />
            {hot ? (
              <text y={r + 16} textAnchor="middle" className="stmt-date">
                {shortDate(n.date)}
                {stale ? " · earlier" : current ? " · later" : ""}
                {n.synthetic ? " · DEMO" : ""}
              </text>
            ) : null}
          </g>
        );
      })}
      {lit.fights.map((f) => {
        const a = byId.get(f.a);
        const b = byId.get(f.b);
        if (!a || !b) return null;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        return (
          <g key={`fight-${f.a}-${f.b}`} className="fight">
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#c23a2b"
              strokeWidth="3"
              strokeDasharray="6 5"
            />
            <rect x={mx - 46} y={my - 28} width="92" height="18" fill="#0c0b09" />
            <text x={mx} y={my - 15} textAnchor="middle" className="fight-tag">
              BOTH KEPT
            </text>
          </g>
        );
      })}
    </svg>
  );
}
