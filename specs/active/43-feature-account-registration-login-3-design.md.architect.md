# Architect Output: 账号注册与登录 — §1 功能概述 + §2 数据模型

**关联 Spec**: specs/active/43-feature-account-registration-login-3.md
**关联 Issue**: #43
**生成日期**: 2026-03-14
**生成子 Agent**: architect

---

## §1 功能概述

### 核心目标

为 AIFlomo 引入完整的账号注册与登录体系，让用户可通过邮箱+密码创建并访问个人账号，建立多端数据隔离与会话持久化的基础能力。

### 系统定位

本功能是整个用户体系的入口层，在系统中处于最底层依赖位置：

- **与数据库的关系**：新增 `users` 表和 `sessions` 表（SQLite + Drizzle ORM）。现有 `memos` 表（若已存在）须增加 `user_id` 外键，实现 Memo 与用户的数据隔离。
- **与后端路由的关系**：新增 `/api/auth/register`、`/api/auth/login`、`/api/auth/logout`、`/api/auth/me` 四条 Fastify 路由；现有所有需要鉴权的路由须在会话校验中间件通过后才可访问。
- **与前端状态管理的关系**：在 React Context + useReducer 的全局状态中新增 `authUser` 切片，管理当前登录用户信息；路由守卫根据 `authUser` 决定跳转到登录页还是 Memo 列表页。
- **与 Expo Router 页面的关系**：新增 `app/register.jsx` 和 `app/login.jsx` 两个页面文件，以及对应的表单组件。

### 用户价值

- **解决的问题**：MVP 阶段 Memo 数据无用户归属，任何人都可访问同一份数据。本功能为每条记录绑定所有者，实现真正的个人数据空间。
- **体验提升**：注册成功后自动登录（无需二次输入密码）、会话持久化 7 天（不频繁要求重新登录）、实时表单验证（失焦即提示、减少提交挫败感）三者共同降低用户进入产品的摩擦。

---

## §2 数据模型变更

### 2.1 新增表：`users`

存储注册用户的基本身份信息。密码使用 bcrypt 哈希存储，绝不明文保存。邮箱字段建唯一索引，由数据库层保障并发注册时的唯一性约束（对应边界场景"并发注册"）。

```js
// apps/server/src/db/schema.js（新增 users 表定义）
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  // 主键：自增整数
  id: integer('id').primaryKey({ autoIncrement: true }),

  // 登录凭证：邮箱（唯一，不区分大小写存储时统一转小写）
  email: text('email').notNull().unique(),

  // 显示名称：2-20 字符，允许中英文及数字
  nickname: text('nickname').notNull(),

  // 密码哈希：bcrypt 产生的 60 字符字符串
  password_hash: text('password_hash').notNull(),

  // 隐私协议同意时间戳（Unix 毫秒，null 表示未同意，理论上不应写入 DB）
  privacy_agreed_at: integer('privacy_agreed_at', { mode: 'timestamp_ms' }).notNull(),

  // 账号创建时间（Unix 毫秒，服务端写入）
  created_at: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),

  // 账号最后更新时间
  updated_at: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

**设计说明**：
- `email` 使用 `unique()` 约束，由 SQLite 在写入时自动抛出唯一冲突错误，服务层捕获后返回"该邮箱已被注册"提示，满足 FR-003 并发安全要求。
- `privacy_agreed_at` 记录用户主动同意隐私协议的精确时刻，满足合规审计需求（FR-004）。
- 不存储明文密码，`password_hash` 由 `bcryptjs` 生成（cost factor 推荐 10）。

---

### 2.2 新增表：`sessions`

存储用户登录会话，实现 Session + Cookie 认证（技术栈已确定，见 CLAUDE.md）。会话有效期 7 天（spec 假设清单）。

```js
// apps/server/src/db/schema.js（新增 sessions 表定义）
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './schema.js';

export const sessions = sqliteTable('sessions', {
  // 会话 ID：UUID v4 字符串，作为 Cookie 值
  id: text('id').primaryKey(),

  // 关联用户（外键）
  user_id: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // 会话创建时间（Unix 毫秒）
  created_at: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),

  // 会话过期时间（Unix 毫秒，创建时写入 now + 7天）
  expires_at: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
});
```

**设计说明**：
- `user_id` 设置 `onDelete: 'cascade'`：当用户账号被删除时，其所有会话自动清除，不残留孤儿记录。
- `expires_at` 由服务端在创建会话时计算（`Date.now() + 7 * 24 * 60 * 60 * 1000`），鉴权中间件每次请求时对比当前时间，过期则返回 401 并提示"登录已过期，请重新登录"（FR-006，边界场景"Session 过期"）。
- `id` 使用 UUID v4 而非自增整数，防止会话 ID 被枚举猜测。

---

### 2.3 已有表变更：`memos`（若已存在）

若 `memos` 表在本次功能前已创建，须增加 `user_id` 外键列，将每条 Memo 归属到具体用户，实现多用户数据隔离。

```js
// apps/server/src/db/schema.js（memos 表新增 user_id 字段）
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './schema.js';

export const memos = sqliteTable('memos', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  // 新增：归属用户（外键，级联删除）
  user_id: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // 以下为现有字段（保持原有定义不变）
  content: text('content').notNull(),
  created_at: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

**设计说明**：
- `user_id` 的 `onDelete: 'cascade'` 保证账号注销后 Memo 数据随之清除，不产生无主数据。
- 若 `memos` 表在 MVP 阶段尚未创建（本次功能为第一个功能），则直接在初始 schema 中包含 `user_id` 字段，无需迁移。

---

### 2.4 迁移策略

1. 执行 `pnpm db:generate -w apps/server` 生成 Drizzle 迁移文件。
2. 执行 `pnpm db:migrate -w apps/server` 应用迁移到 SQLite 数据库。
3. 若 `memos` 表已有历史数据，迁移前须决策是否为历史 Memo 指定一个默认 `user_id`（MVP 阶段建议直接清空重建，通过 `pnpm db:reset -w apps/server` 执行）。

---

*本文件由 architect subagent 生成，仅包含 §1 功能概述 + §2 数据模型，供后续 planner/api-designer 子 Agent 在此基础上补充 §3 API 设计、§4 组件结构等章节。*
