import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema.js';
import { mkdirSync, readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const dbPath = process.env.DB_PATH ?? './data/aiflomo.db';
mkdirSync(dirname(dbPath), { recursive: true });
const sqlite = new Database(dbPath);

// 自动执行数据库迁移
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const migrationsPath = join(__dirname, 'migrations');

if (existsSync(migrationsPath)) {
  const migrationFile = join(migrationsPath, '0000_petite_blade.sql');
  if (existsSync(migrationFile)) {
    const migration = readFileSync(migrationFile, 'utf8');
    const statements = migration
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      try {
        sqlite.exec(statement);
      } catch (error) {
        // 忽略表已存在的错误
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }
    }
  }
}

export const db = drizzle(sqlite, { schema });
