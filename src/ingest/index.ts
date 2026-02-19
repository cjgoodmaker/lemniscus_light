import { getDb } from "../store/db.js";
import { ingestAppleHealthXml } from "./apple-health.js";
import { generateDailySummaries } from "../summarise/daily.js";

export async function ingest(
  xmlPath: string,
  sourceId: string = "apple_health",
): Promise<void> {
  const db = getDb();

  console.error(`Ingesting ${xmlPath}...`);

  const result = await ingestAppleHealthXml(
    xmlPath,
    sourceId,
    db,
    (count) => {
      process.stderr.write(`\r  Parsed ${count.toLocaleString()} readings...`);
    },
  );

  console.error("");
  console.error(`  Inserted: ${result.readingsInserted.toLocaleString()}`);
  console.error(
    `  Skipped (dedup): ${result.readingsSkipped.toLocaleString()}`,
  );

  console.error("Generating daily summaries...");
  const summaryCount = generateDailySummaries(db, sourceId);
  console.error(`  Generated ${summaryCount} daily summaries`);

  // Summary breakdown by modality
  const rows = db
    .prepare(
      `SELECT modality, COUNT(*) as count FROM readings WHERE source_id = ? GROUP BY modality`,
    )
    .all(sourceId) as Array<{ modality: string; count: number }>;

  console.error("  Breakdown:");
  for (const r of rows) {
    console.error(`    ${r.modality}: ${r.count.toLocaleString()}`);
  }

  console.error("Done.");
}
