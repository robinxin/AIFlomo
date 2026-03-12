// apps/server/src/db/index.js
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

/**
 * Validates that dbPath resolves to within the ./data directory.
 * Throws if the resolved path escapes the allowed directory, preventing
 * path traversal attacks via environment variable injection.
 *
 * Exported for unit testing.
 *
 * @param {string} dbPath - The DB_PATH value to validate
 * @throws {Error} If dbPath resolves outside ./data
 */
export function validateDbPath(dbPath) {
  if (dbPath === ':memory:') return; // In-memory databases need no filesystem validation

  const resolvedDbPath = resolve(dbPath);
  const resolvedDataDir = resolve('./data');
  if (!resolvedDbPath.startsWith(resolvedDataDir + '/') && resolvedDbPath !== resolvedDataDir) {
    throw new Error(
      `DB_PATH must resolve to a path within the ./data directory. Got: ${resolvedDbPath}`
    );
  }
}

const dbPath = process.env.DB_PATH || './data/aiflomo.db';

// Ensure the parent directory exists (skip for in-memory databases)
if (dbPath !== ':memory:') {
  // Validate path before touching the filesystem
  validateDbPath(dbPath);

  const dir = dirname(dbPath);
  // mode: 0o700 — restrict directory access to the owner only (rwx------)
  mkdirSync(dir, { recursive: true, mode: 0o700 });
}

const sqlite = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
sqlite.pragma('journal_mode = WAL');

// Enable foreign key enforcement (SQLite disables FK checks by default)
sqlite.pragma('foreign_keys = ON');

const db = drizzle(sqlite, { schema });

export default db;
