/**
 * Drizzle ORM instance for AIFlomo.
 *
 * Responsibilities:
 *   1. Resolve the SQLite database file path from DB_PATH env var
 *      (falls back to './data/aiflomo.db' when the variable is absent).
 *   2. Auto-create the parent directory so that first-time startup never
 *      throws ENOENT (required by the Expo Monorepo config spec in CLAUDE.md).
 *   3. Open the better-sqlite3 connection and wrap it with Drizzle ORM.
 *   4. Export the `db` instance for use across the application.
 *
 * Usage:
 *   import { db } from './db/index.js';
 */

import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

// ---------------------------------------------------------------------------
// Resolve the allowed project root for DB_PATH validation.
//
// __dirname equivalent in ESM: src/db/  →  ../../  →  project root (apps/server)
// We allow any path that starts with this directory so that the database file
// cannot be placed outside the project tree (path traversal prevention).
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../../');

// ---------------------------------------------------------------------------
// Resolve the database path and validate it (security: HIGH-3)
//
// If DB_PATH is supplied via the environment it must resolve to a location
// inside PROJECT_ROOT.  This prevents an attacker who can influence the
// environment from redirecting the database to an arbitrary path on the host
// filesystem (e.g. DB_PATH=../../etc/passwd).
// ---------------------------------------------------------------------------

const rawDbPath = process.env.DB_PATH ?? './data/aiflomo.db';
const dbPath = resolve(rawDbPath);

if (process.env.DB_PATH !== undefined) {
  if (!dbPath.startsWith(PROJECT_ROOT + '/') && dbPath !== PROJECT_ROOT) {
    throw new Error(
      `DB_PATH must be inside the project directory.\n` +
      `  Allowed root : ${PROJECT_ROOT}\n` +
      `  Resolved path: ${dbPath}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Auto-create the parent directory (idempotent — recursive: true is a no-op
// when the directory already exists)
// ---------------------------------------------------------------------------

mkdirSync(dirname(dbPath), { recursive: true });

// ---------------------------------------------------------------------------
// Open the SQLite connection and create the Drizzle instance
// ---------------------------------------------------------------------------

const sqlite = new Database(dbPath);

export { sqlite };

export const db = drizzle(sqlite, { schema });
