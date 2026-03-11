# 技术方案：账号注册与登录

**关联 Spec**: specs/active/43-feature-account-registration-login-3.md
**生成日期**: 2026-03-11

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

---

## §3 API 端点设计

### 概览

本次新增 4 个认证端点，全部挂载在 `apps/server/src/routes/auth.js` 下，通过 `prefix: '/api/auth'` 注册到 Fastify 实例。端点清单：

| 方法 | 路径 | 鉴权 | 职责 |
|------|------|------|------|
| POST | /api/auth/register | 不需要 | 新用户注册，注册成功后自动写入 Session |
| POST | /api/auth/login | 不需要 | 已注册用户登录，验证通过后写入 Session |
| POST | /api/auth/logout | 需要 | 销毁当前 Session，清除 Cookie |
| GET  | /api/auth/me | 需要 | 返回当前登录用户信息（用于前端恢复登录状态） |

### 3.1 POST /api/auth/register

**路径**: `POST /api/auth/register`
**文件**: `apps/server/src/routes/auth.js`
**鉴权**: 不需要（`preHandler` 不挂载 `requireAuth`）

**请求验证 JSON Schema**

```js
const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'nickname', 'password', 'agreedToPrivacy'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        maxLength: 255,
      },
      nickname: {
        type: 'string',
        minLength: 2,
        maxLength: 20,
      },
      password: {
        type: 'string',
        minLength: 8,
        maxLength: 20,
      },
      agreedToPrivacy: {
        type: 'boolean',
        enum: [true],   // 必须为 true，false 不通过校验
      },
    },
    additionalProperties: false,
  },
};
```

**业务逻辑（实现要点）**

1. 查询数据库确认 `email` 未被使用（Drizzle 参数化查询）
2. 若已存在，抛出 `ConflictError`（409）
3. 调用 `src/lib/password.js` 的 `hashPassword(password)` 生成 `passwordHash`（bcrypt，cost 12）
4. 记录 `agreedToPrivacyAt = new Date().toISOString()`
5. 向 `users` 表插入记录，使用 `.returning()` 取回 `id`、`email`、`nickname`、`createdAt`
6. 写入 Session：`request.session.userId = newUser.id`
7. 调用 `request.session.save()` 持久化 Session
8. 响应 201，返回用户信息（**不含** `passwordHash`）

**成功响应（HTTP 201）**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "nickname": "小明",
    "createdAt": "2026-03-11T08:00:00.000Z"
  },
  "message": "注册成功"
}
```

**失败响应清单**

| HTTP 状态码 | error 字段 | message 字段 | 触发条件 |
|------------|-----------|-------------|---------|
| 400 | `VALIDATION_ERROR` | `请求参数不合法` | JSON Schema 校验不通过（格式错误、字段缺失、agreedToPrivacy 为 false） |
| 409 | `CONFLICT` | `该邮箱已被注册` | email 已存在于 users 表 |
| 500 | `INTERNAL_ERROR` | `服务器内部错误` | 数据库写入异常或其他未预期错误 |

### 3.2 POST /api/auth/login

**路径**: `POST /api/auth/login`
**文件**: `apps/server/src/routes/auth.js`
**鉴权**: 不需要（`preHandler` 不挂载 `requireAuth`）

**请求验证 JSON Schema**

```js
const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        maxLength: 255,
      },
      password: {
        type: 'string',
        minLength: 1,
        maxLength: 100,    // 登录侧宽松，防止 DOS 式超长输入
      },
    },
    additionalProperties: false,
  },
};
```

**业务逻辑（实现要点）**

1. 通过 `email` 从 `users` 表查询用户（Drizzle 参数化查询）
2. 若用户不存在，**不得暴露"邮箱不存在"**，统一返回 `UnauthorizedError`（401），message 为 "邮箱或密码错误，请重试"（FR-007 安全要求）
3. 调用 `src/lib/password.js` 的 `verifyPassword(password, user.passwordHash)` 进行 bcrypt 比对
4. 比对失败，同上返回 `UnauthorizedError`（401）
5. 比对成功，写入 Session：`request.session.userId = user.id`
6. 调用 `request.session.save()` 持久化
7. 响应 200，返回用户信息（**不含** `passwordHash`）

**成功响应（HTTP 200）**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "nickname": "小明",
    "createdAt": "2026-03-11T08:00:00.000Z"
  },
  "message": "登录成功"
}
```

