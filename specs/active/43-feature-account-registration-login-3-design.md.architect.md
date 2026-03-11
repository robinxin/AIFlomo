# 技术方案文档 — 账号注册与登录（Issue #43）

> 作者: architect subagent
> 日期: 2026-03-11
> Spec 来源: specs/active/43-feature-account-registration-login-3.md

---

## §1 功能概述

### 核心目标

为 AIFlomo 构建完整的用户身份体系，支持邮箱注册、登录与 Session 会话管理，实现"用户数据隔离 + 跨端持久登录"的基础能力。

### 在系统中的定位

本功能是整个 AIFlomo 用户体系的基础层，在未实现此功能之前，Memo 的创建、存储、查询均无法与具体用户关联。其与系统各层的交互关系如下：

**后端交互**

| 层 | 交互点 |
|----|--------|
| `src/routes/auth.js` | 新增路由文件，处理 `POST /api/auth/register`、`POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/me` |
| `src/plugins/session.js` | 注册成功/登录成功后向 `request.session` 写入 `userId`，`requireAuth` 通过读取该字段实现鉴权 |
| `src/plugins/auth.js` | 现有的 `requireAuth` preHandler 直接复用，无需修改 |
| `src/db/schema.js` | 新增 `users` 表（含密码哈希字段），`memos` / `tags` 表的 `userId` 外键依赖此表 |
| `src/lib/password.js` | 新增工具文件，封装 `bcrypt`/`crypto` 密码哈希与校验逻辑 |
| `src/lib/errors.js` | 复用 `AppError`，新增 `UnauthorizedError`（401）、`ConflictError`（409） |

**前端交互**

| 层 | 交互点 |
|----|--------|
| `app/(auth)/login.jsx` | 新增登录页路由，接收 email + password，通过 `api.post('/api/auth/login', ...)` 提交 |
| `app/(auth)/register.jsx` | 新增注册页路由，接收 email + nickname + password + agreedToPrivacy |
| `app/(auth)/_layout.jsx` | 新增 Auth 路由分组布局，未登录用户重定向至此 |
| `app/_layout.jsx` | 根布局包裹 `AuthProvider`，在应用启动时调用 `GET /api/auth/me` 恢复登录状态 |
| `context/AuthContext.jsx` | 新增 Context 文件，管理 `user`、`isLoading`、`isAuthenticated` 全局状态 |
| `hooks/use-auth.js` | 封装 `login()`、`register()`、`logout()` 操作，统一 dispatch 到 AuthContext |
| `lib/api-client.js` | 复用现有 API 客户端，无需修改 |

**数据表交互**

- `users` 表：本次新增，是用户数据的唯一来源
- `memos` 表：通过 `userId` 外键（`onDelete: 'cascade'`）引用 `users.id`，用户注销后数据随之删除（MVP 阶段策略）
- `tags` 表：同上

### 用户价值

- **解决的问题**：当前系统无用户隔离，所有数据混存于同一空间，多用户场景无法使用；会话缺失导致刷新后数据丢失。
- **体验提升**：
  - 一次注册后 7 天内无需重复登录（Session Cookie 自动续期）
  - 注册成功后自动登录跳转主界面，减少用户操作步骤
  - 表单失焦即时验证（邮箱、昵称、密码格式），降低无效提交摩擦
  - 密码明文/密文切换，帮助用户确认输入无误

---

## §2 数据模型变更

本次需新增 `users` 表，并确认 `memos`、`tags` 表的 `userId` 外键指向该表（如这两张表在当前 codebase 中尚未建立，则一并在此次迁移中创建）。

### 2.1 新增表：`users`

**设计说明**

- `id` 使用 `crypto.randomUUID()` 生成，保证全局唯一性且不暴露自增规律（安全）
- `email` 加 `unique()` 约束，数据库层保证并发注册场景的唯一性（配合 SQLite WAL 模式天然串行写入，防止并发注册同一邮箱）
- `passwordHash` 存储 bcrypt 哈希值（推荐 cost factor 12），绝不存储明文密码
- `nickname` 允许 2-20 字符，后端通过 JSON Schema `minLength: 2, maxLength: 20` 验证
- `agreedToPrivacyAt` 记录用户同意隐私协议的时间戳（ISO 8601 字符串），满足法规留存要求；`null` 表示未同意，注册时必须非空
- `createdAt` 使用 SQLite `CURRENT_TIMESTAMP` 服务端默认值，保证时区一致性

