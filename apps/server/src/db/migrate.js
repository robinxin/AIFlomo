import Database from 'better-sqlite3';
import { mkdirSync, readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function runMigrations() {
  const dbPath = process.env.DB_PATH ?? './data/aiflomo.db';
  mkdirSync(dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);

  try {
    // 检查是否已经有表（避免重复迁移）
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
      .all();

    if (tables.length > 0) {
      console.log('Database tables already exist, skipping migration');
      return;
    }

    // 读取并执行迁移 SQL 文件
    const migrationsDir = join(__dirname, 'migrations');
    const migrationFiles = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const sql = readFileSync(join(migrationsDir, file), 'utf-8');
      const statements = sql.split('--> statement-breakpoint').filter((s) => s.trim());

      for (const statement of statements) {
        if (statement.trim()) {
          sqlite.exec(statement);
        }
      }
      console.log(`Applied migration: ${file}`);
    }
  } finally {
    sqlite.close();
  }
}