**失败响应清单**

| HTTP 状态码 | error 字段 | message 字段 | 触发条件 |
|------------|-----------|-------------|---------|
| 400 | `VALIDATION_ERROR` | `请求参数不合法` | JSON Schema 校验不通过（字段缺失、格式错误） |
| 401 | `UNAUTHORIZED` | `邮箱或密码错误，请重试` | 邮箱不存在或密码比对失败（故意合并，防枚举攻击） |
| 500 | `INTERNAL_ERROR` | `服务器内部错误` | 数据库查询异常或 bcrypt 执行异常 |

### 3.3 POST /api/auth/logout

**路径**: `POST /api/auth/logout`
**文件**: `apps/server/src/routes/auth.js`
**鉴权**: 需要，挂载 `preHandler: [requireAuth]`

**业务逻辑（实现要点）**

1. `requireAuth` preHandler 确保用户已登录（未登录直接 401，不进入 handler）
2. 调用 `request.session.destroy()` 销毁 Session（同步清除 SQLite session store 中的记录）
3. 响应 200

**成功响应（HTTP 200）**

```json
{
  "data": null,
  "message": "已退出登录"
}
```

**失败响应清单**

| HTTP 状态码 | error 字段 | message 字段 | 触发条件 |
|------------|-----------|-------------|---------|
| 401 | `UNAUTHORIZED` | `请先登录` | 未携带有效 Session Cookie（由 `requireAuth` preHandler 返回） |
| 500 | `INTERNAL_ERROR` | `服务器内部错误` | Session 销毁异常 |

### 3.4 GET /api/auth/me

**路径**: `GET /api/auth/me`
**文件**: `apps/server/src/routes/auth.js`
**鉴权**: 需要，挂载 `preHandler: [requireAuth]`

**业务逻辑（实现要点）**

1. `requireAuth` preHandler 确保 `request.session.userId` 存在（Session 有效）
2. 通过 `request.session.userId` 从 `users` 表查询用户完整信息（Drizzle 参数化查询）
3. 若数据库中用户记录不存在（账号被删除但 Session 未过期），销毁 Session 并返回 401
4. 响应 200，返回用户信息（**不含** `passwordHash`）

