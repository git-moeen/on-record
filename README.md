# on-record

Ask what California politicians actually said. Every answer has a source and a date.

If two statements pull in opposite directions, you get both — and when they were said. If the graph cannot tell, it says so.

This is the agent. [Infona](https://github.com/infona-ai/infona-oss) is the data layer (ingest, entity resolution, provenance, ask). You do not need Infona or Neo4j to try it.

## Run

```bash
git clone https://github.com/git-moeen/on-record.git
cd on-record
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The first question is already asked:

**What has Newsom said about housing this year?**

Same path in Docker:

```bash
docker compose up
```

## Ask

A handful of names, not the legislature:

- Gavin Newsom
- Alex Padilla
- Adam Schiff
- Katie Porter *(former House — no 2026 office feed; DEMO rows only)*
- Daniel Lurie (SF)
- Karen Bass (LA)

Topics the graph actually tracks: **housing**, **water**, **AI**.

Public official newsrooms and press releases only. No voter files. No logins.

Red citations are **DEMO / synthetic**. They are there so a clone can see a conflict without inventing a real quote. Do not treat them as fact.

## Enrich

```bash
npm run enrich
```

Pulls public headlines from official newsrooms, writes `data/live.json` + `data/statements.csv`. Schedule it if you want:

```cron
0 6 * * * cd /path/to/on-record && npm run enrich
```

or once:

```bash
docker compose --profile enrich run --rm enrich
```

## Infona (optional)

When `INFONA_URL` points at a running Infona API, ask and enrich use the real [`@infona-ai/cli`](https://www.npmjs.com/package/@infona-ai/cli) client — `ingest`, `er rebuild`, `ask`. Same routes as the Infona CLI / MCP.

```bash
cp .env.example .env
# INFONA_URL=http://localhost:8000
# INFONA_TENANT=default
npm run enrich
npm run dev
```

Bring your own Infona OSS stack. This repo does not vendor it.

## What this is not

Not a voter file. Not a scrape behind a login. Not a clinical-trials demo. Not “watch Infona merge Acme.”
