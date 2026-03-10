# 技术方案：Flomo 笔记页面

**关联 Spec**: specs/active/41-add-flomo-memo-page.md
**生成日期**: 2026-03-10

---

## §1 功能概述

### 核心目标

构建 AIFlomo 的核心笔记页面，实现「输入 → 存储 → 回看」全闭环：用户可快速创建带标签和附件的笔记，并通过标签/类型筛选、全文搜索、回收站和统计热力图管理所有笔记记录。

### 系统定位

本功能是整个 AIFlomo 应用的**主功能模块**，在空白代码库中从零建立核心数据层和业务层：

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

---

## §3 API 端点设计

### 3.1 路由文件清单

| 文件路径 | 前缀 | 资源 |
|---------|------|------|
| `apps/server/src/routes/auth.js` | `/api/auth` | 认证（注册/登录/登出/当前用户） |
| `apps/server/src/routes/memos.js` | `/api/memos` | 笔记 CRUD、搜索、回收站操作 |
| `apps/server/src/routes/tags.js` | `/api/tags` | 标签列表（含笔记计数） |
| `apps/server/src/routes/stats.js` | `/api/stats` | 统计数据与热力图 |

所有路由通过 `apps/server/src/index.js` 注册，统一 `/api` 前缀：

```js
await app.register(authRoutes,  { prefix: '/api/auth' });
await app.register(memoRoutes,  { prefix: '/api/memos' });
await app.register(tagRoutes,   { prefix: '/api/tags' });
await app.register(statsRoutes, { prefix: '/api/stats' });
```

### 3.2 端点汇总表

| 方法 | 路径 | 鉴权 | 功能描述 | 对应 FR |
|------|------|------|---------|--------|
| POST | `/api/auth/register` | 无 | 注册新用户 | — |
| POST | `/api/auth/login` | 无 | 用户登录 | FR-009 |
| POST | `/api/auth/logout` | 是 | 用户登出 | FR-009 |
| GET | `/api/auth/me` | 是 | 获取当前用户信息 | FR-008 |
| GET | `/api/memos` | 是 | 获取笔记列表（支持筛选/搜索/分页） | FR-001/FR-002/FR-004/FR-013 |
| POST | `/api/memos` | 是 | 创建笔记（含标签解析、附件处理） | FR-003/FR-011/FR-012 |
| PUT | `/api/memos/:id` | 是 | 更新笔记 | FR-003/FR-011/FR-012 |
| DELETE | `/api/memos/:id` | 是 | 软删除笔记（移入回收站） | FR-005/FR-006 |
| GET | `/api/memos/trash` | 是 | 获取回收站列表 | FR-005/FR-006 |
| POST | `/api/memos/:id/restore` | 是 | 从回收站恢复笔记 | FR-005 |
| DELETE | `/api/memos/:id/permanent` | 是 | 永久删除笔记（物理删除） | FR-005 |
| GET | `/api/tags` | 是 | 获取标签列表（含笔记计数） | FR-002 |
| GET | `/api/stats` | 是 | 获取统计数据与热力图 | FR-007/FR-008 |

详细的请求/响应格式、JSON Schema 验证、失败响应清单见临时文件 `specs/active/41-add-flomo-memo-page-design.md.backend.md`（已生成，可查阅）。

### 3.3 安全实现要点

| 要点 | 实现方式 |
|------|---------|
| 禁止 SQL 字符串拼接 | 所有查询使用 Drizzle ORM 参数化表达式（`eq`、`like`、`and`、`isNull` 等） |
| 用户隔离 | 所有查询必须携带 `eq(memos.userId, userId)`，`userId` 来自 `request.session.userId` |
| 输入长度限制 | `content maxLength: 10000`（CLAUDE.md 安全红线） |
| 笔记权限校验 | PUT/DELETE/restore/permanent 操作前先查询笔记确认 `userId` 匹配，不匹配则 `throw new ForbiddenError()` |
| Session Cookie | `httpOnly: true`、`sameSite: 'strict'`、生产环境 `secure: true`（由 `plugins/session.js` 统一配置） |
| 标签注入防护 | 标签名从正文正则解析后，通过 Drizzle 参数化 `insert`/`select` 操作，禁止字符串拼接进 SQL |

---

## §4 前端页面与组件

### 4.1 路由页面结构（Screens）

```
apps/mobile/app/
├── _layout.jsx                     # 根布局：挂载 AuthProvider + MemoProvider
├── index.jsx                       # / — 重定向入口（已登录 → /memo，未登录 → /login）
├── (auth)/
│   ├── _layout.jsx                 # 认证组路由布局（Stack，无顶栏）
│   ├── login.jsx                   # /login — 登录页
│   └── register.jsx                # /register — 注册页
└── (app)/
    ├── _layout.jsx                 # 主应用布局（Tabs：记录 / 搜索 / 我的）
    └── memo/
        ├── index.jsx               # /memo — 笔记主页（列表 + 侧边筛选 + 输入框）
        ├── search.jsx              # /memo/search — 全文搜索结果页
        └── trash.jsx               # /memo/trash — 回收站页
```

