import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import * as schema from './schema.js';

const dbPath = process.env.DB_PATH ?? './data/aiflomo.db';

// 自动创建数据库目录（防止新机器首次启动报错）
mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);

export const db = drizzle(sqlite, { schema });
