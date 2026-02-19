#!/usr/bin/env node

import * as fs from "node:fs";
import { ingest } from "../src/ingest/index.js";

const xmlPath = process.argv[2];

if (!xmlPath) {
  console.error("Usage: lemniscus-light-ingest <path-to-export.xml>");
  console.error("");
  console.error("Example:");
  console.error("  npx lemniscus-light-ingest ./export.xml");
  process.exit(1);
}

if (!fs.existsSync(xmlPath)) {
  console.error(`File not found: ${xmlPath}`);
  process.exit(1);
}

const sourceId = process.argv[3] ?? "apple_health";

ingest(xmlPath, sourceId).catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
