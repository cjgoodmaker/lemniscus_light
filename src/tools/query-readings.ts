import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type Database from "better-sqlite3";
import { queryReadings } from "../store/query.js";

export function registerQueryReadings(
  server: McpServer,
  db: Database.Database,
): void {
  server.tool(
    "query_health_readings",
    "Query raw individual health readings. Use for granular data like individual heart rate measurements across a day, or detailed sleep stage breakdowns.",
    {
      record_type: z.string().describe("Short name of reading type: HeartRate, RestingHR, Steps, SleepAnalysis, Weight, HRV, SpO2, etc."),
      start: z.string().optional().describe("Start datetime (ISO 8601)"),
      end: z.string().optional().describe("End datetime (ISO 8601)"),
      limit: z.number().min(1).max(1000).default(100).describe("Max readings to return"),
    },
    async (args) => {
      const rows = queryReadings(db, {
        short_name: args.record_type,
        start: args.start,
        end: args.end,
        limit: args.limit,
      });

      const readings = rows.map((r) => ({
        short_name: r.short_name,
        value: r.value,
        unit: r.unit,
        timestamp: r.timestamp,
        end_timestamp: r.end_timestamp,
        metadata: JSON.parse(r.metadata),
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ count: readings.length, readings }),
          },
        ],
      };
    },
  );
}
