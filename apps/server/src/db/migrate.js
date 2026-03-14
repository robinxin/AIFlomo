/**
 * Drizzle ORM 数据库迁移脚本
 *
 * 用法：node src/db/migrate.js
 * 包管理：pnpm db:migrate
 *
 * 职责：
 * - 读取 src/db/migrations/ 目录下的所有 SQL 迁移文件
 * - 使用 Drizzle ORM migrate() 函数按顺序执行未执行过的迁移
 * - 迁移记录存储在 SQLite 同库的 __drizzle_migrations 表中（自动管理，幂等）
 *
 * 环境变量：
 * - DB_PATH（可选）: SQLite 数据库文件路径（默认 ./data.db）
 */

import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// ── ESM __dirname 兼容处理 ───────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── 配置 ─────────────────────────────────────────────────────────────────────

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data.db');
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// ── 执行迁移 ─────────────────────────────────────────────────────────────────

const sqlite = new Database(DB_PATH);
const db = drizzle(sqlite);

console.log(`[migrate] 数据库路径: ${DB_PATH}`);
console.log(`[migrate] 迁移目录: ${MIGRATIONS_DIR}`);
console.log('[migrate] 开始执行迁移...');

migrate(db, { migrationsFolder: MIGRATIONS_DIR });

console.log('[migrate] 迁移完成。');

sqlite.close();
