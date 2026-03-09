import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema.js';
import { mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const dbPath = process.env.DB_PATH ?? './data/aiflomo.db';
mkdirSync(dirname(dbPath), { recursive: true });
const sqlite = new Database(dbPath);

// Auto-migrate: 检查表是否存在，不存在则执行迁移
const tableCheck = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
if (!tableCheck) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const migrationSQL = readFileSync(join(__dirname, 'migrations/0000_petite_blade.sql'), 'utf8');
  sqlite.exec(migrationSQL);
  console.log('Database tables created successfully');
}

export const db = drizzle(sqlite, { schema });
