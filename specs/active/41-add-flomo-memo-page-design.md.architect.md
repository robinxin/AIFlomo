# 技术方案设计 — Flomo 笔记页面 (#41)

**生成时间**: 2026-03-10
**Spec 来源**: `specs/active/41-add-flomo-memo-page.md`
**设计范围**: §1 功能概述 + §2 数据模型
**注意**: `apps/server` 和 `apps/mobile` 目录尚未创建，以下为从零开始的设计

---

## §1 功能概述

### 核心目标

构建 AIFlomo 的核心笔记页面，实现「输入 → 存储 → 回看」全闭环：用户可快速创建带标签和附件的笔记，并通过标签/类型筛选、全文搜索、回收站和统计热力图管理所有笔记记录。

### 系统定位

本功能是整个 AIFlomo 应用的**主功能模块**,在空白代码库中从零建立核心数据层和业务层：

| 层级 | 新建内容 | 交互关系 |
|------|---------|---------|
| 后端路由 | `/api/memos`、`/api/tags`、`/api/auth`、`/api/stats` | 彼此通过 `userId`（Session）关联 |
| 数据表 | `users`、`memos`、`tags`、`memo_tags`、`memo_attachments`、`sessions` | `memos` 是核心，其余围绕它展开 |
| 前端路由 | `app/(app)/memo/index.jsx`（笔记列表主页） | 依赖 `AuthContext`（Session）和 `MemoContext`（状态） |
| 前端 Context | `MemoContext`（笔记列表、筛选、搜索状态） | 与 `AuthContext` 并列挂在根布局 |

**关键交互链**：

```
用户创建笔记
  → POST /api/memos (content + tags + attachments)
  → 后端解析 #标签名，写入 memos + tags + memo_tags + memo_attachments
  → 返回完整 memo 对象
  → MemoContext dispatch ADD_MEMO → 列表顶部插入
  → 统计数字和热力图实时更新（前端重新拉取 /api/stats）
```

### 用户价值

| 用户痛点 | 本功能解决方案 |
|---------|--------------|
| 记录摩擦高，找不到合适分类工具 | 输入框常驻顶部，`#标签名` 自动识别，零额外操作 |
| 笔记越来越多，难以快速定位 | 左侧栏标签树 + 类型筛选（有图片/有链接），数量实时显示 |
| 误删数据无法恢复 | 软删除进回收站，30天内可一键恢复 |
| 不知道自己的使用习惯 | 热力图 + 统计（总数/有标签数/使用天数）直观呈现 |

---

## §2 数据模型变更

### 2.1 设计决策说明

**软删除（Soft Delete）而非独立回收站表**

`memos` 表增加 `deletedAt` 可空字段：`NULL` 表示正常状态，有时间戳表示已进回收站。

- 优点：查询简单（无需 JOIN），恢复只需将 `deletedAt` 置 `NULL`，永久删除执行物理 `DELETE`
- 对比：独立 `trash` 表需要数据搬移，增加事务复杂度

**附件独立表（`memo_attachments`）而非 memos 内嵌字段**

每条笔记可有多张图片和多个链接，独立表支持一对多关系。`memos` 表仅保留 `hasImage` 和 `hasLink` 两个布尔标志，用于**类型筛选的快速查询**（FR-001），避免每次筛选都做 JOIN 聚合。

- `hasImage` / `hasLink` 在写入/删除附件时由应用层同步维护（非数据库触发器，保持纯 Drizzle 操作）

**标签唯一性约束在 `(name, userId)` 联合索引**

同一用户不能有重名标签；不同用户的同名标签互相独立。

**用户统计（User Stats）不单独建表**

总笔记数、有标签笔记数、使用天数、每日笔记分布均为可实时计算的聚合查询结果，无需持久化，保证 SC-008（实时一致性）要求。

**`sessions` 表由 SQLite session store 管理**

`@fastify/session` 配合 SQLite store 需要一张 `sessions` 表，schema 中声明但内容由库自动维护。

### 2.2 完整 Schema

