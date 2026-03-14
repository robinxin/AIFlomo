/**
 * DB 访问层 - Drizzle ORM + better-sqlite3
 *
 * 创建并导出全局唯一的 Drizzle db 实例，供路由层调用。
 *
 * 暴露的方法（由 Drizzle 提供）：
 *   db.select()  - 查询，返回可链式调用的 query builder
 *   db.insert()  - 插入，返回可链式调用的 query builder
 *   db.update()  - 更新，返回可链式调用的 query builder
 *
 * 使用方式（路由层）：
 *   import db from '../db/index.js'
 *   const rows = await db.select().from(users).where(eq(users.email, email))
 *
 * 测试层 mock 约定：
 *   jest.mock('../src/db/index.js')
 */

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// ── Constants ─────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Default database file path: apps/server/data/aiflomo.db
// Override via DATABASE_URL environment variable
const DB_PATH = process.env.DATABASE_URL || join(__dirname, '../../data/aiflomo.db');

// ── Database connection ───────────────────────────────────────────────────────

// Ensure the data directory exists before opening the database
mkdirSync(dirname(DB_PATH), { recursive: true });

// Open better-sqlite3 connection (synchronous, single-file SQLite)
const sqlite = new Database(DB_PATH);

// Enable WAL (Write-Ahead Logging) mode for better concurrent read performance
sqlite.pragma('journal_mode = WAL');

// ── Drizzle instance ──────────────────────────────────────────────────────────

// Create Drizzle ORM instance wrapping the SQLite connection.
// Exposes type-safe query builders: select(), insert(), update(), delete(), etc.
// All queries use parameterized statements internally (SQL injection prevention).
const db = drizzle(sqlite);

export default db;
