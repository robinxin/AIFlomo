import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'aiflomo.db');

// 确保数据目录存在
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(dbPath);

// 启用 WAL 模式提升并发读性能
sqlite.pragma('journal_mode = WAL');
// 启用外键约束（SQLite 默认关闭）
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

export { sqlite };
