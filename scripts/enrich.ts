import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { enrichFromOfficialPages, mergeLive, statementsToCsv } from "../lib/enrich";
import { loadStatements } from "../lib/graph";
import { createInfonaClient, ingestStatementsCsv, infonaUrl } from "../lib/infona";

async function main() {
  console.log("on-record enrich — public newsrooms only, no logins.");
  const { added, fetched, failed } = await enrichFromOfficialPages();
  console.log(`fetched ${fetched} newsroom page(s); ${added.length} new headline(s).`);
  if (failed.length) {
    console.log(`skipped (unreachable): ${failed.join(", ")}`);
  }

  const livePath = mergeLive(added);
  console.log(`wrote overlay ${livePath}`);

  const csvPath = join(process.cwd(), "data", "statements.csv");
  writeFileSync(csvPath, statementsToCsv(loadStatements()));
  console.log(`wrote ${csvPath} (${loadStatements().length} rows)`);

  if (!infonaUrl()) {
    console.log("INFONA_URL unset — staying in fixture mode. Local graph is enough for npm run dev.");
    return;
  }
  if (!createInfonaClient()) {
    console.log("Infona client not created.");
    return;
  }
  console.log(`ingesting ${csvPath} into Infona kg=on-record …`);
  const result = await ingestStatementsCsv(csvPath);
  console.log("Infona ingest:", JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
