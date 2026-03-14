/**
 * Database migration runner
 * Applies all pending Drizzle migrations to the SQLite database.
 *
 * Usage: node src/db/migrate.js
 */

import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// __dirname is apps/server/src/db/, so ../../ resolves to apps/server/
const DB_PATH = process.env.DATABASE_URL || join(__dirname, '../../data/aiflomo.db');
const MIGRATIONS_DIR = join(__dirname, 'migrations');

// Ensure the data directory exists before opening the database
mkdirSync(dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
sqlite.pragma('journal_mode = WAL');

const db = drizzle(sqlite);

console.log(`Running migrations from: ${MIGRATIONS_DIR}`);
console.log(`Target database: ${DB_PATH}`);

migrate(db, { migrationsFolder: MIGRATIONS_DIR });

console.log('Migrations applied successfully.');

sqlite.close();
