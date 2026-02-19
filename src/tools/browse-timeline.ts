import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type Database from "better-sqlite3";
import { browseSummaries, browseNotes, countByModality } from "../store/query.js";

export function registerBrowseTimeline(
  server: McpServer,
  db: Database.Database,
): void {
  server.tool(
    "browse_timeline",
    "Browse the health timeline. Returns daily summaries of wearable data plus any notes for the specified period. Use this to see what happened on specific dates or date ranges.",
    {
      start: z.string().optional().describe("Start date (YYYY-MM-DD or ISO 8601). Defaults to 7 days ago."),
      end: z.string().optional().describe("End date (YYYY-MM-DD or ISO 8601). Defaults to today."),
      modality: z.string().optional().describe("Filter: vitals, activity, sleep, body, nutrition, fitness, mindfulness, workout, note, or 'all'"),
      limit: z.number().min(1).max(500).default(50).describe("Max entries to return"),
      count_only: z.boolean().default(false).describe("Return only counts by modality, no entries"),
    },
    async (args) => {
      const now = new Date();
      const start = args.start ?? new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
      const end = args.end ?? now.toISOString().slice(0, 10);
      const modality = args.modality === "all" ? undefined : args.modality;

      if (args.count_only) {
        const counts = countByModality(db, { start, end });
        // Also count notes in range
        const noteCount = db
          .prepare(
            `SELECT COUNT(*) as c FROM notes
             WHERE (timestamp >= ? OR annotation_date >= ?)
               AND (timestamp <= ? OR annotation_date <= ?)`,
          )
          .get(start, start, end, end) as { c: number };
        if (noteCount.c > 0) counts["note"] = noteCount.c;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ start, end, counts, total: Object.values(counts).reduce((a, b) => a + b, 0) }),
            },
          ],
        };
      }

      const summaries = browseSummaries(db, {
        start,
        end,
        modality: modality as never,
        limit: args.limit,
      });

      const notes = modality === "note" || !modality
        ? browseNotes(db, { start, end, limit: args.limit })
        : [];

      // Merge chronologically
      const entries: Array<{
        type: string;
        date: string;
        modality: string;
        text: string;
        structured_data?: Record<string, unknown>;
        source?: string;
      }> = [];

      for (const s of summaries) {
        entries.push({
          type: "summary",
          date: s.date,
          modality: s.modality,
          text: s.summary,
          structured_data: JSON.parse(s.structured_data),
        });
      }

      for (const n of notes) {
        entries.push({
          type: "note",
          date: n.annotation_date ?? n.timestamp.slice(0, 10),
          modality: n.annotation_modality ?? "note",
          text: n.text,
          source: n.source,
        });
      }

      entries.sort((a, b) => a.date.localeCompare(b.date));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              start,
              end,
              count: entries.length,
              entries,
            }),
          },
        ],
      };
    },
  );
}
