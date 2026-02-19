import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type Database from "better-sqlite3";
import { MODALITIES } from "../types.js";

export function registerListModalities(
  server: McpServer,
  db: Database.Database,
): void {
  server.tool(
    "list_modalities",
    "List available health data categories (vitals, activity, sleep, etc.) with descriptions of what data each contains.",
    {},
    async () => {
      // Get actual counts from DB
      const rows = db
        .prepare(
          `SELECT modality, COUNT(*) as count FROM readings GROUP BY modality`,
        )
        .all() as Array<{ modality: string; count: number }>;

      const counts: Record<string, number> = {};
      for (const r of rows) counts[r.modality] = r.count;

      const modalities = Object.entries(MODALITIES).map(([name, description]) => ({
        name,
        description,
        reading_count: counts[name] ?? 0,
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ modalities }),
          },
        ],
      };
    },
  );
}
