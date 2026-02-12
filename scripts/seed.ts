// ============================================================
// Seed university database from university_database.json
// Run: npx tsx scripts/seed.ts
// ============================================================

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'riskscoring.db');
const JSON_PATH = path.join(process.cwd(), 'data', 'university_database.json');

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Create table
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

// Load JSON
const raw = fs.readFileSync(JSON_PATH, 'utf-8');
const universities: { name: string; party_score: number; tier: number; campus_lat?: number; campus_lng?: number }[] = JSON.parse(raw);

console.log(`Loaded ${universities.length} universities from JSON`);

// Upsert
const insert = db.prepare(`
  INSERT OR REPLACE INTO universities (name, party_score, tier, campus_lat, campus_lng)
  VALUES (@name, @party_score, @tier, @campus_lat, @campus_lng)
`);

const insertMany = db.transaction((unis: typeof universities) => {
  for (const u of unis) {
    insert.run({ ...u, campus_lat: u.campus_lat ?? null, campus_lng: u.campus_lng ?? null });
  }
});

insertMany(universities);

// Verify
const count = db.prepare('SELECT COUNT(*) as cnt FROM universities').get() as { cnt: number };
console.log(`Database now has ${count.cnt} universities`);

const tiers = db.prepare('SELECT tier, COUNT(*) as cnt FROM universities GROUP BY tier ORDER BY tier').all() as { tier: number; cnt: number }[];
for (const t of tiers) {
  console.log(`  Tier ${t.tier}: ${t.cnt} schools`);
}

db.close();
console.log('Seed complete!');