### 4.2 需要新增的组件（14 个）

所有组件位于 `apps/mobile/components/`，具名 `export`，文件名 PascalCase + `.jsx`。

| 组件 | 职责 |
|------|------|
| `AuthForm.jsx` | 登录/注册表单通用组件 |
| `MemoInput.jsx` | 常驻顶部笔记输入区（支持文本、图片、链接） |
| `AttachmentPreview.jsx` | 附件预览行（缩略图 + 删除） |
| `MemoList.jsx` | 笔记列表渲染（FlatList） |
| `MemoCard.jsx` | 单条笔记卡片（内容、标签、操作菜单） |
| `TrashMemoCard.jsx` | 回收站笔记卡片（恢复/永久删除） |
| `SidebarFilter.jsx` | 左侧筛选面板（类型 + 标签树） |
| `TagList.jsx` | 标签树列表 |
| `StatsBar.jsx` | 用户统计信息条 |
| `Heatmap.jsx` | 热力图网格（最近 90 天） |
| `SearchBar.jsx` | 搜索输入框（防抖 300ms） |
| `EmptyState.jsx` | 空状态占位 |
| `ConfirmDialog.jsx` | 确认对话框 |
| `ProUpgradeModal.jsx` | Pro 会员购买引导浮窗 |

### 4.3 Context / Reducer 变更

#### `context/AuthContext.jsx`（新建）

**initialState**:
```js
{
  user: null,           // { id, email, nickname } | null
  isLoading: true,      // 初始化时检查 Session
  isAuthenticated: false,
}
```

**Action Types**: `AUTH_INIT`、`AUTH_INIT_DONE`、`LOGIN_SUCCESS`、`LOGOUT`

#### `context/MemoContext.jsx`（新建）

**initialState**:
```js
{
  memos: [],              // 当前筛选结果（正常笔记）
  isLoading: false,
  error: null,
  filter: { type: 'all', tagId: null },
  searchQuery: '',
  searchResults: [],
  isSearching: false,
  stats: null,
  heatmapData: [],
  tags: [],
  trashMemos: [],
  trashCount: 0,
}
```

**Action Types（15 个）**: `FETCH_MEMOS_START`、`FETCH_MEMOS_SUCCESS`、`FETCH_MEMOS_ERROR`、`ADD_MEMO`、`DELETE_MEMO`、`SET_FILTER`、`FETCH_TAGS_SUCCESS`、`FETCH_STATS_SUCCESS`、`FETCH_HEATMAP_SUCCESS`、`SEARCH_START`、`SEARCH_SUCCESS`、`SEARCH_CLEAR`、`FETCH_TRASH_SUCCESS`、`RESTORE_MEMO`、`PERMANENT_DELETE_MEMO`

### 4.4 自定义 Hook（6 个）

| Hook | 职责 |
|------|------|
| `use-auth.js` | 封装 login/logout/register/checkSession |
| `use-memos.js` | 笔记列表 CRUD、筛选 |
| `use-tags.js` | 标签列表（含计数） |
| `use-stats.js` | 统计与热力图 |
| `use-search.js` | 搜索（防抖） |
| `use-trash.js` | 回收站操作 |

### 4.5 调用的 API 端点（与 §3 一致性校对）

前端设计推断的 API 路径与后端设计**完全一致**，无需备注差异：

- `/api/auth/*` — 认证接口
- `/api/memos` — 笔记 CRUD
- `/api/memos/trash` — 回收站列表
- `/api/memos/:id/restore` — 恢复笔记
- `/api/memos/:id/permanent` — 永久删除
- `/api/tags` — 标签列表
- `/api/stats` — 统计数据

**注意**：前端设计中曾提到 `/api/memos/search?q=<keyword>`，但后端设计使用 `GET /api/memos?q=<keyword>`（搜索合并在列表端点的查询参数中），最终**以后端设计为准**，前端实现时调用 `GET /api/memos?q=<keyword>` 而非单独的 `/search` 路径。

### 4.6 安全约定（前端层面）

- **纯文本渲染**: 所有用户内容通过 React Native `<Text>` 组件渲染，不使用 `dangerouslySetInnerHTML`，自动防 XSS
- **输入长度校验**: `MemoInput` 提交前检查 `content.length <= 10000`，标签数量 `<= 10`
- **图片大小**: 选择图片后检查文件大小 `<= 5MB`，超限提示用户
- **Session Cookie**: 所有 API 请求带 `credentials: 'include'`（`api-client.js` 统一处理）
- **环境变量**: API Base URL 使用 `EXPO_PUBLIC_API_URL`（不硬编码端口/地址）

