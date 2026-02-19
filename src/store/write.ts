import type Database from "better-sqlite3";
import type { Reading, Summary, Note } from "../types.js";

export function insertReadingsBatch(
  db: Database.Database,
  readings: Reading[],
): number {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO readings
    (source_id, source_type, record_type, short_name, modality, value, unit,
     timestamp, end_timestamp, metadata, dedup_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((batch: Reading[]) => {
    let count = 0;
    for (const r of batch) {
      const result = stmt.run(
        r.source_id,
        r.source_type,
        r.record_type,
        r.short_name,
        r.modality,
        r.value,
        r.unit,
        r.timestamp,
        r.end_timestamp,
        JSON.stringify(r.metadata),
        r.dedup_key,
      );
      if (result.changes > 0) count++;
    }
    return count;
  });

  return insertMany(readings);
}

export function upsertSummary(db: Database.Database, s: Summary): void {
  db.prepare(`
    INSERT OR REPLACE INTO summaries
    (source_id, date, modality, summary, structured_data)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    s.source_id,
    s.date,
    s.modality,
    s.summary,
    JSON.stringify(s.structured_data),
  );
}

export function insertNote(
  db: Database.Database,
  note: Omit<Note, "id" | "created_at">,
): number {
  const result = db.prepare(`
    INSERT INTO notes (timestamp, text, source, annotation_date, annotation_modality)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    note.timestamp,
    note.text,
    note.source,
    note.annotation_date,
    note.annotation_modality,
  );
  return Number(result.lastInsertRowid);
}
