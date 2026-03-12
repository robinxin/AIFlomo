// apps/server/src/db/index.js
import 'dotenv/config';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

/** 默认数据库文件路径（当 DB_PATH 环境变量未设置时使用） */
const DEFAULT_DB_PATH = './aiflomo.db';

/**
 * 创建数据库连接和 Drizzle 实例
 * @param {string} [dbPath] - SQLite 数据库文件路径。
 *   若不传，读取 DB_PATH 环境变量；若环境变量也未设置，则使用 DEFAULT_DB_PATH。
 * @returns {{ db: import('drizzle-orm/better-sqlite3').BetterSQLite3Database, sqlite: import('better-sqlite3').Database }}
 */
export function createDb(dbPath) {
  const resolvedPath = dbPath ?? process.env.DB_PATH ?? DEFAULT_DB_PATH;

  // 初始化 SQLite 连接（better-sqlite3 同步驱动）
  const sqlite = new Database(resolvedPath);

  // 开启外键约束支持（SQLite 默认关闭）
  sqlite.pragma('foreign_keys = ON');

  // 返回 Drizzle ORM 实例，附带 schema 定义以支持关系查询
  const db = drizzle(sqlite, { schema });

  return { db, sqlite };
}

// 导出默认实例（读取 DB_PATH 环境变量）
const { db, sqlite } = createDb();

export { db, sqlite };
