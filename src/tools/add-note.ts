import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type Database from "better-sqlite3";
import { insertNote } from "../store/write.js";

export function registerAddNote(
  server: McpServer,
  db: Database.Database,
): void {
  server.tool(
    "add_note",
    "Save a timestamped note to the health timeline. Use this to record context the user shares — meals, mood, symptoms, medication, exercise details, life events, or any observation that adds context to the wearable data. The note will appear alongside wearable data when browsing the timeline and is searchable.",
    {
      text: z.string().describe("The note content. Write in clear, factual language."),
      timestamp: z.string().optional().describe("ISO 8601 timestamp for when this note applies. Defaults to current time."),
      source: z.string().default("assistant").describe("Identifier for the writing model, e.g. 'claude-sonnet-4-5', 'gpt-4o'."),
    },
    async (args) => {
      const timestamp = args.timestamp ?? new Date().toISOString();
      const id = insertNote(db, {
        timestamp,
        text: args.text,
        source: args.source,
        annotation_date: null,
        annotation_modality: null,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              note_id: id,
              timestamp,
              message: "Note saved to health timeline.",
            }),
          },
        ],
      };
    },
  );
}
