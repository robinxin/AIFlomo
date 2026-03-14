# Architect Output: 账号注册与登录 — §0 已有功能边界摘要 + §1 功能概述 + §2 数据模型

**关联 Spec**: specs/active/43-feature-account-registration-login-3.md
**生成日期**: 2026-03-13
**生成 Agent**: architect subagent

---

## §0 已有功能边界摘要（供 backend/frontend subagent 使用，不进入最终文档）

经全量搜索 `specs/templates/` 和 `specs/active/` 及 `specs/completed/` 下所有 `*.design.md` 文件，**当前代码库中不存在任何已生成的技术设计文档**。本次是该项目的第一个设计文档。

因此已有功能边界如下：

### 已有相关路由
无已有设计文档记录的路由。根据项目技术栈（Fastify），推断后端路由文件位于 `apps/server/src/routes/` 下。本次需新建认证路由模块（如 `auth.js`）。

### 已有相关数据表
无已有设计文档记录的数据表。根据项目技术栈（Drizzle ORM + SQLite），Schema 文件位于 `apps/server/src/db/schema.js`。本次需新建 `users` 表，以及 Session 存储配置（Session 存储于 SQLite 同库，由 Session 插件管理）。

### 已有相关 Context / 组件
无已有设计文档记录的 Context 或组件。根据项目技术栈（React Context + useReducer），前端状态管理位于 `apps/mobile/context/`。本次需新建 `AuthContext`（或等效命名），并在 `apps/mobile/app/` 下新建路由页面 `register.jsx` 和 `login.jsx`。

---

## §1 功能概述

### 核心目标

为 AIFlomo 实现完整的用户身份体系：支持新用户以邮箱 + 昵称 + 密码完成注册，以及已注册用户以邮箱 + 密码登录，建立基于 Session-Cookie 的会话机制，确保用户数据隔离与持久登录状态。

### 在系统中的定位

本功能是 AIFlomo 用户体系的基础，与以下系统部分产生直接交互：

| 交互目标 | 说明 |
|---------|------|
| **新建** `POST /api/auth/register` | 接收注册表单，创建用户，建立 Session，返回用户信息 |
| **新建** `POST /api/auth/login` | 接收邮箱和密码，验证身份，建立 Session，返回用户信息 |
| **新建** `POST /api/auth/logout` | 销毁当前 Session，清除 Cookie |
| **新建** `GET /api/auth/me` | 返回当前登录用户信息（用于前端初始化鉴权状态） |
| **新建** `users` 表（Drizzle） | 持久化用户账号数据 |
| **现有** Session 存储（SQLite 同库） | Fastify Session 插件将 Session 记录存入 SQLite，复用同一数据库连接 |
| **新建** `AuthContext`（前端） | 全局管理登录状态（user、isAuthenticated、loading），供所有页面组件消费 |
| **新建** `register.jsx` / `login.jsx`（前端） | 注册和登录页面，收集表单输入，调用后端 API |

### 用户价值

- **解决的问题**：MVP 阶段缺乏用户身份体系，所有 Memo 数据无法与特定用户绑定，多端同步和数据隔离均无法实现。
- **带来的体验提升**：用户拥有专属账号后，Memo 数据在 Web / Android / iOS 三端保持一致；通过 7 天 Session 保持登录状态，减少重复认证摩擦；注册成功后自动登录，消除二次输入密码的中断感。

---

## §2 数据模型变更

### 变更概述

本次需新增 `users` 表。Session 表由 Fastify Session 插件自动管理（`@fastify/session` 配合 `better-sqlite3` 存储适配器），无需手动定义 Drizzle schema。

### 新增表：`users`

```javascript
// apps/server/src/db/schema.js（新增部分）
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  // 主键：UUID 字符串，由应用层生成（crypto.randomUUID()）
  id: text('id').primaryKey(),

  // 邮箱：登录凭证，全局唯一，格式经后端验证
  email: text('email').notNull().unique(),

  // 昵称：显示名称，2-20 字符，不允许纯空格
  nickname: text('nickname').notNull(),

  // 密码哈希：使用 bcrypt 哈希存储，禁止明文
  passwordHash: text('password_hash').notNull(),

  // 隐私协议同意时间戳（Unix 毫秒），注册时必须提供，null 表示未同意（理论上不应存在）
  agreedAt: integer('agreed_at').notNull(),

  // 账号创建时间（Unix 毫秒），自动由应用层在插入时设置
  createdAt: integer('created_at').notNull(),

  // 最后更新时间（Unix 毫秒），每次更新时由应用层维护
  updatedAt: integer('updated_at').notNull(),
});
```

### 字段设计说明

| 字段 | 类型 | 约束 | 设计理由 |
|------|------|------|---------|
| `id` | `text` PRIMARY KEY | NOT NULL | 使用 UUID 字符串，避免整数自增 ID 的可预测性，便于后续分布式扩展 |
| `email` | `text` | NOT NULL, UNIQUE | 邮箱是唯一登录标识，UNIQUE 约束在数据库层防止并发注册竞态条件（FR-003） |
| `nickname` | `text` | NOT NULL | 用户显示名，存储前由后端 trim 并校验长度 2-20 字符 |
| `password_hash` | `text` | NOT NULL | bcrypt 哈希值，推荐 saltRounds=10；禁止明文（安全红线） |
| `agreed_at` | `integer` | NOT NULL | 记录隐私协议同意的精确时间，满足合规审计要求（FR-004） |
| `created_at` | `integer` | NOT NULL | Unix 毫秒时间戳，应用层在 INSERT 时赋值 `Date.now()` |
| `updated_at` | `integer` | NOT NULL | Unix 毫秒时间戳，应用层在 UPDATE 时赋值 `Date.now()` |

### .references() / onDelete 设计说明

`users` 表本身无外键依赖。未来当 `memos` 等业务表引用 `users.id` 时，应使用：

```javascript
// 示例（未来 memos 表的写法，本次不实现）
userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
```

`onDelete: 'cascade'` 理由：用户注销时，级联删除其所有业务数据，保证数据库不留孤立记录，符合 GDPR 数据清理原则。

### Session 存储说明

Session 由 `@fastify/session` 插件管理，配合 SQLite 兼容的 Session Store（如 `connect-sqlite3` 或自定义 `better-sqlite3` 适配器）存入同一 SQLite 数据库的 `sessions` 表。该表由插件自动创建和维护，**不纳入 Drizzle schema 管理**，无需手写迁移文件。

Session 有效期为 **7 天**（`maxAge: 7 * 24 * 60 * 60 * 1000`），Cookie 配置：

```javascript
// apps/server/src/plugins/session.js（参考配置）
cookie: {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天，单位毫秒
}
```

### 本次无其他数据模型变更

除新增 `users` 表外，本次功能不修改任何现有数据表结构。