---

## §5 改动文件清单

### 新增文件

#### 后端（apps/server/）

```
apps/server/
├── src/
│   ├── index.js                        — Fastify 应用入口（注册插件和路由）
│   ├── plugins/
│   │   ├── session.js                  — @fastify/session 配置（SQLite store）
│   │   ├── cors.js                     — @fastify/cors 配置
│   │   └── auth.js                     — requireAuth preHandler
│   ├── routes/
│   │   ├── auth.js                     — POST /register, /login, /logout, GET /me
│   │   ├── memos.js                    — 笔记 CRUD + 回收站操作（13 个端点）
│   │   ├── tags.js                     — GET /tags（含笔记计数）
│   │   └── stats.js                    — GET /stats（统计与热力图）
│   ├── db/
│   │   ├── schema.js                   — Drizzle 表定义（6 张表：users/memos/tags/memo_tags/memo_attachments/sessions）
│   │   ├── index.js                    — Drizzle 实例导出
│   │   └── migrations/                 — 自动生成迁移文件（git 跟踪）
│   └── lib/
│       ├── errors.js                   — AppError/NotFoundError/ForbiddenError 类
│       └── password.js                 — bcrypt 密码哈希工具
├── drizzle.config.js                   — Drizzle Kit 配置
└── package.json                        — 依赖：fastify、drizzle-orm、better-sqlite3、@fastify/session、@fastify/cors、@fastify/cookie
```

#### 前端（apps/mobile/）

```
apps/mobile/
├── app/
│   ├── _layout.jsx                     — 根布局（挂载 AuthProvider + MemoProvider）
│   ├── index.jsx                       — 重定向入口（/ → /memo 或 /login）
│   ├── (auth)/
│   │   ├── _layout.jsx                 — 认证组布局（Stack）
│   │   ├── login.jsx                   — 登录页
│   │   └── register.jsx                — 注册页
│   └── (app)/
│       ├── _layout.jsx                 — 主应用 Tab 布局
│       └── memo/
│           ├── index.jsx               — 笔记主页（P1 核心）
│           ├── search.jsx              — 搜索页（P2）
│           └── trash.jsx               — 回收站页（P2）
├── components/
│   ├── AuthForm.jsx                    — 登录/注册表单
│   ├── MemoInput.jsx                   — 常驻顶部输入区
│   ├── AttachmentPreview.jsx          — 附件预览行
│   ├── MemoList.jsx                    — 笔记列表（FlatList）
│   ├── MemoCard.jsx                    — 笔记卡片
│   ├── TrashMemoCard.jsx               — 回收站卡片
│   ├── SidebarFilter.jsx               — 筛选侧边栏
│   ├── TagList.jsx                     — 标签树
│   ├── StatsBar.jsx                    — 统计信息条
│   ├── Heatmap.jsx                     — 热力图网格
│   ├── SearchBar.jsx                   — 搜索输入框
│   ├── EmptyState.jsx                  — 空状态占位
│   ├── ConfirmDialog.jsx               — 确认对话框
│   └── ProUpgradeModal.jsx             — Pro 购买引导浮窗
├── context/
│   ├── AuthContext.jsx                 — 认证 Context（4 action types）
│   └── MemoContext.jsx                 — 笔记 Context（15 action types）
├── hooks/
│   ├── use-auth.js                     — 认证操作封装
│   ├── use-memos.js                    — 笔记 CRUD 封装
│   ├── use-tags.js                     — 标签列表
│   ├── use-stats.js                    — 统计与热力图
│   ├── use-search.js                   — 搜索（防抖）
│   └── use-trash.js                    — 回收站操作
├── lib/
│   └── api-client.js                   — API 请求封装（fetch + credentials）
└── package.json                        — 依赖：expo、expo-router、react-native、expo-image-picker
```

### 修改文件

**无修改文件** — 本次为全新功能，在空白代码库中从零构建，无需修改已有代码。

---

## §6 技术约束与风险

### 6.1 输入校验

| 字段 | 前端校验 | 后端校验（JSON Schema） | 理由 |
|------|---------|----------------------|------|
| `content` | 长度 ≤ 10,000 字符 | `minLength: 1, maxLength: 10000` | 防止超长内容占用存储，保证 UI 性能 |
| `email` | 格式校验（正则） | `format: 'email', maxLength: 255` | 防止无效邮箱注册 |
| `password` | 长度 ≥ 8 | `minLength: 8, maxLength: 128` | 密码强度基线 |
| `nickname` | 长度 1-50 | `minLength: 1, maxLength: 50` | 昵称显示限制 |
| `attachments` | 图片 ≤ 5MB，数量 ≤ 20 | `maxItems: 20`，图片大小由 multipart 插件控制 | 防止资源滥用 |
| 标签数量 | 每条笔记 ≤ 10 个 | 后端解析后检查，超过抛 `TOO_MANY_TAGS` | 防止标签爆炸，保证 UI 可读性 |
| 标签名称 | — | 仅中英文/数字/下划线，长度 ≤ 20（应用层正则校验） | 防止特殊字符破坏 UI |

