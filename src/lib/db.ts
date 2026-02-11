// ============================================================
// HABGEN Risk Scorer – Database Setup (SQLite via better-sqlite3)
// ============================================================

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'riskscoring.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS universities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      party_score REAL NOT NULL,
      tier INTEGER NOT NULL CHECK (tier IN (1, 2, 3)),
      campus_lat REAL,
      campus_lng REAL
    );

    CREATE TABLE IF NOT EXISTS assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      address TEXT NOT NULL,
      formatted_address TEXT,
      lat REAL,
      lng REAL,
      university_id INTEGER REFERENCES universities(id),
      property_info TEXT,
      property_scores TEXT,
      property_result TEXT,
      gl_scores TEXT,
      gl_result TEXT
    );
  `);
}
