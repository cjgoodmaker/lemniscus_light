import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type Database from "better-sqlite3";
import { insertNote } from "../store/write.js";
import type { Modality } from "../types.js";

export function registerAnnotate(
  server: McpServer,
  db: Database.Database,
): void {
  server.tool(
    "annotate",
    "Annotate a specific date in the health timeline with context. Use this to explain why data looks a certain way — e.g. annotating a high heart rate day with 'food poisoning' or a low activity day with 'sick in bed'. The annotation links to that date and shows up when browsing that period.",
    {
      date: z.string().describe("The date to annotate (YYYY-MM-DD format)"),
      text: z.string().describe("The annotation text"),
      modality: z.string().optional().describe("Which modality this explains: vitals, activity, sleep, body, nutrition, fitness, mindfulness, workout"),
      source: z.string().default("assistant").describe("Identifier for the writing model"),
    },
    async (args) => {
      const timestamp = new Date().toISOString();
      const id = insertNote(db, {
        timestamp,
        text: args.text,
        source: args.source,
        annotation_date: args.date,
        annotation_modality: (args.modality as Modality) ?? null,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              note_id: id,
              annotated_date: args.date,
              modality: args.modality ?? null,
              message: `Annotation saved for ${args.date}.`,
            }),
          },
        ],
      };
    },
  );
}