```js
// apps/server/src/db/schema.js
import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── users ───────────────────────────────────────────────────────────────────
// 基础用户表。nickname 用于 FR-008（页面展示当前登录昵称）。
export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  email: text('email').notNull().unique(),

  // 显示名称，用于页面右上角昵称展示（FR-008）
  nickname: text('nickname').notNull().default(''),

  passwordHash: text('password_hash').notNull(),

  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
});

// ─── memos ────────────────────────────────────────────────────────────────────
// 核心笔记表。
// deletedAt: 软删除字段——NULL 为正常笔记，非 NULL 为回收站笔记（FR-005/FR-006）。
// hasImage / hasLink: 类型标志位，用于快速筛选（FR-001/FR-012），
//   由应用层在写入/删除 memo_attachments 时同步更新，避免频繁 JOIN 查询。
export const memos = sqliteTable('memos', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // 笔记正文，最大 10,000 字符（CLAUDE.md 安全红线）
  content: text('content').notNull(),

  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  // onDelete: 'cascade'：用户账号注销时级联删除其所有笔记

  // 类型标志位（0/1）——冗余字段，用于 O(1) 类型筛选（FR-001）
  hasImage: integer('has_image').notNull().default(0),
  hasLink: integer('has_link').notNull().default(0),

  // 软删除时间戳（NULL = 正常；非 NULL = 已进回收站）（FR-005）
  deletedAt: text('deleted_at').default(null),

  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),

  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
});

// ─── tags ─────────────────────────────────────────────────────────────────────
// 标签表。每个用户的标签名称唯一（联合唯一索引），不同用户标签互不干扰。
// 标签名长度 ≤ 20 字符，仅含中英文/数字/下划线（由应用层校验，Spec 假设清单）。
export const tags = sqliteTable(
  'tags',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // 标签显示名称（不含 # 前缀，存储时去掉 # 符号）
    name: text('name').notNull(),

    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // onDelete: 'cascade'：用户注销时级联删除其所有标签

    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
  },
  (table) => ({
    // 同一用户下标签名唯一（FR-002：标签旁显示数量，依赖标签唯一性）
    nameUserUnique: uniqueIndex('tags_name_user_idx').on(table.name, table.userId),
  })
);

// ─── memo_tags ────────────────────────────────────────────────────────────────
// 笔记-标签多对多关联表。
// 两端均设置 onDelete: 'cascade'：
//   - 笔记删除（物理删除）时，关联行自动清除
//   - 标签删除时，关联行自动清除
// 软删除的笔记（deletedAt 非 NULL）保留 memo_tags 行，
//   以便恢复时标签关系完整恢复。
export const memoTags = sqliteTable('memo_tags', {
  memoId: text('memo_id')
    .notNull()
    .references(() => memos.id, { onDelete: 'cascade' }),

  tagId: text('tag_id')
    .notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
});

// ─── memo_attachments ─────────────────────────────────────────────────────────
// 笔记附件表：存储图片和链接（FR-003/FR-012）。
// 一条笔记可有多个附件，每行一个。
// type: 'image' | 'link'
//   - 'image'：用户上传的图片，url 为服务器存储路径或 CDN 地址
//   - 'link' ：用户粘贴的 URL，url 为原始链接地址
// 写入/删除附件时，应用层同步更新 memos.hasImage / memos.hasLink 标志位。
export const memoAttachments = sqliteTable('memo_attachments', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  memoId: text('memo_id')
    .notNull()
    .references(() => memos.id, { onDelete: 'cascade' }),
  // onDelete: 'cascade'：笔记物理删除时附件记录自动清除

  // 'image' 或 'link'
  type: text('type').notNull(),

  // 图片：服务器路径（如 /uploads/uuid.jpg）；链接：原始 URL
  url: text('url').notNull(),

  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
});

// ─── sessions ─────────────────────────────────────────────────────────────────
// Session 持久化表，供 @fastify/session 的 SQLite store 使用。
// 字段结构由 connect-sqlite3 / better-sqlite3-session-store 等库自动维护，
// 此处声明是为了让 Drizzle 迁移系统感知该表的存在，避免迁移冲突。
export const sessions = sqliteTable('sessions', {
  sid: text('sid').primaryKey(),
  sess: text('sess').notNull(),
  expired: text('expired').notNull(),
});
```

### 2.3 实体关系图（文本表示）

```
users (1) ──────────────────────── (*) memos
  │                                      │
  │                                      ├── (*) memo_tags ── (*) tags ── (1) users
  │                                      │
  │                                      └── (*) memo_attachments
  │
  └── (*) sessions
```

### 2.4 字段设计细节说明

| 表 | 字段 | 设计理由 |
|----|------|---------|
| `users` | `nickname` | FR-008 要求展示当前登录昵称，注册时由用户填写或从 email 前缀自动生成 |
| `memos` | `hasImage` (integer 0/1) | SQLite 无 boolean 类型，用 integer 代替；快速 `WHERE has_image = 1` 筛选，避免每次 JOIN `memo_attachments` |
| `memos` | `hasLink` (integer 0/1) | 同上，对应「有链接」筛选条件 |
| `memos` | `deletedAt` (text, nullable) | 软删除：NULL = 活跃，非 NULL = 回收站。回收站 30 天后清除由定时任务或查询时判断（Spec 假设清单） |
| `tags` | `uniqueIndex(name, userId)` | 防止同用户重复标签；应用层遇到已存在标签时复用而非新建 |
| `memo_tags` | 无独立 PK | 联合 `(memoId, tagId)` 语义上唯一，但 Drizzle SQLite 层通过应用逻辑防重；若需严格唯一可在后续迭代加复合唯一索引 |
| `memo_attachments` | `type` text | 扩展性：将来可加 'voice'（当前 Spec 假设语音功能暂不实现，UI 入口仅展示占位提示） |
| `sessions` | `sid/sess/expired` | `@fastify/session` SQLite store 标准字段结构 |

### 2.5 用户统计数据的查询策略（无独立统计表）

FR-007/FR-008 要求的统计数据均为**实时聚合查询**，不持久化：

```
全部笔记数    → SELECT COUNT(*) FROM memos WHERE user_id = ? AND deleted_at IS NULL
有标签笔记数  → SELECT COUNT(DISTINCT memo_id) FROM memo_tags
                  JOIN memos ON memos.id = memo_tags.memo_id
                  WHERE memos.user_id = ? AND memos.deleted_at IS NULL
使用天数      → SELECT COUNT(DISTINCT date(created_at)) FROM memos
                  WHERE user_id = ? AND deleted_at IS NULL
回收站数量    → SELECT COUNT(*) FROM memos WHERE user_id = ? AND deleted_at IS NOT NULL
热力图数据    → SELECT date(created_at) as day, COUNT(*) as count FROM memos
                  WHERE user_id = ? AND deleted_at IS NULL
                    AND created_at >= date('now', '-90 days')
                  GROUP BY day ORDER BY day
```

以上查询均通过 Drizzle ORM 参数化表达式实现，禁止原生 SQL 字符串拼接（CONSTITUTION.md 绝对禁止项）。