### 6.2 安全

| 风险点 | 防护措施 |
|--------|---------|
| XSS 攻击 | 前端纯文本渲染（React Native `<Text>`），禁止 `dangerouslySetInnerHTML`；后端不做 HTML 处理 |
| SQL 注入 | 所有查询使用 Drizzle ORM 参数化表达式，禁止原生 SQL 字符串拼接（CONSTITUTION 绝对禁止项） |
| 权限绕过 | 所有 `/api/memos/*` 路由加 `preHandler: [requireAuth]`；操作前校验 `memo.userId === session.userId` |
| Session 劫持 | Cookie `httpOnly: true`（防 JS 读取）、`sameSite: 'strict'`（防 CSRF）、生产环境 `secure: true`（HTTPS） |
| 标签注入 | 标签从正文正则提取后，通过 Drizzle 参数化写入，不拼接 SQL |
| 密码泄露 | 使用 bcrypt 哈希（最少 10 轮盐），明文密码不存储 |

### 6.3 性能

| 潜在瓶颈 | 解决方案 |
|---------|---------|
| N+1 查询 | `GET /api/memos` 时一次性 JOIN `tags` 和 `attachments`，避免逐条查询；或使用 Drizzle `.with()` 关联查询 |
| 热力图聚合慢 | 限定最近 90 天（Spec 假设），索引 `created_at` 列 |
| 标签计数慢 | `GET /api/tags` 使用 GROUP BY + JOIN，若标签数超过 1000 条考虑缓存或分页 |
| 搜索全文扫描 | SQLite `LIKE '%keyword%'` 无索引；当笔记数超过 10,000 条时考虑 FTS5 全文索引（后续优化） |
| 分页缺失 | `GET /api/memos` 当前支持 `?page=N&limit=M`，边界场景「搜索结果超过 100 条时分页显示」已覆盖 |

### 6.4 兼容性

| 风险点 | 应对措施 |
|--------|---------|
| SQLite 无 boolean 类型 | 使用 `integer (0/1)` 代替，Drizzle schema 中明确声明 |
| Expo Router 版本 | 依赖 Expo SDK 52+，文件路由约定参考当前稳定版 |
| React Native 平台差异 | 阴影样式使用 `Platform.select`，文件选择器依赖 `expo-image-picker`（Expo 官方库，跨平台兼容） |
| Session store 库选择 | 使用 `better-sqlite3-session-store` 或 `connect-sqlite3`（需确认 Fastify 兼容性） |

---

## §7 不包含（范围边界）

本次设计**不包含**以下功能，防止实现阶段范围蔓延：

1. **笔记编辑功能（PUT /api/memos/:id）已设计但不在 P1 实现** — P1 仅实现创建和删除，编辑功能留待 P2 迭代
2. **微信输入、每日回顾、AI 洞察、随机漫步功能** — P3 功能，当前仅展示「购买 Pro 会员」占位浮窗，不实现实际业务逻辑
3. **图片上传存储** — 本次设计中 `attachments.url` 字段保留，但实际上传图片到服务器/CDN 的功能暂不实现；前端选择图片后暂存本地 URI，创建笔记时仅记录 URL 占位（后续补充上传逻辑）
4. **语音笔记功能** — Spec 中标注「有语音」类型暂不实现，UI 入口仅展示「功能开发中」提示
5. **笔记导出功能** — 不提供导出为 Markdown/PDF/TXT 的功能
6. **多设备同步冲突解决** — 本次仅支持 Session 认证，不实现离线编辑的冲突合并（推断：离线状态下创建的笔记会在网络恢复后自动同步，但不处理编辑冲突）
7. **Pro 会员购买流程** — 「立即购买」按钮当前跳转到占位页，不接入支付网关
8. **回收站自动清理** — Spec 假设「回收站笔记 30 天后自动删除」，当前不实现定时任务，仅在查询时过滤（或后续通过 cron job 补充）
9. **笔记分享功能** — 不支持生成分享链接或导出到其他平台
10. **标签管理页面（编辑/删除/合并标签）** — 标签仅在创建笔记时自动生成，不提供独立的标签管理 UI
11. **笔记版本历史** — 编辑笔记时不记录历史版本，无法查看修改记录
12. **多语言支持** — UI 文案固定为中文，不提供英文/其他语言切换
