import type Database from "better-sqlite3";
import type { Modality } from "../types.js";

export interface SearchOpts {
  modality?: Modality;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface ReadingQueryOpts {
  record_type?: string;
  short_name?: string;
  source_id?: string;
  start?: string;
  end?: string;
  limit?: number;
}

export interface BrowseOpts {
  source_id?: string;
  start?: string;
  end?: string;
  modality?: Modality;
  limit?: number;
}

export interface SummaryRow {
  id: number;
  source_id: string;
  date: string;
  modality: string;
  summary: string;
  structured_data: string;
  rank?: number;
}

export interface NoteRow {
  id: number;
  timestamp: string;
  text: string;
  source: string;
  annotation_date: string | null;
  annotation_modality: string | null;
  created_at: string;
  rank?: number;
}

export interface ReadingRow {
  id: number;
  source_id: string;
  source_type: string;
  record_type: string;
  short_name: string;
  modality: string;
  value: number | null;
  unit: string;
  timestamp: string;
  end_timestamp: string | null;
  metadata: string;
}

export interface SourceInfo {
  source_id: string;
  source_type: string;
  reading_count: number;
  earliest: string;
  latest: string;
}

/** Sanitize user input for FTS5 MATCH queries */
export function sanitizeFtsQuery(raw: string): string {
  const cleaned = raw.replace(/[*"():^\-,;:!?@#$%&[\]{}|\\<>/]/g, " ");
  const tokens = cleaned.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return '""';
  return tokens.map((t) => `"${t}"`).join(" ");
}

export function searchSummaries(
  db: Database.Database,
  query: string,
  opts: SearchOpts = {},
): SummaryRow[] {
  const ftsQuery = sanitizeFtsQuery(query);
  if (ftsQuery === '""') return [];

  const params: unknown[] = [ftsQuery];
  let where = "";

  if (opts.modality) {
    where += " AND s.modality = ?";
    params.push(opts.modality);
  }
  if (opts.startDate) {
    where += " AND s.date >= ?";
    params.push(opts.startDate);
  }
  if (opts.endDate) {
    where += " AND s.date <= ?";
    params.push(opts.endDate);
  }

  params.push(opts.limit ?? 20);

  return db
    .prepare(
      `SELECT s.*, rank
       FROM summaries_fts
       JOIN summaries s ON summaries_fts.rowid = s.id
       WHERE summaries_fts MATCH ?${where}
       ORDER BY rank
       LIMIT ?`,
    )
    .all(...params) as SummaryRow[];
}

export function searchNotes(
  db: Database.Database,
  query: string,
  opts: SearchOpts = {},
): NoteRow[] {
  const ftsQuery = sanitizeFtsQuery(query);
  if (ftsQuery === '""') return [];

  const params: unknown[] = [ftsQuery];
  let where = "";

  if (opts.modality) {
    where += " AND n.annotation_modality = ?";
    params.push(opts.modality);
  }
  if (opts.startDate) {
    where += " AND n.timestamp >= ?";
    params.push(opts.startDate);
  }
  if (opts.endDate) {
    where += " AND n.timestamp <= ?";
    params.push(opts.endDate);
  }

  params.push(opts.limit ?? 10);

  return db
    .prepare(
      `SELECT n.*, rank
       FROM notes_fts
       JOIN notes n ON notes_fts.rowid = n.id
       WHERE notes_fts MATCH ?${where}
       ORDER BY rank
       LIMIT ?`,
    )
    .all(...params) as NoteRow[];
}

export function queryReadings(
  db: Database.Database,
  opts: ReadingQueryOpts,
): ReadingRow[] {
  const params: unknown[] = [];
  let where = "1=1";

  if (opts.short_name) {
    where += " AND short_name = ?";
    params.push(opts.short_name);
  } else if (opts.record_type) {
    where += " AND record_type = ?";
    params.push(opts.record_type);
  }
  if (opts.source_id) {
    where += " AND source_id = ?";
    params.push(opts.source_id);
  }
  if (opts.start) {
    where += " AND timestamp >= ?";
    params.push(opts.start);
  }
  if (opts.end) {
    where += " AND timestamp <= ?";
    params.push(opts.end);
  }

  params.push(Math.min(opts.limit ?? 100, 1000));

  return db
    .prepare(
      `SELECT * FROM readings WHERE ${where} ORDER BY timestamp DESC LIMIT ?`,
    )
    .all(...params) as ReadingRow[];
}

export function browseSummaries(
  db: Database.Database,
  opts: BrowseOpts,
): SummaryRow[] {
  const params: unknown[] = [];
  let where = "1=1";

  if (opts.source_id) {
    where += " AND source_id = ?";
    params.push(opts.source_id);
  }
  if (opts.start) {
    where += " AND date >= ?";
    params.push(opts.start);
  }
  if (opts.end) {
    where += " AND date <= ?";
    params.push(opts.end);
  }
  if (opts.modality) {
    where += " AND modality = ?";
    params.push(opts.modality);
  }

  params.push(Math.min(opts.limit ?? 50, 500));

  return db
    .prepare(`SELECT * FROM summaries WHERE ${where} ORDER BY date ASC LIMIT ?`)
    .all(...params) as SummaryRow[];
}

export function browseNotes(
  db: Database.Database,
  opts: BrowseOpts,
): NoteRow[] {
  const params: unknown[] = [];
  let where = "1=1";

  if (opts.start) {
    where += " AND (timestamp >= ? OR annotation_date >= ?)";
    params.push(opts.start, opts.start);
  }
  if (opts.end) {
    where += " AND (timestamp <= ? OR annotation_date <= ?)";
    params.push(opts.end, opts.end);
  }
  if (opts.modality) {
    where += " AND annotation_modality = ?";
    params.push(opts.modality);
  }

  params.push(Math.min(opts.limit ?? 50, 500));

  return db
    .prepare(
      `SELECT * FROM notes WHERE ${where} ORDER BY timestamp ASC LIMIT ?`,
    )
    .all(...params) as NoteRow[];
}

export function listSources(db: Database.Database): SourceInfo[] {
  return db
    .prepare(
      `SELECT source_id, source_type, COUNT(*) as reading_count,
              MIN(timestamp) as earliest, MAX(timestamp) as latest
       FROM readings
       GROUP BY source_id, source_type`,
    )
    .all() as SourceInfo[];
}

export function countByModality(
  db: Database.Database,
  opts: BrowseOpts = {},
): Record<string, number> {
  const params: unknown[] = [];
  let where = "1=1";

  if (opts.source_id) {
    where += " AND source_id = ?";
    params.push(opts.source_id);
  }
  if (opts.start) {
    where += " AND date >= ?";
    params.push(opts.start);
  }
  if (opts.end) {
    where += " AND date <= ?";
    params.push(opts.end);
  }

  const rows = db
    .prepare(
      `SELECT modality, COUNT(*) as count FROM summaries WHERE ${where} GROUP BY modality`,
    )
    .all(...params) as Array<{ modality: string; count: number }>;

  const result: Record<string, number> = {};
  for (const r of rows) result[r.modality] = r.count;
  return result;
}
