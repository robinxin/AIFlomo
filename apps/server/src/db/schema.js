// apps/server/src/db/schema.js
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── users ───────────────────────────────────────────────────────────────────
// 系统注册用户。认证模块依赖此表，其他所有业务表通过 userId 外键关联到此表。
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

// ─── memos ───────────────────────────────────────────────────────────────────
// 核心业务实体。content 限制在 10,000 字符以内（由路由层 JSON Schema 校验）。
// onDelete: 'cascade' — 用户账号删除时，其所有笔记随之删除，避免孤儿数据。
export const memos = sqliteTable('memos', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  content: text('content').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

// ─── tags ────────────────────────────────────────────────────────────────────
// 标签归属于具体用户（不同用户可拥有同名标签，互不干扰）。
// name 字段格式约束（中英文、数字、下划线，2-20 字符）由路由层 JSON Schema 校验。
// onDelete: 'cascade' — 用户账号删除时，其所有标签随之删除。
// 注意：tags 表不存储 memoCount，计数通过查询 memo_tags 实时聚合，避免数据不一致。
export const tags = sqliteTable('tags', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

// ─── memo_tags ───────────────────────────────────────────────────────────────
// 笔记与标签的多对多关联表。一条笔记可有多个标签，一个标签可关联多条笔记。
// memoId onDelete: 'cascade' — 笔记删除时，关联记录随之删除。
// tagId  onDelete: 'cascade' — 标签删除时，关联记录随之删除（笔记本身保留）。
// 联合主键（memoId + tagId）由应用层保证唯一性（插入前先查询）；
// SQLite 不直接支持在 Drizzle sqliteTable 中声明复合主键约束，
// 唯一性通过路由层"先查后写"逻辑保障。
export const memoTags = sqliteTable('memo_tags', {
  memoId: text('memo_id')
    .notNull()
    .references(() => memos.id, { onDelete: 'cascade' }),
  tagId: text('tag_id')
    .notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
});

// ─── memo_images ─────────────────────────────────────────────────────────────
// 笔记附图元数据。图片二进制内容存储在服务器文件系统（或后续对象存储），
// 此表仅保存 URL 路径和文件元数据，供前端渲染缩略图使用。
// 单条笔记最多 9 张图片，由路由层业务逻辑校验（查询当前笔记已有图片数）。
// fileSize 单位为字节，5MB 上限 = 5 * 1024 * 1024 = 5242880 字节，由路由层校验。
// mimeType 记录图片格式（image/jpeg / image/png / image/gif），由路由层白名单校验。
// onDelete: 'cascade' — 笔记删除时，其所有图片元数据随之删除。
export const memoImages = sqliteTable('memo_images', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  memoId: text('memo_id')
    .notNull()
    .references(() => memos.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: text('mime_type').notNull(),
  uploadedAt: text('uploaded_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});
