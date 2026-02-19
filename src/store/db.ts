import Database from "better-sqlite3";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const SCHEMA_SQL = `
-- Raw individual health readings
CREATE TABLE IF NOT EXISTS readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  record_type TEXT NOT NULL,
  short_name TEXT NOT NULL,
  modality TEXT NOT NULL,
  value REAL,
  unit TEXT NOT NULL DEFAULT '',
  timestamp TEXT NOT NULL,
  end_timestamp TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  dedup_key TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_readings_source_type_ts ON readings(source_id, record_type, timestamp);
CREATE INDEX IF NOT EXISTS idx_readings_modality ON readings(modality);
CREATE INDEX IF NOT EXISTS idx_readings_ts ON readings(timestamp);
CREATE INDEX IF NOT EXISTS idx_readings_short_name ON readings(short_name);

-- Rich daily summaries (FTS5 searches over these)
CREATE TABLE IF NOT EXISTS summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL,
  date TEXT NOT NULL,
  modality TEXT NOT NULL,
  summary TEXT NOT NULL,
  structured_data TEXT NOT NULL DEFAULT '{}',
  UNIQUE(source_id, date, modality)
);
CREATE INDEX IF NOT EXISTS idx_summaries_date ON summaries(date);

-- LLM-written notes
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'unknown',
  annotation_date TEXT,
  annotation_modality TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notes_timestamp ON notes(timestamp);
CREATE INDEX IF NOT EXISTS idx_notes_annotation ON notes(annotation_date);
`;

// FTS5 and triggers — run separately since CREATE VIRTUAL TABLE doesn't support IF NOT EXISTS cleanly
const FTS_SQL = [
  // Summaries FTS
  `CREATE VIRTUAL TABLE IF NOT EXISTS summaries_fts USING fts5(
    summary,
    content='summaries',
    content_rowid='id',
    tokenize='porter unicode61'
  )`,
  `CREATE TRIGGER IF NOT EXISTS summaries_ai AFTER INSERT ON summaries BEGIN
    INSERT INTO summaries_fts(rowid, summary) VALUES (new.id, new.summary);
  END`,
  `CREATE TRIGGER IF NOT EXISTS summaries_ad AFTER DELETE ON summaries BEGIN
    INSERT INTO summaries_fts(summaries_fts, rowid, summary) VALUES ('delete', old.id, old.summary);
  END`,
  `CREATE TRIGGER IF NOT EXISTS summaries_au AFTER UPDATE ON summaries BEGIN
    INSERT INTO summaries_fts(summaries_fts, rowid, summary) VALUES ('delete', old.id, old.summary);
    INSERT INTO summaries_fts(rowid, summary) VALUES (new.id, new.summary);
  END`,
  // Notes FTS
  `CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    text,
    content='notes',
    content_rowid='id',
    tokenize='porter unicode61'
  )`,
  `CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(rowid, text) VALUES (new.id, new.text);
  END`,
  `CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, text) VALUES ('delete', old.id, old.text);
  END`,
  `CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, text) VALUES ('delete', old.id, old.text);
    INSERT INTO notes_fts(rowid, text) VALUES (new.id, new.text);
  END`,
];

let _db: Database.Database | null = null;

function resolveDbPath(): string {
  const envPath = process.env["LEMNISCUS_DB"];
  if (envPath) return envPath;
  return path.join(os.homedir(), ".lemniscus", "health.db");
}

export function getDb(dbPath?: string): Database.Database {
  if (_db) return _db;

  const resolved = dbPath ?? resolveDbPath();
  const dir = path.dirname(resolved);
  fs.mkdirSync(dir, { recursive: true });

  _db = new Database(resolved);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  // Create tables
  _db.exec(SCHEMA_SQL);

  // Create FTS virtual tables and triggers
  for (const sql of FTS_SQL) {
    try {
      _db.exec(sql);
    } catch {
      // Already exists — safe to ignore
    }
  }

  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
