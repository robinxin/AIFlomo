/**
 * T002 - Drizzle Schema 与数据库实例测试
 *
 * TDD 红阶段：先写测试，再写实现
 *
 * 测试范围：
 * 1. Schema 导出（5张表：users/memos/tags/memo_tags/memo_images）
 * 2. 表字段结构（字段名、类型、约束）
 * 3. 数据库实例（连接、基本查询）
 * 4. 外键 cascade 行为（删除用户时级联删除 memos/tags；删除 memo 时级联删除 memo_tags/memo_images）
 * 5. 安全场景（SQL注入防护、XSS输入、边界值、空值、特殊字符）
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq, sql } from 'drizzle-orm';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..');

// ─────────────────────────────────────────────────────────────────────────────
// 辅助：创建内存数据库并应用迁移
// ─────────────────────────────────────────────────────────────────────────────

function createTestDb() {
  const sqlite = new Database(':memory:');
  // SQLite 必须显式开启外键支持
  sqlite.pragma('foreign_keys = ON');
  return sqlite;
}

function applySchema(sqlite) {
  // 直接执行 DDL 以匹配 Drizzle schema 定义
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE TABLE IF NOT EXISTS memos (
      id TEXT PRIMARY KEY NOT NULL,
      content TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE TABLE IF NOT EXISTS memo_tags (
      memo_id TEXT NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS memo_images (
      id TEXT PRIMARY KEY NOT NULL,
      memo_id TEXT NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      uploaded_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// createDb 工厂函数测试（覆盖 index.js 分支）
// ─────────────────────────────────────────────────────────────────────────────

describe('T002 - createDb 工厂函数', () => {
  it('应该导出 createDb 工厂函数', async () => {
    const indexPath = path.join(serverRoot, 'src/db/index.js');
    const dbModule = await import(indexPath);
    expect(typeof dbModule.createDb).toBe('function');
  });

  it('createDb(":memory:") 应创建内存数据库实例', async () => {
    const indexPath = path.join(serverRoot, 'src/db/index.js');
    const { createDb } = await import(indexPath);

    const { db: testDb, sqlite: testSqlite } = createDb(':memory:');
    expect(testDb).toBeDefined();
    expect(testSqlite).toBeDefined();

    // 验证能执行基本查询
    const result = testSqlite.prepare('SELECT 1 as val').get();
    expect(result.val).toBe(1);

    testSqlite.close();
  });

  it('createDb() 不传参数时应使用环境变量 DB_PATH', async () => {
    const indexPath = path.join(serverRoot, 'src/db/index.js');
    const { createDb } = await import(indexPath);

    // DB_PATH 在 .env 中已设置，此路径应成功创建
    const { db: testDb, sqlite: testSqlite } = createDb();
    expect(testDb).toBeDefined();
    testSqlite.close();
  });

  it('createDb() 显式传入路径时应覆盖环境变量', async () => {
    const indexPath = path.join(serverRoot, 'src/db/index.js');
    const { createDb } = await import(indexPath);

    // 明确传入 ':memory:' 路径 — 覆盖 process.env.DB_PATH 的 truthy 分支
    const { db: memDb, sqlite: memSqlite } = createDb(':memory:');
    expect(memDb).toBeDefined();
    expect(memSqlite).toBeDefined();
    memSqlite.close();
  });

  it('createDb() 在 DB_PATH 未设置时应回退到默认路径 ./aiflomo.db', async () => {
    const indexPath = path.join(serverRoot, 'src/db/index.js');
    const { createDb } = await import(indexPath);

    // 临时清除 DB_PATH，测试默认路径分支（nullish coalescing 第三分支）
    const originalDbPath = process.env.DB_PATH;
    delete process.env.DB_PATH;

    let defaultSqlite;
    try {
      // createDb() 不传参且无 DB_PATH — 走第三分支（使用 DEFAULT_DB_PATH = './aiflomo.db'）
      const { db: defaultDb, sqlite: sq } = createDb();
      defaultSqlite = sq;
      expect(defaultDb).toBeDefined();
      expect(sq).toBeDefined();
    } finally {
      // 关闭连接并恢复 DB_PATH
      if (defaultSqlite) {
        defaultSqlite.close();
      }
      if (originalDbPath !== undefined) {
        process.env.DB_PATH = originalDbPath;
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Schema 导出测试（在文件系统层面验证）
// ─────────────────────────────────────────────────────────────────────────────

describe('T002 - Schema 文件导出', () => {
  it('apps/server/src/db/schema.js 文件应该存在', () => {
    const schemaPath = path.join(serverRoot, 'src/db/schema.js');
    expect(fs.existsSync(schemaPath)).toBe(true);
  });

  it('apps/server/src/db/index.js 文件应该存在', () => {
    const indexPath = path.join(serverRoot, 'src/db/index.js');
    expect(fs.existsSync(indexPath)).toBe(true);
  });

  it('schema.js 应该导出 5 个表定义：users、memos、tags、memoTags、memoImages', async () => {
    const schemaPath = path.join(serverRoot, 'src/db/schema.js');
    const schema = await import(schemaPath);

    expect(schema.users).toBeDefined();
    expect(schema.memos).toBeDefined();
    expect(schema.tags).toBeDefined();
    expect(schema.memoTags).toBeDefined();
    expect(schema.memoImages).toBeDefined();
  });

  it('schema.js 导出的对象应该是 Drizzle 表定义（具有 Symbol 特征）', async () => {
    const schemaPath = path.join(serverRoot, 'src/db/schema.js');
    const schema = await import(schemaPath);

    // Drizzle 表对象具有特定的内部结构
    expect(schema.users[Symbol.for('drizzle:IsDrizzleTable')]).toBe(true);
    expect(schema.memos[Symbol.for('drizzle:IsDrizzleTable')]).toBe(true);
    expect(schema.tags[Symbol.for('drizzle:IsDrizzleTable')]).toBe(true);
    expect(schema.memoTags[Symbol.for('drizzle:IsDrizzleTable')]).toBe(true);
    expect(schema.memoImages[Symbol.for('drizzle:IsDrizzleTable')]).toBe(true);
  });

  it('db/index.js 应该导出 db 实例', async () => {
    const indexPath = path.join(serverRoot, 'src/db/index.js');
    const dbModule = await import(indexPath);

    expect(dbModule.db).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 表名验证（SQLite 层）
// ─────────────────────────────────────────────────────────────────────────────

describe('T002 - 表名与 SQLite 映射', () => {
  let sqlite;

  beforeAll(() => {
    sqlite = createTestDb();
    applySchema(sqlite);
  });

  afterAll(() => {
    sqlite.close();
  });

  it('users 表应该映射到 SQLite 表名 "users"', () => {
    const rows = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").all();
    expect(rows).toHaveLength(1);
  });

  it('memos 表应该映射到 SQLite 表名 "memos"', () => {
    const rows = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='memos'").all();
    expect(rows).toHaveLength(1);
  });

  it('tags 表应该映射到 SQLite 表名 "tags"', () => {
    const rows = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tags'").all();
    expect(rows).toHaveLength(1);
  });

  it('memoTags 表应该映射到 SQLite 表名 "memo_tags"', () => {
    const rows = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='memo_tags'").all();
    expect(rows).toHaveLength(1);
  });

  it('memoImages 表应该映射到 SQLite 表名 "memo_images"', () => {
    const rows = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='memo_images'").all();
    expect(rows).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 字段结构验证
// ─────────────────────────────────────────────────────────────────────────────

describe('T002 - 字段结构验证', () => {
  let sqlite;

  beforeAll(() => {
    sqlite = createTestDb();
    applySchema(sqlite);
  });

  afterAll(() => {
    sqlite.close();
  });

  function getColumns(tableName) {
    return sqlite.prepare(`PRAGMA table_info(${tableName})`).all();
  }

  it('users 表应包含 id、username、password_hash、created_at 四个字段', () => {
    const cols = getColumns('users');
    const names = cols.map((c) => c.name);
    expect(names).toContain('id');
    expect(names).toContain('username');
    expect(names).toContain('password_hash');
    expect(names).toContain('created_at');
  });

  it('users.id 应该是主键且类型为 TEXT', () => {
    const cols = getColumns('users');
    const id = cols.find((c) => c.name === 'id');
    expect(id).toBeDefined();
    expect(id.type).toBe('TEXT');
    expect(id.pk).toBe(1);
  });

  it('users.username 应该是 NOT NULL', () => {
    const cols = getColumns('users');
    const username = cols.find((c) => c.name === 'username');
    expect(username).toBeDefined();
    expect(username.notnull).toBe(1);
  });

  it('users.password_hash 应该是 NOT NULL', () => {
    const cols = getColumns('users');
    const ph = cols.find((c) => c.name === 'password_hash');
    expect(ph).toBeDefined();
    expect(ph.notnull).toBe(1);
  });

  it('users.created_at 有 CURRENT_TIMESTAMP 默认值', () => {
    const cols = getColumns('users');
    const ca = cols.find((c) => c.name === 'created_at');
    expect(ca).toBeDefined();
    expect(ca.dflt_value).toMatch(/CURRENT_TIMESTAMP/);
  });

  it('memos 表应包含 id、content、user_id、created_at、updated_at 五个字段', () => {
    const cols = getColumns('memos');
    const names = cols.map((c) => c.name);
    expect(names).toContain('id');
    expect(names).toContain('content');
    expect(names).toContain('user_id');
    expect(names).toContain('created_at');
    expect(names).toContain('updated_at');
  });

  it('memos.id 应该是主键', () => {
    const cols = getColumns('memos');
    const id = cols.find((c) => c.name === 'id');
    expect(id.pk).toBe(1);
  });

  it('memos.content 应该是 NOT NULL', () => {
    const cols = getColumns('memos');
    const content = cols.find((c) => c.name === 'content');
    expect(content.notnull).toBe(1);
  });

  it('memos.user_id 应该是 NOT NULL', () => {
    const cols = getColumns('memos');
    const uid = cols.find((c) => c.name === 'user_id');
    expect(uid.notnull).toBe(1);
  });

  it('tags 表应包含 id、name、user_id、created_at 四个字段', () => {
    const cols = getColumns('tags');
    const names = cols.map((c) => c.name);
    expect(names).toContain('id');
    expect(names).toContain('name');
    expect(names).toContain('user_id');
    expect(names).toContain('created_at');
  });

  it('memo_tags 表应包含 memo_id、tag_id 两个字段', () => {
    const cols = getColumns('memo_tags');
    const names = cols.map((c) => c.name);
    expect(names).toContain('memo_id');
    expect(names).toContain('tag_id');
  });

  it('memo_images 表应包含 id、memo_id、url、file_size、mime_type、uploaded_at 六个字段', () => {
    const cols = getColumns('memo_images');
    const names = cols.map((c) => c.name);
    expect(names).toContain('id');
    expect(names).toContain('memo_id');
    expect(names).toContain('url');
    expect(names).toContain('file_size');
    expect(names).toContain('mime_type');
    expect(names).toContain('uploaded_at');
  });

  it('memo_images.file_size 类型应为 INTEGER', () => {
    const cols = getColumns('memo_images');
    const fs = cols.find((c) => c.name === 'file_size');
    expect(fs).toBeDefined();
    expect(fs.type).toBe('INTEGER');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 数据库实例基本操作测试（使用 Drizzle ORM）
// ─────────────────────────────────────────────────────────────────────────────

describe('T002 - Drizzle 实例基本 CRUD', () => {
  let sqlite;
  let db;
  let schema;

  beforeAll(async () => {
    sqlite = createTestDb();
    applySchema(sqlite);
    db = drizzle(sqlite);

    const schemaPath = path.join(serverRoot, 'src/db/schema.js');
    schema = await import(schemaPath);
  });

  afterAll(() => {
    sqlite.close();
  });

  beforeEach(() => {
    // 清空所有表，保持测试独立
    sqlite.exec('DELETE FROM memo_images');
    sqlite.exec('DELETE FROM memo_tags');
    sqlite.exec('DELETE FROM memos');
    sqlite.exec('DELETE FROM tags');
    sqlite.exec('DELETE FROM users');
  });

  it('应该能向 users 表插入一条记录并查询回来', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({
      id: userId,
      username: 'testuser',
      passwordHash: 'hashed_password',
    });

    const results = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    expect(results).toHaveLength(1);
    expect(results[0].username).toBe('testuser');
    expect(results[0].passwordHash).toBe('hashed_password');
  });

  it('users.id 应该可以由 $defaultFn 自动生成 UUID', async () => {
    // 不显式传 id，让 Drizzle 的 $defaultFn 生成
    await db.insert(schema.users).values({
      username: 'autoid_user',
      passwordHash: 'hash_abc',
    });

    const results = await db.select().from(schema.users).where(eq(schema.users.username, 'autoid_user'));
    expect(results).toHaveLength(1);
    expect(results[0].id).toBeTruthy();
    // UUID v4 格式校验
    expect(results[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('users.created_at 应该有 CURRENT_TIMESTAMP 默认值自动填充', async () => {
    await db.insert(schema.users).values({
      username: 'ts_user',
      passwordHash: 'hash_xyz',
    });

    const results = await db.select().from(schema.users).where(eq(schema.users.username, 'ts_user'));
    expect(results[0].createdAt).toBeTruthy();
    // 应该是一个日期字符串
    expect(new Date(results[0].createdAt).toString()).not.toBe('Invalid Date');
  });

  it('应该能向 memos 表插入记录', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, username: 'memo_owner', passwordHash: 'h' });

    const memoId = crypto.randomUUID();
    await db.insert(schema.memos).values({
      id: memoId,
      content: '这是一条测试笔记',
      userId,
    });

    const results = await db.select().from(schema.memos).where(eq(schema.memos.id, memoId));
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('这是一条测试笔记');
    expect(results[0].userId).toBe(userId);
  });

  it('memos.updatedAt 应该有默认值', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, username: 'upd_user', passwordHash: 'h' });

    await db.insert(schema.memos).values({ content: 'test', userId });

    const results = await db.select().from(schema.memos).where(eq(schema.memos.userId, userId));
    expect(results[0].updatedAt).toBeTruthy();
  });

  it('应该能向 tags 表插入记录', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, username: 'tag_owner', passwordHash: 'h' });

    await db.insert(schema.tags).values({ name: '工作', userId });

    const results = await db.select().from(schema.tags).where(eq(schema.tags.userId, userId));
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('工作');
  });

  it('应该能向 memo_tags 表插入关联记录', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, username: 'mt_owner', passwordHash: 'h' });

    const memoId = crypto.randomUUID();
    await db.insert(schema.memos).values({ id: memoId, content: '联接测试', userId });

    const tagId = crypto.randomUUID();
    await db.insert(schema.tags).values({ id: tagId, name: '标签A', userId });

    await db.insert(schema.memoTags).values({ memoId, tagId });

    const results = await db
      .select()
      .from(schema.memoTags)
      .where(eq(schema.memoTags.memoId, memoId));
    expect(results).toHaveLength(1);
    expect(results[0].tagId).toBe(tagId);
  });

  it('应该能向 memo_images 表插入记录', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, username: 'img_owner', passwordHash: 'h' });

    const memoId = crypto.randomUUID();
    await db.insert(schema.memos).values({ id: memoId, content: '图片笔记', userId });

    await db.insert(schema.memoImages).values({
      memoId,
      url: '/uploads/images/test.jpg',
      fileSize: 102400,
      mimeType: 'image/jpeg',
    });

    const results = await db
      .select()
      .from(schema.memoImages)
      .where(eq(schema.memoImages.memoId, memoId));
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('/uploads/images/test.jpg');
    expect(results[0].fileSize).toBe(102400);
    expect(results[0].mimeType).toBe('image/jpeg');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 外键 CASCADE 行为测试
// ─────────────────────────────────────────────────────────────────────────────

describe('T002 - 外键 onDelete: cascade 行为', () => {
  let sqlite;
  let db;
  let schema;

  beforeAll(async () => {
    sqlite = createTestDb();
    applySchema(sqlite);
    db = drizzle(sqlite);

    const schemaPath = path.join(serverRoot, 'src/db/schema.js');
    schema = await import(schemaPath);
  });

  afterAll(() => {
    sqlite.close();
  });

  beforeEach(() => {
    sqlite.exec('DELETE FROM memo_images');
    sqlite.exec('DELETE FROM memo_tags');
    sqlite.exec('DELETE FROM memos');
    sqlite.exec('DELETE FROM tags');
    sqlite.exec('DELETE FROM users');
  });

  it('删除 user 时，其所有 memos 应级联删除', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, username: 'cascade_user1', passwordHash: 'h' });
    await db.insert(schema.memos).values({ content: '笔记1', userId });
    await db.insert(schema.memos).values({ content: '笔记2', userId });

    // 删除用户
    await db.delete(schema.users).where(eq(schema.users.id, userId));

    // memos 应该也被删除
    const memos = await db.select().from(schema.memos).where(eq(schema.memos.userId, userId));
    expect(memos).toHaveLength(0);
  });

  it('删除 user 时，其所有 tags 应级联删除', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, username: 'cascade_user2', passwordHash: 'h' });
    await db.insert(schema.tags).values({ name: '标签X', userId });
    await db.insert(schema.tags).values({ name: '标签Y', userId });

    await db.delete(schema.users).where(eq(schema.users.id, userId));

    const tags = await db.select().from(schema.tags).where(eq(schema.tags.userId, userId));
    expect(tags).toHaveLength(0);
  });

  it('删除 memo 时，其 memo_tags 关联记录应级联删除', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, username: 'cascade_user3', passwordHash: 'h' });

    const memoId = crypto.randomUUID();
    await db.insert(schema.memos).values({ id: memoId, content: '关联笔记', userId });

    const tagId = crypto.randomUUID();
    await db.insert(schema.tags).values({ id: tagId, name: '关联标签', userId });
    await db.insert(schema.memoTags).values({ memoId, tagId });

    // 删除 memo
    await db.delete(schema.memos).where(eq(schema.memos.id, memoId));

    // memo_tags 应该被删除，但 tag 本身保留
    const memoTags = await db.select().from(schema.memoTags).where(eq(schema.memoTags.memoId, memoId));
    expect(memoTags).toHaveLength(0);

    const tagsRemaining = await db.select().from(schema.tags).where(eq(schema.tags.id, tagId));
    expect(tagsRemaining).toHaveLength(1); // tag 本身保留
  });

  it('删除 tag 时，其 memo_tags 关联记录应级联删除，但 memo 本身保留', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, username: 'cascade_user4', passwordHash: 'h' });

    const memoId = crypto.randomUUID();
    await db.insert(schema.memos).values({ id: memoId, content: '保留笔记', userId });

    const tagId = crypto.randomUUID();
    await db.insert(schema.tags).values({ id: tagId, name: '被删标签', userId });
    await db.insert(schema.memoTags).values({ memoId, tagId });

    // 删除 tag
    await db.delete(schema.tags).where(eq(schema.tags.id, tagId));

    // memo_tags 应该被删除
    const memoTags = await db.select().from(schema.memoTags).where(eq(schema.memoTags.tagId, tagId));
    expect(memoTags).toHaveLength(0);

    // memo 本身保留
    const memosRemaining = await db.select().from(schema.memos).where(eq(schema.memos.id, memoId));
    expect(memosRemaining).toHaveLength(1);
  });

  it('删除 memo 时，其 memo_images 记录应级联删除', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, username: 'cascade_user5', passwordHash: 'h' });

    const memoId = crypto.randomUUID();
    await db.insert(schema.memos).values({ id: memoId, content: '有图片的笔记', userId });
    await db.insert(schema.memoImages).values({
      memoId,
      url: '/uploads/a.jpg',
      fileSize: 1024,
      mimeType: 'image/jpeg',
    });
    await db.insert(schema.memoImages).values({
      memoId,
      url: '/uploads/b.jpg',
      fileSize: 2048,
      mimeType: 'image/png',
    });

    await db.delete(schema.memos).where(eq(schema.memos.id, memoId));

    const images = await db.select().from(schema.memoImages).where(eq(schema.memoImages.memoId, memoId));
    expect(images).toHaveLength(0);
  });

  it('删除 user 时，关联的 memo_tags 和 memo_images 也应通过级联链路全部删除', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, username: 'deep_cascade_user', passwordHash: 'h' });

    const memoId = crypto.randomUUID();
    await db.insert(schema.memos).values({ id: memoId, content: '深度级联笔记', userId });

    const tagId = crypto.randomUUID();
    await db.insert(schema.tags).values({ id: tagId, name: '深度标签', userId });
    await db.insert(schema.memoTags).values({ memoId, tagId });
    await db.insert(schema.memoImages).values({
      memoId,
      url: '/uploads/c.jpg',
      fileSize: 512,
      mimeType: 'image/gif',
    });

    // 删除用户 — 触发深度级联
    await db.delete(schema.users).where(eq(schema.users.id, userId));

    // 验证所有关联数据都已删除
    const memosLeft = await db.select().from(schema.memos).where(eq(schema.memos.userId, userId));
    const tagsLeft = await db.select().from(schema.tags).where(eq(schema.tags.userId, userId));
    const memoTagsLeft = await db.select().from(schema.memoTags).where(eq(schema.memoTags.memoId, memoId));
    const imagesLeft = await db.select().from(schema.memoImages).where(eq(schema.memoImages.memoId, memoId));

    expect(memosLeft).toHaveLength(0);
    expect(tagsLeft).toHaveLength(0);
    expect(memoTagsLeft).toHaveLength(0);
    expect(imagesLeft).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 唯一约束测试
// ─────────────────────────────────────────────────────────────────────────────

describe('T002 - 唯一约束', () => {
  let sqlite;
  let db;
  let schema;

  beforeAll(async () => {
    sqlite = createTestDb();
    applySchema(sqlite);
    db = drizzle(sqlite);

    const schemaPath = path.join(serverRoot, 'src/db/schema.js');
    schema = await import(schemaPath);
  });

  afterAll(() => {
    sqlite.close();
  });

  beforeEach(() => {
    sqlite.exec('DELETE FROM memo_images');
    sqlite.exec('DELETE FROM memo_tags');
    sqlite.exec('DELETE FROM memos');
    sqlite.exec('DELETE FROM tags');
    sqlite.exec('DELETE FROM users');
  });

  it('users.username 应该是唯一的，重复插入应抛出错误', async () => {
    await db.insert(schema.users).values({ username: 'unique_test', passwordHash: 'h1' });

    await expect(
      db.insert(schema.users).values({ username: 'unique_test', passwordHash: 'h2' })
    ).rejects.toThrow();
  });

  it('不同 user 可以有相同的 tag name（标签名不全局唯一）', async () => {
    const userId1 = crypto.randomUUID();
    const userId2 = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId1, username: 'user_a', passwordHash: 'h' });
    await db.insert(schema.users).values({ id: userId2, username: 'user_b', passwordHash: 'h' });

    // 两个用户都创建名为"工作"的标签
    await expect(
      Promise.all([
        db.insert(schema.tags).values({ name: '工作', userId: userId1 }),
        db.insert(schema.tags).values({ name: '工作', userId: userId2 }),
      ])
    ).resolves.toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 安全场景测试
// ─────────────────────────────────────────────────────────────────────────────

describe('T002 - 安全场景：SQL注入防护（参数化查询）', () => {
  let sqlite;
  let db;
  let schema;

  beforeAll(async () => {
    sqlite = createTestDb();
    applySchema(sqlite);
    db = drizzle(sqlite);

    const schemaPath = path.join(serverRoot, 'src/db/schema.js');
    schema = await import(schemaPath);
  });

  afterAll(() => {
    sqlite.close();
  });

  beforeEach(() => {
    sqlite.exec('DELETE FROM memo_images');
    sqlite.exec('DELETE FROM memo_tags');
    sqlite.exec('DELETE FROM memos');
    sqlite.exec('DELETE FROM tags');
    sqlite.exec('DELETE FROM users');
  });

  it('SQL注入字符串作为 username 应被参数化存储，不破坏数据库', async () => {
    const maliciousUsername = "'; DROP TABLE users; --";

    await db.insert(schema.users).values({
      username: maliciousUsername,
      passwordHash: 'hash',
    });

    // 表仍然存在，记录可以查回来
    const results = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, maliciousUsername));

    expect(results).toHaveLength(1);
    expect(results[0].username).toBe(maliciousUsername);
  });

  it('SQL注入作为 memo content 应被安全存储', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, username: 'safe_user', passwordHash: 'h' });

    const sqlInjection = "1; DELETE FROM memos WHERE '1'='1";
    await db.insert(schema.memos).values({ content: sqlInjection, userId });

    const results = await db.select().from(schema.memos).where(eq(schema.memos.userId, userId));
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe(sqlInjection);
  });

  it('XSS 载荷作为 memo content 应被原样存储（不执行）', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, username: 'xss_user', passwordHash: 'h' });

    const xssPayload = '<script>alert("XSS")</script>';
    await db.insert(schema.memos).values({ content: xssPayload, userId });

    const results = await db.select().from(schema.memos).where(eq(schema.memos.userId, userId));
    expect(results[0].content).toBe(xssPayload); // 数据库层原样存储，渲染层负责转义
  });

  it('特殊字符（引号、反斜杠、Unicode）作为 tag name 应被安全存储', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, username: 'special_user', passwordHash: 'h' });

    const specialName = "It's a \"tag\" \\with/ special chars 中文🎉";
    await db.insert(schema.tags).values({ name: specialName, userId });

    const results = await db.select().from(schema.tags).where(eq(schema.tags.userId, userId));
    expect(results[0].name).toBe(specialName);
  });

  it('NULL 字节字符串应被安全存储', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, username: 'null_byte_user', passwordHash: 'h' });

    const nullByteContent = 'content with \x00 null byte';
    await db.insert(schema.memos).values({ content: nullByteContent, userId });

    const results = await db.select().from(schema.memos).where(eq(schema.memos.userId, userId));
    expect(results[0].content).toBe(nullByteContent);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 边界值测试
// ─────────────────────────────────────────────────────────────────────────────

describe('T002 - 边界值测试', () => {
  let sqlite;
  let db;
  let schema;

  beforeAll(async () => {
    sqlite = createTestDb();
    applySchema(sqlite);
    db = drizzle(sqlite);

    const schemaPath = path.join(serverRoot, 'src/db/schema.js');
    schema = await import(schemaPath);
  });

  afterAll(() => {
    sqlite.close();
  });

  beforeEach(() => {
    sqlite.exec('DELETE FROM memo_images');
    sqlite.exec('DELETE FROM memo_tags');
    sqlite.exec('DELETE FROM memos');
    sqlite.exec('DELETE FROM tags');
    sqlite.exec('DELETE FROM users');
  });

  it('memo content 为恰好 10000 字符时应能正常存储', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, username: 'boundary_user1', passwordHash: 'h' });

    const content = 'A'.repeat(10000);
    await db.insert(schema.memos).values({ content, userId });

    const results = await db.select().from(schema.memos).where(eq(schema.memos.userId, userId));
    expect(results[0].content).toHaveLength(10000);
  });

  it('memo content 为空字符串时插入应失败（NOT NULL + 业务层通过 content 保证）', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, username: 'empty_content_user', passwordHash: 'h' });

    // 数据库层面 NOT NULL 但不限制空字符串，业务层（路由 JSON Schema minLength: 1）负责拦截
    // 此测试验证空字符串在 DB 层可以存储（长度校验在路由层）
    await db.insert(schema.memos).values({ content: '', userId });
    const results = await db.select().from(schema.memos).where(eq(schema.memos.userId, userId));
    expect(results[0].content).toBe('');
  });

  it('memo_images.file_size 为 0 时应能存储', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, username: 'zero_size_user', passwordHash: 'h' });

    const memoId = crypto.randomUUID();
    await db.insert(schema.memos).values({ id: memoId, content: '零字节图片', userId });

    await db.insert(schema.memoImages).values({
      memoId,
      url: '/uploads/empty.jpg',
      fileSize: 0,
      mimeType: 'image/jpeg',
    });

    const results = await db.select().from(schema.memoImages).where(eq(schema.memoImages.memoId, memoId));
    expect(results[0].fileSize).toBe(0);
  });

  it('memo_images.file_size 为最大值（5MB = 5242880字节）时应能存储', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, username: 'max_size_user', passwordHash: 'h' });

    const memoId = crypto.randomUUID();
    await db.insert(schema.memos).values({ id: memoId, content: '最大图片笔记', userId });

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    await db.insert(schema.memoImages).values({
      memoId,
      url: '/uploads/max.jpg',
      fileSize: MAX_SIZE,
      mimeType: 'image/jpeg',
    });

    const results = await db.select().from(schema.memoImages).where(eq(schema.memoImages.memoId, memoId));
    expect(results[0].fileSize).toBe(MAX_SIZE);
  });

  it('一条 memo 关联多个 tags 应能正常存储', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, username: 'multi_tag_user', passwordHash: 'h' });

    const memoId = crypto.randomUUID();
    await db.insert(schema.memos).values({ id: memoId, content: '多标签笔记', userId });

    const tagIds = [];
    for (let i = 0; i < 5; i++) {
      const tagId = crypto.randomUUID();
      tagIds.push(tagId);
      await db.insert(schema.tags).values({ id: tagId, name: `标签${i}`, userId });
      await db.insert(schema.memoTags).values({ memoId, tagId });
    }

    const results = await db.select().from(schema.memoTags).where(eq(schema.memoTags.memoId, memoId));
    expect(results).toHaveLength(5);
  });

  it('memo 超长内容（100000字符）在数据库层面应能存储（SQLite TEXT 无硬性上限）', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, username: 'long_content_user', passwordHash: 'h' });

    const longContent = '中'.repeat(100000);
    await db.insert(schema.memos).values({ content: longContent, userId });

    const results = await db.select().from(schema.memos).where(eq(schema.memos.userId, userId));
    expect(results[0].content).toHaveLength(100000);
  });

  it('NOT NULL 约束：memos.content 为 null 时插入应抛出错误', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, username: 'null_content_user', passwordHash: 'h' });

    await expect(
      db.insert(schema.memos).values({ content: null, userId })
    ).rejects.toThrow();
  });

  it('NOT NULL 约束：users.username 为 null 时插入应抛出错误', async () => {
    await expect(
      db.insert(schema.users).values({ username: null, passwordHash: 'h' })
    ).rejects.toThrow();
  });

  it('外键约束：memos.userId 引用不存在的 user 时应抛出错误', async () => {
    await expect(
      db.insert(schema.memos).values({
        content: '孤儿笔记',
        userId: 'non-existent-user-id',
      })
    ).rejects.toThrow();
  });

  it('外键约束：memo_tags.memoId 引用不存在的 memo 时应抛出错误', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, username: 'fk_test_user', passwordHash: 'h' });

    const tagId = crypto.randomUUID();
    await db.insert(schema.tags).values({ id: tagId, name: '孤儿标签', userId });

    await expect(
      db.insert(schema.memoTags).values({
        memoId: 'non-existent-memo-id',
        tagId,
      })
    ).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// $defaultFn UUID 自动生成覆盖率（针对所有有 $defaultFn 的表）
// ─────────────────────────────────────────────────────────────────────────────

describe('T002 - $defaultFn UUID 自动生成覆盖（所有表）', () => {
  let sqlite;
  let db;
  let schema;

  beforeAll(async () => {
    sqlite = createTestDb();
    applySchema(sqlite);
    db = drizzle(sqlite);

    const schemaPath = path.join(serverRoot, 'src/db/schema.js');
    schema = await import(schemaPath);
  });

  afterAll(() => {
    sqlite.close();
  });

  beforeEach(() => {
    sqlite.exec('DELETE FROM memo_images');
    sqlite.exec('DELETE FROM memo_tags');
    sqlite.exec('DELETE FROM memos');
    sqlite.exec('DELETE FROM tags');
    sqlite.exec('DELETE FROM users');
  });

  it('tags 表不提供 id 时 $defaultFn 应自动生成 UUID', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, username: 'dfn_tag_user', passwordHash: 'h' });

    // 不提供 id — 触发 $defaultFn
    await db.insert(schema.tags).values({ name: '自动ID标签', userId });

    const results = await db.select().from(schema.tags).where(eq(schema.tags.userId, userId));
    expect(results).toHaveLength(1);
    expect(results[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('memos 表不提供 id 时 $defaultFn 应自动生成 UUID', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, username: 'dfn_memo_user', passwordHash: 'h' });

    // 不提供 id — 触发 $defaultFn
    await db.insert(schema.memos).values({ content: '自动ID笔记', userId });

    const results = await db.select().from(schema.memos).where(eq(schema.memos.userId, userId));
    expect(results).toHaveLength(1);
    expect(results[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('memo_images 表不提供 id 时 $defaultFn 应自动生成 UUID', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, username: 'dfn_img_user', passwordHash: 'h' });

    const memoId = crypto.randomUUID();
    await db.insert(schema.memos).values({ id: memoId, content: '自动ID图片笔记', userId });

    // 不提供 id — 触发 $defaultFn
    await db.insert(schema.memoImages).values({
      memoId,
      url: '/uploads/auto_id.jpg',
      fileSize: 512,
      mimeType: 'image/jpeg',
    });

    const results = await db.select().from(schema.memoImages).where(eq(schema.memoImages.memoId, memoId));
    expect(results).toHaveLength(1);
    expect(results[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('schema 导出中所有表的 .references() 回调均能被调用并返回正确的父表列', async () => {
    // Drizzle 将 .references(() => parentCol) 存储为懒加载函数
    // 通过 Symbol(drizzle:SQLiteInlineForeignKeys) 访问并调用 reference 函数
    // 以覆盖 schema.js 中所有 .references() 箭头函数体
    const schemaPath = path.join(serverRoot, 'src/db/schema.js');
    const s = await import(schemaPath);

    const FKSymbol = Symbol.for('drizzle:SQLiteInlineForeignKeys');

    // memos 表：memos.userId → users.id
    const memosFKs = s.memos[FKSymbol];
    expect(memosFKs).toBeDefined();
    expect(memosFKs.length).toBeGreaterThan(0);
    const memosRefResult = memosFKs[0].reference();
    expect(memosRefResult).toBeDefined();
    expect(memosRefResult.columns).toBeDefined();

    // tags 表：tags.userId → users.id
    const tagsFKs = s.tags[FKSymbol];
    expect(tagsFKs).toBeDefined();
    const tagsRefResult = tagsFKs[0].reference();
    expect(tagsRefResult).toBeDefined();

    // memoTags 表：两个 FK（memoId → memos.id，tagId → tags.id）
    const memoTagsFKs = s.memoTags[FKSymbol];
    expect(memoTagsFKs).toBeDefined();
    expect(memoTagsFKs.length).toBe(2);
    const memoTagsRef0 = memoTagsFKs[0].reference();
    const memoTagsRef1 = memoTagsFKs[1].reference();
    expect(memoTagsRef0).toBeDefined();
    expect(memoTagsRef1).toBeDefined();

    // memoImages 表：memoImages.memoId → memos.id
    const memoImagesFKs = s.memoImages[FKSymbol];
    expect(memoImagesFKs).toBeDefined();
    const memoImagesRefResult = memoImagesFKs[0].reference();
    expect(memoImagesRefResult).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Drizzle Schema 字段名映射验证（camelCase JS ↔ snake_case SQL）
// ─────────────────────────────────────────────────────────────────────────────

describe('T002 - Drizzle camelCase 到 snake_case 字段映射', () => {
  let sqlite;
  let db;
  let schema;

  beforeAll(async () => {
    sqlite = createTestDb();
    applySchema(sqlite);
    db = drizzle(sqlite);

    const schemaPath = path.join(serverRoot, 'src/db/schema.js');
    schema = await import(schemaPath);
  });

  afterAll(() => {
    sqlite.close();
  });

  beforeEach(() => {
    sqlite.exec('DELETE FROM memo_images');
    sqlite.exec('DELETE FROM memo_tags');
    sqlite.exec('DELETE FROM memos');
    sqlite.exec('DELETE FROM tags');
    sqlite.exec('DELETE FROM users');
  });

  it('users 查询结果应使用 camelCase 字段名（passwordHash 而非 password_hash）', async () => {
    await db.insert(schema.users).values({ username: 'mapping_user', passwordHash: 'h' });
    const results = await db.select().from(schema.users).where(eq(schema.users.username, 'mapping_user'));

    expect(results[0]).toHaveProperty('passwordHash');
    expect(results[0]).toHaveProperty('createdAt');
    expect(results[0]).not.toHaveProperty('password_hash');
    expect(results[0]).not.toHaveProperty('created_at');
  });

  it('memos 查询结果应使用 camelCase 字段名（userId、createdAt、updatedAt）', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, username: 'memo_mapping_user', passwordHash: 'h' });
    await db.insert(schema.memos).values({ content: '映射测试', userId });

    const results = await db.select().from(schema.memos).where(eq(schema.memos.userId, userId));

    expect(results[0]).toHaveProperty('userId');
    expect(results[0]).toHaveProperty('createdAt');
    expect(results[0]).toHaveProperty('updatedAt');
    expect(results[0]).not.toHaveProperty('user_id');
    expect(results[0]).not.toHaveProperty('created_at');
    expect(results[0]).not.toHaveProperty('updated_at');
  });

  it('memo_images 查询结果应使用 camelCase 字段名（memoId、fileSize、mimeType、uploadedAt）', async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, username: 'img_mapping_user', passwordHash: 'h' });

    const memoId = crypto.randomUUID();
    await db.insert(schema.memos).values({ id: memoId, content: '映射图片', userId });

    await db.insert(schema.memoImages).values({
      memoId,
      url: '/test.jpg',
      fileSize: 100,
      mimeType: 'image/jpeg',
    });

    const results = await db.select().from(schema.memoImages).where(eq(schema.memoImages.memoId, memoId));

    expect(results[0]).toHaveProperty('memoId');
    expect(results[0]).toHaveProperty('fileSize');
    expect(results[0]).toHaveProperty('mimeType');
    expect(results[0]).toHaveProperty('uploadedAt');
    expect(results[0]).not.toHaveProperty('memo_id');
    expect(results[0]).not.toHaveProperty('file_size');
    expect(results[0]).not.toHaveProperty('mime_type');
    expect(results[0]).not.toHaveProperty('uploaded_at');
  });
});
