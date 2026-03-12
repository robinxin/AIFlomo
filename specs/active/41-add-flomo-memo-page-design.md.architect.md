# 技术方案：Flomo 笔记主页面（Issue #41）

> **生成时间**: 2026-03-12
> **来源 Spec**: specs/active/41-add-flomo-memo-page.md
> **阶段**: architect subagent 输出（§1 + §2）

---

## §1 功能概述

### 核心目标

为已登录用户提供一个完整的笔记主页面，覆盖"输入→存储→回看"的完整闭环：快速创建笔记（支持标签、图片、链接）、按时间倒序浏览列表、通过筛选器与标签定位内容、全文搜索、查看统计热力图、软删除至回收站，以及账号登出。

### 系统定位

本功能是整个 AIFlomo 应用的核心业务层，在现有架构基础上新增以下交互维度：

| 维度 | 交互对象 | 说明 |
|------|---------|------|
| 后端路由 | 新增 `apps/server/src/routes/memos.js`、`tags.js`、`attachments.js` | 覆盖笔记 CRUD、标签查询、图片上传 |
| 数据表 | 新增 `memos`、`tags`、`memo_tags`、`attachments` | 见 §2 |
| 已有路由 | `auth.js` 中的 `GET /me`、`POST /logout` | 主页面顶部账号区直接复用 |
| 已有数据表 | `users`（读取 nickname、createdAt 用于统计）、`sessions`（鉴权守卫 requireAuth） | 无需改动 |
| 前端 Context | 新增 `MemoContext`（useReducer 管理笔记列表、筛选状态、搜索词） | 遵循项目 React Context + useReducer 规范 |
| 前端路由 | `app/(tabs)/index.jsx` 或 `app/index.jsx` → 主页面；`app/trash.jsx` → 回收站 | 基于 Expo Router 文件路由 |

### 用户价值

- **低摩擦记录**：输入框默认可见，一次点击即可开始输入，减少记录决策成本
- **即时反馈**：提交后无需刷新，笔记立即出现在列表顶部，统计数字同步更新
- **结构化回看**：标签筛选 + 类型筛选 + 全文搜索三种维度，快速定位历史笔记
- **数据安全**：软删除机制防止误操作，删除内容可通过回收站找回

---

## §2 数据模型变更

### 概述

当前 schema 仅有 `users`、`sessions` 两张表，不含任何笔记相关表。本次需新增四张表：

1. `memos` — 笔记主体
2. `tags` — 标签规范化存储
3. `memo_tags` — 笔记与标签多对多关联
4. `attachments` — 图片附件

---

### 新增表 1：`memos`

```js
export const memos = sqliteTable('memos', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull().default(''),
  hasImage: integer('has_image', { mode: 'boolean' }).notNull().default(false),
  hasLink: integer('has_link', { mode: 'boolean' }).notNull().default(false),
  deletedAt: text('deleted_at').default(null),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});
```

**设计说明**：

- `userId` → `users.id`，`onDelete: 'cascade'`：用户账号删除时笔记联动清除，防止孤儿数据
- `hasImage` / `hasLink`：冗余布尔字段，避免每次筛选时 JOIN `attachments` 或全文扫描 `content`；在写入/更新时由服务层同步维护
- `deletedAt`：软删除时间戳，`null` 表示未删除，非 `null` 表示已进入回收站；所有正常查询加 `WHERE deleted_at IS NULL` 过滤
- `content` 长度由应用层限制 ≤ 10,000 字符（见 CLAUDE.md 安全红线），SQLite `text` 类型本身无长度限制

---

### 新增表 2：`tags`

```js
export const tags = sqliteTable('tags', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});
```

**设计说明**：

- `userId` 范围隔离：标签属于用户私有，不同用户相同标签名彼此独立；`onDelete: 'cascade'` 同上
- `name` 不设全局唯一约束，唯一约束为 `(userId, name)` 组合（在迁移 SQL 中通过 `unique index` 实现，Drizzle 中使用 `uniqueIndex`）
- 标签名合法性（只允许字母、数字、中文、下划线）在服务层写入前校验，不在 schema 层做 CHECK 约束（SQLite CHECK 不支持正则）

---

### 新增表 3：`memo_tags`（多对多关联）

```js
export const memoTags = sqliteTable('memo_tags', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  memoId: text('memo_id')
    .notNull()
    .references(() => memos.id, { onDelete: 'cascade' }),
  tagId: text('tag_id')
    .notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});
```

**设计说明**：

- `memoId` → `memos.id`，`onDelete: 'cascade'`：笔记删除（硬删除或回收站清空）时关联记录自动清除
- `tagId` → `tags.id`，`onDelete: 'cascade'`：标签删除时关联记录自动清除
- `(memoId, tagId)` 组合在迁移时建唯一索引，防止重复关联
- 查询"每个标签的笔记数量"（FR-008）通过 `GROUP BY tag_id COUNT(*)` 在此表上完成，无需扫描全量 memos

---

### 新增表 4：`attachments`

```js
export const attachments = sqliteTable('attachments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  memoId: text('memo_id')
    .notNull()
    .references(() => memos.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull().default('image'),
  url: text('url').notNull(),
  filename: text('filename').notNull().default(''),
  size: integer('size').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});
```

**设计说明**：

- `memoId` → `memos.id`，`onDelete: 'cascade'`：笔记被永久删除时附件记录联动清除；MVP 阶段不做物理文件清理（留给后续 spec）
- `userId` 冗余字段：方便鉴权时直接校验附件归属，无需先查 `memos` 表
- `type` 预留扩展：MVP 阶段仅为 `'image'`，后续可扩展 `'file'`、`'audio'` 等
- `url` 存储文件相对路径或完整 URL；MVP 阶段图片上传至服务器本地 `uploads/` 目录，url 为相对路径，由 Fastify static plugin 提供访问
- `size` 单位为字节，用于后续存储配额控制

---

### 数据关系总览

```
users
  ├── memos        (1:N, userId → users.id)
  ├── tags         (1:N, userId → users.id)
  └── attachments  (1:N, userId → users.id)

memos
  ├── memo_tags    (1:N, memoId → memos.id)
  └── attachments  (1:N, memoId → memos.id)

tags
  └── memo_tags    (1:N, tagId → tags.id)
```

---

### 统计查询说明（无额外表，通过聚合实现）

FR-012（全部笔记数、有标签笔记数、使用天数）和 FR-013（热力图）均通过对 `memos` 表的聚合查询实现，无需新增统计表：

| 统计指标 | 查询来源 |
|---------|---------|
| 全部笔记数 | `COUNT(*) FROM memos WHERE user_id=? AND deleted_at IS NULL` |
| 有标签笔记数 | `COUNT(DISTINCT memo_id) FROM memo_tags JOIN memos WHERE user_id=? AND deleted_at IS NULL` |
| 使用天数 | `COUNT(DISTINCT DATE(created_at)) FROM memos WHERE user_id=? AND deleted_at IS NULL` |
| 热力图（近90天每日数量） | `COUNT(*) GROUP BY DATE(created_at) FROM memos WHERE user_id=? AND created_at >= date('now','-90 days') AND deleted_at IS NULL` |
| 回收站数量 | `COUNT(*) FROM memos WHERE user_id=? AND deleted_at IS NOT NULL` |