```js
// src/db/schema.js（新增 users 表定义）
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  // 主键：UUID，服务端生成，不暴露自增 ID
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),

  // 邮箱：登录唯一凭证，数据库级 UNIQUE 约束防并发重复注册
  email: text('email').notNull().unique(),

  // 昵称：用于页面展示，不用于登录，允许中英文数字
  nickname: text('nickname').notNull(),

  // 密码哈希：bcrypt 哈希，cost factor 12，禁止存储明文
  passwordHash: text('password_hash').notNull(),

  // 隐私协议同意时间戳：ISO 8601 字符串，null 表示未同意（注册时强制非 null）
  agreedToPrivacyAt: text('agreed_to_privacy_at'),

  // 账号创建时间：服务端 UTC 时间戳
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});
```

### 2.2 确认表：`memos`（外键依赖 users）

`memos.userId` 必须通过 `.references(() => users.id, { onDelete: 'cascade' })` 引用 `users.id`。

**onDelete: 'cascade' 的设计理由**：MVP 阶段选择级联删除，即用户账号被删除时，其所有 Memo 数据同步删除。这简化了数据清理逻辑，避免孤儿记录占用存储空间。若后续产品需要支持"账号注销保留数据备份"，可迁移为 `onDelete: 'set null'` 并在 `memos` 表新增软删除字段。

```js
// src/db/schema.js（memos 表，确认外键配置）
export const memos = sqliteTable('memos', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  content: text('content').notNull(),

  // 外键：关联 users.id，用户删除时级联删除其所有 Memo
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
```

### 2.3 确认表：`tags`（外键依赖 users）

与 `memos` 同理，`tags.userId` 级联引用 `users.id`。

```js
// src/db/schema.js（tags 表，确认外键配置）
export const tags = sqliteTable('tags', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),

  // 外键：关联 users.id，用户删除时级联删除其所有 Tag
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
});
```

### 2.4 确认表：`memo_tags`（复合外键）

`memo_tags` 的两个外键均配置 `onDelete: 'cascade'`，确保 Memo 或 Tag 被删除时关联记录同步清理。

```js
// src/db/schema.js（memo_tags 表，确认外键配置）
export const memoTags = sqliteTable('memo_tags', {
  memoId: text('memo_id')
    .notNull()
    .references(() => memos.id, { onDelete: 'cascade' }),
  tagId: text('tag_id')
    .notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
});
```

### 2.5 完整 schema.js 汇总（可直接复制）

```js
// src/db/schema.js
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ── 用户表（本次新增）──────────────────────────────────────────────────────
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  nickname: text('nickname').notNull(),
  passwordHash: text('password_hash').notNull(),
  agreedToPrivacyAt: text('agreed_to_privacy_at'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

// ── Memo 表（确认 userId 外键）─────────────────────────────────────────────
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

// ── 标签表（确认 userId 外键）──────────────────────────────────────────────
export const tags = sqliteTable('tags', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
});

// ── Memo-Tag 关联表（确认双向级联）────────────────────────────────────────
export const memoTags = sqliteTable('memo_tags', {
  memoId: text('memo_id')
    .notNull()
    .references(() => memos.id, { onDelete: 'cascade' }),
  tagId: text('tag_id')
    .notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
});
```

### 2.6 迁移执行命令

```bash
# 1. 生成迁移文件（Drizzle Kit 根据 schema.js 变更自动生成 SQL）
pnpm db:generate -w apps/server

# 2. 执行迁移，创建 users 表并更新外键约束
pnpm db:migrate -w apps/server
```

### 2.7 Session 存储说明

`@fastify/session` 使用 SQLite 同库存储 Session（通过 `connect-sqlite3` 或等效 store 适配器），Session 表由 store 库自动创建，不需要在 `schema.js` 中手动定义。Session Cookie 配置如下（已在 `src/plugins/session.js` 中规范）：

- `httpOnly: true` — 防 XSS 窃取 Cookie
- `sameSite: 'strict'` — 防 CSRF
- `secure: process.env.NODE_ENV === 'production'` — 生产环境强制 HTTPS
- `maxAge: 7 * 24 * 60 * 60 * 1000` — 7 天有效期（与 Spec 假设一致）
