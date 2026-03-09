import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import * as schema from './schema.js';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH ?? './data/aiflomo.db';
mkdirSync(dirname(dbPath), { recursive: true });
const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });

// 自动执行数据库迁移（新环境首次启动时创建表）
migrate(db, { migrationsFolder: join(__dirname, 'migrations') });
