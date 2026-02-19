import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type Database from "better-sqlite3";
import { searchSummaries, searchNotes } from "../store/query.js";
import type { Modality } from "../types.js";

export function registerRetrieveContext(
  server: McpServer,
  db: Database.Database,
): void {
  server.tool(
    "retrieve_health_context",
    "Search your health timeline using natural language. Searches across daily summaries and notes. Good for questions like 'when did I sleep badly?' or 'days I was very active'.",
    {
      query: z.string().describe("Natural language search query"),
      modality: z.string().optional().describe("Optional modality filter: vitals, activity, sleep, body, nutrition, fitness, mindfulness, workout"),
      start_date: z.string().optional().describe("Optional start date filter (YYYY-MM-DD)"),
      end_date: z.string().optional().describe("Optional end date filter (YYYY-MM-DD)"),
      limit: z.number().min(1).max(50).default(10).describe("Max results"),
    },
    async (args) => {
      const opts = {
        modality: args.modality as Modality | undefined,
        startDate: args.start_date,
        endDate: args.end_date,
        limit: args.limit,
      };

      const summaryResults = searchSummaries(db, args.query, opts);
      const noteResults = searchNotes(db, args.query, {
        ...opts,
        limit: Math.min(args.limit, 5),
      });

      // Build narrative
      const narrativeParts: string[] = [];
      const byModality: Record<string, Array<{ date: string; summary: string }>> = {};

      for (const s of summaryResults) {
        narrativeParts.push(`[${s.modality}] ${s.date}: ${s.summary}`);
        const mod = s.modality;
        if (!byModality[mod]) byModality[mod] = [];
        byModality[mod].push({ date: s.date, summary: s.summary });
      }

      for (const n of noteResults) {
        const date = n.annotation_date ?? n.timestamp.slice(0, 10);
        narrativeParts.push(`[note] ${date}: ${n.text}`);
        if (!byModality["note"]) byModality["note"] = [];
        byModality["note"].push({ date, summary: n.text });
      }

      const result = {
        query: args.query,
        result_count: summaryResults.length + noteResults.length,
        narrative: narrativeParts.join("\n"),
        structured_data: byModality,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );
}
