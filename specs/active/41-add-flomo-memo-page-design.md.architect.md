# 技术方案文档 — Flomo 笔记页面（Issue #41）

> 生成日期: 2026-03-11
> 负责角色: architect subagent
> 对应 Spec: specs/active/41-add-flomo-memo-page.md

---

## §1 功能概述

### 核心目标

打通"输入 → 存储 → 回看"全闭环：实现 Flomo 风格的笔记主页,支持快速创建笔记（含标签自动解析、图片/链接附件）、多维筛选浏览（类型筛选 + 标签树）、全文搜索、软删除与回收站、用户统计热力图、以及 Pro 功能占位引导。

### 系统定位

本次功能构成整个 MVP 的核心主路径，是用户登录后的默认落地页（路由 `/memo`）。涉及以下新增系统交互：

| 维度 | 说明 |
|------|------|
| 后端路由 | 新增 `apps/server/src/routes/memos.js`、`tags.js`、`stats.js`、`auth.js` 全量实现 |
| 数据表 | 新增 `users`、`memos`、`tags`、`memo_tags`、`attachments` 五张表（从零构建） |
| 前端路由 | 新增 `app/(app)/memo/index.jsx`（主列表）、`app/(app)/memo/trash.jsx`（回收站）、`app/(app)/memo/search.jsx`（搜索）、`app/(auth)/login.jsx`、`app/(auth)/register.jsx` |
| Context | 新增 `AuthContext.jsx`（用户会话）、`MemoContext.jsx`（笔记列表、筛选状态） |
| API client | `lib/api-client.js`（统一 fetch 封装，携带 Session Cookie） |

现有已有文件：仅 E2E 测试文件（`apps/tests/*.spec.js`）。后端 `apps/server/src/` 和前端 `apps/mobile/` 目录均为空，属于全量新建。

### 用户价值

| 问题 | 解决方案 |
|------|---------|
| 无法快速记录想法 | 主页顶部输入框，支持一键发送，`#标签名` 自动解析 |
| 笔记多了难以定位 | 左侧筛选面板（类型 + 标签树），按维度秒级过滤 |
| 误删笔记无法找回 | 软删除 + 回收站，30 天内可恢复 |
| 不清楚自己记录了多少 | 统计区（总数 / 有标签数 / 使用天数）+ 热力图直观展示 |
| 关键词找笔记慢 | 全文搜索（`LIKE` 模糊匹配），300ms 防抖，1 秒内返回 |

---

## §2 数据模型变更

本次为全量新建，无任何现有表需要修改。以下是完整 Drizzle schema，可直接写入 `apps/server/src/db/schema.js`。

### 2.1 完整 Schema 代码

```js
// apps/server/src/db/schema.js
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─────────────────────────────────────────
// users — 用户表
// ─────────────────────────────────────────
export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  nickname: text('nickname').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

// ─────────────────────────────────────────
// memos — 笔记表（含软删除字段）
// ─────────────────────────────────────────
export const memos = sqliteTable('memos', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  content: text('content').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  // 类型标志位（0 = 无，1 = 有）
  hasImage: integer('has_image').notNull().default(0),
  hasLink: integer('has_link').notNull().default(0),
  // 软删除：null 表示正常，非 null 表示已删除（进入回收站）
  deletedAt: text('deleted_at').default(null),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

// ─────────────────────────────────────────
// tags — 标签表（每个用户的标签独立）
// ─────────────────────────────────────────
export const tags = sqliteTable('tags', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

// ─────────────────────────────────────────
// memo_tags — 笔记与标签的多对多关联表
// ─────────────────────────────────────────
export const memoTags = sqliteTable('memo_tags', {
  memoId: text('memo_id')
    .notNull()
    .references(() => memos.id, { onDelete: 'cascade' }),
  tagId: text('tag_id')
    .notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
});

// ─────────────────────────────────────────
// attachments — 笔记附件表（图片文件元数据）
// ─────────────────────────────────────────
export const attachments = sqliteTable('attachments', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  memoId: text('memo_id')
    .notNull()
    .references(() => memos.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),       // 文件存储路径（服务器本地路径或 URL）
  mimeType: text('mime_type').notNull(), // image/jpeg, image/png, image/gif
  sizeBytes: integer('size_bytes').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});
```

### 2.2 字段设计说明

#### users 表

