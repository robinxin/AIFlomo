# Architect Output: 账号注册与登录 — §1 功能概述 + §2 数据模型

**关联 Spec**: `specs/active/43-feature-account-registration-login-3.md`
**关联 Issue**: #43
**生成日期**: 2026-03-12
**生成者**: architect subagent

---

## §1 功能概述

### 核心目标

为 AIFlomo 建立完整的用户身份认证体系：允许新用户通过邮箱、昵称、密码注册账号，允许已有用户凭邮箱和密码登录，并基于 Session/Cookie 维持登录状态，从而为所有业务数据提供用户隔离基础。

### 在系统中的定位

本功能是 AIFlomo 数据安全边界的基础层。它与以下已有（或计划中）模块直接交互：

| 交互对象 | 方向 | 说明 |
|---------|------|------|
| `POST /api/auth/register` (新增路由) | 入站 | 接收注册表单，创建 `users` 记录并建立 session |
| `POST /api/auth/login` (新增路由) | 入站 | 验证邮箱/密码，建立 session |
| `POST /api/auth/logout` (新增路由) | 入站 | 销毁 session |
| `GET /api/auth/me` (新增路由) | 入站 | 返回当前登录用户信息，前端用于恢复登录状态 |
| `apps/server/src/plugins/auth.js` (`requireAuth`) | 横切 | 所有需要登录的业务路由（memos、tags）通过此 preHandler 校验 `request.session.userId` |
| `apps/server/src/plugins/session.js` | 依赖 | 使用 `@fastify/session` + `@fastify/cookie` 管理 session，session 存储于同一 SQLite 数据库（`connect-sqlite3` 或内存 store，MVP 阶段） |
| `apps/server/src/db/schema.js` (`users` 表) | 数据层 | 本功能新增 `users` 表（含 `nickname`、`privacyAgreedAt` 字段），并使现有 `memos`、`tags` 表通过 `user_id` 外键关联到该表 |
| 前端 `AuthContext` (新增 Context) | 前端状态 | 存储当前用户信息（`id`、`email`、`nickname`），驱动路由守卫和界面渲染 |
| 前端 `app/register.jsx` + `app/login.jsx` (新增页面) | 前端 UI | 注册页和登录页，通过 API client 调用后端认证接口 |

### 用户价值

1. **数据隔离**：每个用户只能访问自己的 Memo 和标签，从根本上保证隐私和数据安全。
2. **多端同步基础**：有了用户身份，Web/Android/iOS 三端的数据才能统一关联到同一账号。
3. **低摩擦准入**：注册成功后自动登录，无需二次输入密码；登录页仅在提交时验证，减少操作摩擦；密码支持明文/密文切换，降低输入错误率。
4. **安全感知**：密码 bcrypt 哈希存储、Session Cookie 设置 `httpOnly`/`sameSite:strict`，用户数据得到基础保护。

---

## §2 数据模型变更

### 2.1 总览

本次功能新增 `users` 表，并对现有规划中的 `memos`、`tags`、`memo_tags` 表的 `user_id` 外键关联进行确认。Session 由 `@fastify/session` 管理，不额外建表（MVP 阶段使用内存或文件 session store，无需 SQLite session 表）。

### 2.2 新增表：`users`

**设计决策**：
- `id` 使用 `crypto.randomUUID()` 生成 UUID，避免自增 ID 的可枚举性安全风险。
- `email` 加 `unique()` 约束，数据库层面防止并发注册时出现重复邮箱（配合应用层先查后插的逻辑形成双重保护）。
- `nickname` 独立存储，不与 email 复用，满足用户展示名称与登录凭证分离的需求。
- `passwordHash` 存储 bcrypt 哈希值（`$2b$` 格式，约 60 字符），明文密码绝不落库。
- `privacyAgreedAt` 记录用户同意隐私协议的时间戳（ISO 8601 字符串），既满足 FR-004 的业务要求，也为将来法律合规审计保留证据链。
- `createdAt` 使用 SQLite `CURRENT_TIMESTAMP` 默认值，由数据库写入，避免应用层时区问题。

```js
// apps/server/src/db/schema.js（新增部分）
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  // 主键：UUID，由应用层生成，避免自增 ID 的可枚举性风险
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // 登录凭证，全局唯一，大小写不敏感（存储时统一小写，由应用层处理）
  email: text('email')
    .notNull()
    .unique(),

  // 用户展示名称，2-20 字符，长度约束由应用层校验
  nickname: text('nickname')
    .notNull(),

  // bcrypt 哈希值（$2b$ 格式），绝不存储明文密码
  passwordHash: text('password_hash')
    .notNull(),

  // 用户同意隐私协议的时间戳（ISO 8601），用于合规审计
  // null 表示尚未同意（理论上不会出现，因为注册时强制勾选）
  privacyAgreedAt: text('privacy_agreed_at'),

  // 账号创建时间，由 SQLite 自动填充
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});
```

### 2.3 现有规划表：`memos`（确认外键设计）

`memos` 表的 `userId` 外键引用 `users.id`，`onDelete: 'cascade'` 确保用户账号删除时其所有 Memo 自动清除，避免孤儿数据。当前 MVP 阶段不提供账号注销功能，但此约束为后续迭代预留正确行为。

```js
// apps/server/src/db/schema.js（现有规划，与 users 表联动确认）
export const memos = sqliteTable('memos', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  content: text('content')
    .notNull(),

  // 外键关联 users.id；用户删除时级联删除其所有 Memo
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

### 2.4 现有规划表：`tags`（确认外键设计）

`tags` 表同理，`onDelete: 'cascade'` 保证用户删除时标签数据同步清除。

```js
export const tags = sqliteTable('tags', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  name: text('name')
    .notNull(),

  // 外键关联 users.id；用户删除时级联删除其所有标签
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
});
```

### 2.5 现有规划表：`memo_tags`（确认外键设计）

```js
export const memoTags = sqliteTable('memo_tags', {
  // 外键关联 memos.id；Memo 删除时级联删除关联关系
  memoId: text('memo_id')
    .notNull()
    .references(() => memos.id, { onDelete: 'cascade' }),

  // 外键关联 tags.id；标签删除时级联删除关联关系
  tagId: text('tag_id')
    .notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
});
```

### 2.6 外键与级联删除设计理由汇总

| 外键约束 | `onDelete` 行为 | 理由 |
|---------|----------------|------|
| `memos.user_id → users.id` | `cascade` | 用户账号删除时，其所有 Memo 无业务价值，级联清除避免孤儿数据 |
| `tags.user_id → users.id` | `cascade` | 同上，用户私有标签随账号消亡 |
| `memo_tags.memo_id → memos.id` | `cascade` | Memo 删除时，关联关系表记录随之清除，维持引用完整性 |
| `memo_tags.tag_id → tags.id` | `cascade` | 标签删除时，关联关系表记录随之清除，维持引用完整性 |

### 2.7 Session 存储

MVP 阶段 Session 由 `@fastify/session` 管理，使用默认内存 store（或 `better-sqlite3` 文件 store）。Session 不新增独立数据库表，会话有效期配置为 7 天（`maxAge: 7 * 24 * 60 * 60 * 1000`）。Session 中存储 `userId` 字段，`requireAuth` preHandler 通过检查 `request.session.userId` 实现认证守卫。

---

*本文件由 architect subagent 自动生成，内容以 spec 文档为准。如有歧义请在 Issue #43 中补充说明。*
