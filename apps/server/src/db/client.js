/**
 * db/client.js — SQLite 访问层（基于 sql.js，纯 JS，无需本地编译）
 *
 * 提供与原有 Drizzle 兼容的 API 子集，供 auth 路由使用。
 * 持久化：每次写操作后导出到文件；启动时从文件加载（若存在）。
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'aiflomo.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let sqlite = null;
let SQL = null;
let initPromise = null;

async function initSqlite() {
  if (sqlite) return sqlite;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    let initSqlJs = (await import('sql.js')).default;
    if (typeof initSqlJs !== 'function') {
      initSqlJs = require('sql.js');
    }
    SQL = await initSqlJs({
      locateFile: (file) => path.join(path.dirname(require.resolve('sql.js')), file),
    });
    const data = fs.existsSync(dbPath) ? new Uint8Array(fs.readFileSync(dbPath)) : null;
    sqlite = new SQL.Database(data);
    sqlite.run('PRAGMA journal_mode = WAL');
    sqlite.run('PRAGMA foreign_keys = ON');
    runMigrations();
    ensureSessionsTable();
    return sqlite;
  })();
  return initPromise;
}

function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) return;
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const statements = sql.split(/;[\s]*\n/).filter((s) => s.trim().replace(/--.*/g, '').trim());
    for (const stmt of statements) {
      const s = stmt.trim().replace(/--> statement-breakpoint.*/g, '').trim();
      if (s) {
        try {
          sqlite.run(s);
        } catch (e) {
          if (!e.message?.includes('already exists') && !e.message?.includes('duplicate')) throw e;
        }
      }
    }
  }
}

function ensureSessionsTable() {
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      session TEXT,
      expires INTEGER
    )
  `);
}

function persist() {
  if (!sqlite) return;
  const data = sqlite.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    nickname: row.nickname,
    passwordHash: row.password_hash,
    agreedAt: row.agreed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getSqlite() {
  return initSqlite();
}

/** 兼容层：供 auth 路由调用的 API */
export const db = {
  async selectByEmail(email) {
    await initSqlite();
    const stmt = sqlite.prepare('SELECT * FROM users WHERE email = ?');
    stmt.bind([email]);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows.map((r) => rowToUser(r));
  },

  async insertUser(row) {
    await initSqlite();
    sqlite.run(
      `INSERT INTO users (id, email, nickname, password_hash, agreed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.email, row.nickname, row.passwordHash, row.agreedAt, row.createdAt, row.updatedAt]
    );
    persist();
  },

  async getUserById(id) {
    await initSqlite();
    const stmt = sqlite.prepare('SELECT * FROM users WHERE id = ?');
    stmt.bind([id]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return row ? [rowToUser(row)] : [];
  },

  async updateUserUpdatedAt(id, updatedAt) {
    await initSqlite();
    sqlite.run('UPDATE users SET updated_at = ? WHERE id = ?', [updatedAt, id]);
    persist();
  },
};

export function persistDb() {
  persist();
}

export function closeDb() {
  if (sqlite) {
    persist();
    sqlite.close();
    sqlite = null;
    initPromise = null;
  }
}