**成功响应（HTTP 200）**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "nickname": "小明",
    "createdAt": "2026-03-11T08:00:00.000Z"
  },
  "message": "ok"
}
```

**失败响应清单**

| HTTP 状态码 | error 字段 | message 字段 | 触发条件 |
|------------|-----------|-------------|---------|
| 401 | `UNAUTHORIZED` | `请先登录` | Session 不存在或已过期（由 `requireAuth` preHandler 返回） |
| 401 | `UNAUTHORIZED` | `用户不存在，请重新登录` | Session 有效但对应用户已被删除 |
| 500 | `INTERNAL_ERROR` | `服务器内部错误` | 数据库查询异常 |

---

## §4 前端页面与组件

### 4.1 新增 Screen（路由页面）

所有新增页面位于 `apps/mobile/app/` 下，遵循 Expo Router 文件路由约定。

**新增页面清单**

| 文件路径 | URL 路径 | 职责 |
|---------|---------|------|
| `app/(auth)/_layout.jsx` | 路由分组布局 | 检测已登录用户重定向到主界面 |
| `app/(auth)/login.jsx` | `/login` | 登录页面，收集邮箱和密码 |
| `app/(auth)/register.jsx` | `/register` | 注册页面，收集邮箱、昵称、密码、隐私协议同意 |
| `app/_layout.jsx`（修改） | 根布局 | 包裹 `AuthProvider`，应用启动时恢复 Session |

### 4.2 新增组件

所有组件位于 `apps/mobile/components/auth/` 下，使用具名 export。

**组件清单**

| 文件路径 | 职责 |
|---------|------|
| `components/auth/FormError.jsx` | 表单顶部服务端错误提示框 |
| `components/auth/FieldError.jsx` | 输入框下方字段级验证错误提示 |
| `components/auth/PasswordInput.jsx` | 密码输入框（带明文/密文切换） |
| `components/auth/PrivacyCheckbox.jsx` | 隐私协议勾选框组件 |
| `components/auth/AuthButton.jsx` | 认证页提交按钮（含加载状态） |

### 4.3 Context / Reducer 变更

**新增文件**: `apps/mobile/context/AuthContext.jsx`

**初始状态**

```js
const initialState = {
  user: null,           // { id, email, nickname } | null
  isLoading: true,      // 初始为 true，等待 GET /api/auth/me 完成
  isAuthenticated: false,
  error: null,
};
```

**Action Types（新增）**

| Action Type | Payload | 说明 |
|------------|---------|------|
| `AUTH_INIT_START` | - | 应用启动，开始恢复 Session |
| `AUTH_INIT_SUCCESS` | `user` 对象 | Session 恢复成功，设置用户信息 |
| `AUTH_INIT_FAIL` | - | Session 不存在或已过期 |
| `LOGIN_SUCCESS` | `user` 对象 | 登录成功，设置用户信息 |
| `REGISTER_SUCCESS` | `user` 对象 | 注册成功（同时自动登录） |
| `LOGOUT_SUCCESS` | - | 退出登录，清除用户信息 |
| `AUTH_ERROR` | `errorMessage` 字符串 | 认证操作出错 |

### 4.4 自定义 Hook 变更

**新增文件**: `apps/mobile/hooks/use-auth.js`

**对外暴露的接口**

| 方法/属性 | 类型 | 说明 |
|---------|------|------|
| `state` | object | `{ user, isLoading, isAuthenticated, error }` |
| `login(email, password)` | async function | 调用登录 API，成功后 dispatch LOGIN_SUCCESS |
| `register(email, nickname, password, agreedToPrivacy)` | async function | 调用注册 API，成功后 dispatch REGISTER_SUCCESS |
| `logout()` | async function | 调用登出 API，成功后 dispatch LOGOUT_SUCCESS |

### 4.5 调用的 API 端点

所有端点均通过 `apps/mobile/lib/api-client.js` 中的 `api` 对象调用。

| 调用位置 | HTTP 方法 | 端点路径 | 请求体 | 调用时机 |
|---------|----------|---------|--------|---------|
| `AuthProvider` 挂载时 | GET | `/api/auth/me` | - | 应用启动，恢复 Session |
| `useAuth.login()` | POST | `/api/auth/login` | `{ email, password }` | 用户点击"登录"按钮 |
| `useAuth.register()` | POST | `/api/auth/register` | `{ email, nickname, password, agreedToPrivacy }` | 用户点击"注册"按钮 |
| `useAuth.logout()` | POST | `/api/auth/logout` | `{}` | 用户主动退出 |

---

## §5 改动文件清单

### 新增文件

**后端**

- `apps/server/src/routes/auth.js` — 认证路由，处理注册/登录/登出/当前用户信息
- `apps/server/src/lib/password.js` — 密码哈希与校验工具（bcrypt）
- `apps/server/src/db/schema.js` — 新增 `users` 表定义（已在 §2 详述）

**前端**

- `apps/mobile/app/(auth)/_layout.jsx` — Auth 路由分组布局
- `apps/mobile/app/(auth)/login.jsx` — 登录页面 Screen
- `apps/mobile/app/(auth)/register.jsx` — 注册页面 Screen
- `apps/mobile/context/AuthContext.jsx` — 认证状态 Context + Reducer + Provider
- `apps/mobile/hooks/use-auth.js` — 认证操作封装 Hook
- `apps/mobile/components/auth/FormError.jsx` — 表单顶部错误提示组件
- `apps/mobile/components/auth/FieldError.jsx` — 字段级错误提示组件
- `apps/mobile/components/auth/PasswordInput.jsx` — 密码输入框（含明文切换）
- `apps/mobile/components/auth/PrivacyCheckbox.jsx` — 隐私协议勾选框组件
- `apps/mobile/components/auth/AuthButton.jsx` — 认证页提交按钮（含加载状态）

### 修改文件

**后端**

- `apps/server/src/lib/errors.js` — 新增 `UnauthorizedError`（401）、`ConflictError`（409）两个错误类
- `apps/server/src/index.js` — 注册 `authRoutes` 到 `/api/auth` 路径

**前端**

- `apps/mobile/app/_layout.jsx` — 根布局添加 `AuthProvider` 包裹

---

## §6 技术约束与风险

### 6.1 输入校验

**前端校验（注册页 onBlur 触发）**

| 字段 | 验证规则 | 错误提示 |
|------|---------|---------|
| email | 正则：`/^[^\s@]+@[^\s@]+\.[^\s@]+$/` | "请输入有效的邮箱地址" |
| nickname | 长度 2-20 字符，非纯空格 | "昵称长度为 2-20 个字符" |
| password | 长度 8-20 字符 | "密码长度至少为 8 个字符" |
| agreedToPrivacy | 必须为 true（提交时验证） | "请阅读并同意隐私协议" |

**后端校验（Fastify JSON Schema，所有字段必填）**

| 字段 | 类型 | 格式/长度约束 |
|------|------|-------------|
| email | string | `format: 'email'`, `maxLength: 255` |
| nickname | string | `minLength: 2`, `maxLength: 20` |
| password | string | `minLength: 8`, `maxLength: 20` |
| agreedToPrivacy | boolean | `enum: [true]`（仅接受 true） |

### 6.2 安全

**密码存储**：bcrypt 哈希（cost 12），禁止明文存储

**防枚举攻击**：邮箱不存在与密码错误返回相同 401 响应体："邮箱或密码错误，请重试"

**Session 安全**：
- `httpOnly: true` — 防 XSS 窃取 Cookie
- `sameSite: 'strict'` — 防 CSRF
- `secure: true`（生产环境） — 强制 HTTPS
- `maxAge: 7 天` — Session 有效期

**XSS 防护**：
- API 层纯 JSON 响应，无 HTML 渲染
- nickname 展示时使用纯文本渲染（`<Text>{nickname}</Text>`），不使用 HTML 插值

**SQL 注入防御**：全程 Drizzle ORM 参数化查询，禁止字符串拼接

**响应不泄露密码哈希**：`.returning()` 和 `.select()` 均明确列出字段，排除 `passwordHash`

### 6.3 性能

**潜在 N+1 查询**：本次功能无关联查询需求，单表操作为主，无 N+1 风险

**分页需求**：认证接口均为单条记录操作，无需分页

**Session 查询优化**：SQLite session store 使用主键索引，查询效率高

### 6.4 兼容性

**与现有功能兼容性**：
- `memos` / `tags` 表新增 `userId` 外键，现有无用户数据需迁移（MVP 首次上线，无历史数据）
- 现有 `requireAuth` preHandler 无需修改，直接复用
- 现有 `lib/api-client.js` 已支持 `credentials: 'include'`，Session Cookie 自动传递

---

## §7 不包含（范围边界）

本次设计**不涉及**以下功能，防止实现阶段范围蔓延：

1. **密码重置功能** — 用户忘记密码时，暂不提供邮箱验证码或安全问题重置流程（后续迭代考虑）
2. **邮箱验证功能** — 注册时不发送验证邮件，仅进行格式校验（降低 MVP 复杂度）
3. **第三方登录** — 不支持 Google / GitHub / Apple 等 OAuth 登录（后续需求）
4. **"记住我"功能** — 所有用户的会话管理策略一致（7 天有效期），不提供延长选项
5. **账号注销功能** — 不提供用户自助删除账号的入口（需产品规划数据保留策略）
6. **防暴力破解机制** — 不限制短时间内的登录尝试次数（后续可增加 rate limiting）
7. **多设备登录管理** — 不提供"查看当前登录设备"或"远程登出"功能
8. **隐私协议内容管理** — 协议文字暂时使用占位文本，后续由法务团队补充
9. **用户头像上传** — `users` 表不包含 `avatar` 字段，仅支持昵称展示
10. **注册/登录埋点统计** — 不集成第三方分析工具（如 Google Analytics），无转化率追踪
