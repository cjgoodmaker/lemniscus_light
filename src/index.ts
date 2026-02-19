#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getDb } from "./store/db.js";
import { registerBrowseTimeline } from "./tools/browse-timeline.js";
import { registerQueryReadings } from "./tools/query-readings.js";
import { registerRetrieveContext } from "./tools/retrieve-context.js";
import { registerListSources } from "./tools/list-sources.js";
import { registerListModalities } from "./tools/list-modalities.js";
import { registerAddNote } from "./tools/add-note.js";
import { registerAnnotate } from "./tools/annotate.js";

const server = new McpServer({
  name: "lemniscus-light",
  version: "0.1.0",
});

const db = getDb();

registerBrowseTimeline(server, db);
registerQueryReadings(server, db);
registerRetrieveContext(server, db);
registerListSources(server, db);
registerListModalities(server, db);
registerAddNote(server, db);
registerAnnotate(server, db);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("lemniscus-light MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