| 字段 | 类型 | 说明 |
|------|------|------|
| `nickname` | `text NOT NULL` | 新增字段（相比代码规范示例）。E2E 测试中注册接口返回 `nickname`，登录后页面显示昵称（`data-testid="user-nickname"`），`/api/auth/register` 接受 `nickname` 参数。 |

#### memos 表

| 字段 | 类型 | 说明 |
|------|------|------|
| `hasImage` | `integer DEFAULT 0` | 布尔标志位，用整型存储（SQLite 无原生 boolean）。创建笔记时若含附件则置 1。E2E 测试断言 `memo.hasImage === 1`（`/api/memos?type=image`）。 |
| `hasLink` | `integer DEFAULT 0` | 同上。后端解析 content 中的 URL（正则匹配 `https?://`）时置 1。 |
| `deletedAt` | `text DEFAULT NULL` | 软删除时间戳。`DELETE /api/memos/:id` 仅更新此字段为当前时间（不物理删除）。E2E 测试断言回收站列表中每条 memo 的 `deletedAt` 不为 null。30 天过期后可由定时任务物理清除（MVP 阶段可手动处理）。 |
| `userId` `.references(() => users.id, { onDelete: 'cascade' })` | — | 用户删除时级联删除所有笔记，防止孤儿数据。 |

#### tags 表

- `name` + `userId` 应在业务层保证唯一（创建笔记时，若标签名已存在则复用，不插入重复行）。未在 schema 层加联合唯一索引，以简化 MVP 实现；若并发量大可后续迁移添加。
- `userId` 使用 `onDelete: 'cascade'`：用户注销时标签随之清除，防止孤儿标签。

#### memo_tags 表

- `memoId` 和 `tagId` 均使用 `onDelete: 'cascade'`：
  - 笔记软删除后进入回收站，`memo_tags` 记录保留（恢复时仍能还原标签关联）。
  - 笔记永久删除（`DELETE /api/memos/:id/permanent`）时，物理删除 memo 行，`memo_tags` 由级联自动清理。
  - 若某 tag 因所有关联 memo 被永久删除而成为孤儿标签，由 `GET /api/tags` 的 count 查询过滤掉（`count = 0` 时不返回或由前端过滤），保持标签树整洁。

#### attachments 表

- 独立存储图片元数据，与 memos 一对多关联。
- `onDelete: 'cascade'`：永久删除 memo 时附件元数据自动清除（物理文件由服务层同步删除）。
- `memoId` + `sizeBytes` 分离存储：后端接收 `multipart/form-data` 上传后，将文件写入服务器本地磁盘（`data/uploads/`），将路径写入 `url` 字段，并将 `memos.hasImage` 置 1。
- MVP 阶段图片以本地文件系统存储；`url` 字段设计为字符串，后续可无缝切换为 CDN URL，不需要迁移。

### 2.3 不需要独立的 Trash 表

回收站的数据实体（Spec 中称"回收站条目"）直接通过 `memos.deletedAt IS NOT NULL` 查询实现，无需新增独立表。E2E 测试中 `GET /api/memos/trash` 返回的每条记录包含 `deletedAt` 字段，`POST /api/memos/:id/restore` 将该字段重置为 `null`。这一设计：

- 减少表数量，降低 join 复杂度
- 恢复操作简单（单字段更新，无需跨表数据迁移）
- 统计 `trashCount`（`/api/stats` 响应字段）直接通过 `count(*)` where `deletedAt IS NOT NULL` 计算

### 2.4 统计数据（User Stats）

E2E 测试期望 `GET /api/stats` 返回：

```js
{
  data: {
    totalMemos: number,      // 正常笔记总数（deletedAt IS NULL）
    taggedMemos: number,     // 有标签的正常笔记数
    usageDays: number,       // 首条笔记 createdAt 到今天的天数差（含今天为 1 天）
    trashCount: number,      // 回收站笔记数（deletedAt IS NOT NULL）
    heatmap: [               // 最近 90 天每日笔记分布
      { day: 'YYYY-MM-DD', count: number },
      ...
    ]
  },
  message: 'ok'
}
```

这些字段均通过对 `memos` 表的聚合查询计算得出，不需要单独的统计表。`usageDays` 计算逻辑：取该用户最早一条笔记（`deletedAt IS NULL OR deletedAt IS NOT NULL` 均计入，含已删除）的 `createdAt`，与当日日期差 + 1。
