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
import { dirname } from 'path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

// ---------------------------------------------------------------------------
// Resolve the database path
// ---------------------------------------------------------------------------

const dbPath = process.env.DB_PATH ?? './data/aiflomo.db';

// ---------------------------------------------------------------------------
// Auto-create the parent directory (idempotent — recursive: true is a no-op
// when the directory already exists)
// ---------------------------------------------------------------------------

mkdirSync(dirname(dbPath), { recursive: true });

// ---------------------------------------------------------------------------
// Open the SQLite connection and create the Drizzle instance
// ---------------------------------------------------------------------------

const sqlite = new Database(dbPath);

export const db = drizzle(sqlite, { schema });
