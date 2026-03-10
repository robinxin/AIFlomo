/**
 * Database migration runner.
 * Applies all pending SQL migrations from src/db/migrations/ to the SQLite database.
 * Uses better-sqlite3 directly to avoid needing drizzle-kit CLI at runtime.
 */
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH ?? './data/aiflomo.db';
const MIGRATIONS_DIR = join(__dirname, 'migrations');

function applyMigrations() {
  const db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL UNIQUE,
      created_at INTEGER
    )
  `);

  // Read journal to get migration order
  const journalPath = join(MIGRATIONS_DIR, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf-8'));

  let applied = 0;

  for (const entry of journal.entries) {
    const { tag } = entry;
    const sqlFile = join(MIGRATIONS_DIR, `${tag}.sql`);

    // Check if already applied
    const existing = db.prepare('SELECT id FROM __drizzle_migrations WHERE hash = ?').get(tag);
    if (existing) {
      console.log(`  [skip] ${tag} (already applied)`);
      continue;
    }

    // Read and apply the SQL
    const sql = readFileSync(sqlFile, 'utf-8');

    // Split on Drizzle's statement separator and execute each statement
    const statements = sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);

    db.transaction(() => {
      for (const statement of statements) {
        db.exec(statement);
      }
      db.prepare(
        'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)'
      ).run(tag, Date.now());
    })();

    console.log(`  [done] ${tag}`);
    applied++;
  }

  db.close();

  if (applied === 0) {
    console.log('No new migrations to apply.');
  } else {
    console.log(`Applied ${applied} migration(s) successfully.`);
  }
}

applyMigrations();
