import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type Database from "better-sqlite3";
import { listSources } from "../store/query.js";

export function registerListSources(
  server: McpServer,
  db: Database.Database,
): void {
  server.tool(
    "list_sources",
    "List all data sources that have been ingested (e.g. Apple Health exports). Shows record counts and date ranges.",
    {},
    async () => {
      const sources = listSources(db);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ count: sources.length, sources }),
          },
        ],
      };
    },
  );
}
