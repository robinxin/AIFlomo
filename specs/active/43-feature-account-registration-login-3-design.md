# 技术方案：账号注册与登录

**关联 Spec**: `specs/active/43-feature-account-registration-login-3.md`
**生成日期**: 2026-03-12

---

<!-- §1 §2：原样复制 architect.md 的完整内容，不得改动 -->

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

---

<!-- §3：原样复制 backend.md 的完整内容，不得改动 -->

# Backend Output: 账号注册与登录 — §3 API 端点设计

**关联 Spec**: `specs/active/43-feature-account-registration-login-3.md`
**关联 Issue**: #43
**生成日期**: 2026-03-12
**生成者**: backend-developer subagent

---

## §3 API 端点设计

所有认证相关端点统一放在 `apps/server/src/routes/auth.js`，以 Fastify plugin 形式导出，注册时加 `/api/auth` 前缀。

---

### 3.1 POST /api/auth/register — 用户注册

**文件路径**: `apps/server/src/routes/auth.js`

**鉴权**: 不需要（公开端点，注册前无 session）

#### 请求验证 JSON Schema

```js
const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'nickname', 'password', 'privacyAgreed'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        maxLength: 254,
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
      privacyAgreed: {
        type: 'boolean',
        enum: [true],
      },
    },
    additionalProperties: false,
  },
};
```

#### 成功响应示例

HTTP 状态码: `201 Created`

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "nickname": "小明",
    "createdAt": "2026-03-12T08:00:00.000Z"
  },
  "message": "注册成功"
}
```

> 响应中不返回 `passwordHash` 和 `privacyAgreedAt` 字段。注册成功后服务端同时在 `request.session` 中写入 `userId`，前端获得 Set-Cookie 响应头，实现自动登录。

#### 失败响应清单

| HTTP 状态码 | `error` 字段值 | 说明 |
|------------|---------------|------|
| `400 Bad Request` | `VALIDATION_ERROR` | 请求体字段格式不合法（email 格式错误、nickname 长度越界、password 不足 8 位、privacyAgreed 非 true） |
| `409 Conflict` | `EMAIL_ALREADY_EXISTS` | 该邮箱已被注册 |
| `500 Internal Server Error` | `INTERNAL_ERROR` | 数据库写入异常或其他服务端错误 |

失败响应体格式（以 409 为例）：

```json
{
  "data": null,
  "error": "EMAIL_ALREADY_EXISTS",
  "message": "该邮箱已被注册"
}
```

#### 实现要点

```js
// apps/server/src/routes/auth.js（注册端点核心逻辑示意）
fastify.post('/register', { schema: registerSchema }, async (request, reply) => {
  const { email, nickname, password, privacyAgreed } = request.body;

  // 1. 邮箱统一转小写（大小写不敏感）
  const normalizedEmail = email.toLowerCase();

  // 2. 查询邮箱是否已存在（应用层校验，配合 DB unique 约束双重保护）
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .get();

  if (existing) {
    throw new AppError(409, '该邮箱已被注册', 'EMAIL_ALREADY_EXISTS');
  }

  // 3. bcrypt 哈希密码
  const passwordHash = await bcrypt.hash(password, 12);

  // 4. 记录隐私协议同意时间戳
  const privacyAgreedAt = new Date().toISOString();

  // 5. 写入数据库
  const [user] = await db
    .insert(users)
    .values({ email: normalizedEmail, nickname, passwordHash, privacyAgreedAt })
    .returning({ id: users.id, email: users.email, nickname: users.nickname, createdAt: users.createdAt });

  // 6. 注册成功后自动登录（写入 session）
  request.session.userId = user.id;

  return reply.status(201).send({ data: user, message: '注册成功' });
});
```

---

### 3.2 POST /api/auth/login — 用户登录

**文件路径**: `apps/server/src/routes/auth.js`

**鉴权**: 不需要（公开端点）

#### 请求验证 JSON Schema

```js
const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        maxLength: 254,
      },
      password: {
        type: 'string',
        minLength: 1,
        maxLength: 20,
      },
    },
    additionalProperties: false,
  },
};
```

> `password` 登录端点的 `minLength` 设为 1 而非 8，因为用户可能输入任意字符串（错误密码），业务层返回统一错误提示，避免通过 schema 错误暴露密码规则。

#### 成功响应示例

HTTP 状态码: `200 OK`

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "nickname": "小明",
    "createdAt": "2026-03-12T08:00:00.000Z"
  },
  "message": "登录成功"
}
```

> 登录成功后服务端写入 `request.session.userId`，响应携带 Set-Cookie 响应头。响应体不包含 `passwordHash`。

#### 失败响应清单

| HTTP 状态码 | `error` 字段值 | 说明 |
|------------|---------------|------|
| `400 Bad Request` | `VALIDATION_ERROR` | 请求体字段缺失或格式不合法（email 格式错误、password 为空） |
| `401 Unauthorized` | `INVALID_CREDENTIALS` | 邮箱不存在或密码错误（两种情况返回相同提示，防止枚举攻击，符合 FR-007） |
| `500 Internal Server Error` | `INTERNAL_ERROR` | 数据库查询异常或其他服务端错误 |

失败响应体格式（以 401 为例）：

```json
{
  "data": null,
  "error": "INVALID_CREDENTIALS",
  "message": "邮箱或密码错误，请重试"
}
```

#### 实现要点

```js
// apps/server/src/routes/auth.js（登录端点核心逻辑示意）
fastify.post('/login', { schema: loginSchema }, async (request, reply) => {
  const { email, password } = request.body;

  // 1. 邮箱统一转小写
  const normalizedEmail = email.toLowerCase();

  // 2. 查询用户（邮箱不区分大小写）
  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .get();

  // 3. 邮箱不存在或密码不匹配，统一返回相同错误（防止用户枚举）
  if (!user) {
    throw new AppError(401, '邮箱或密码错误，请重试', 'INVALID_CREDENTIALS');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError(401, '邮箱或密码错误，请重试', 'INVALID_CREDENTIALS');
  }

  // 4. 写入 session
  request.session.userId = user.id;

  // 5. 返回用户信息（剔除敏感字段）
  const { passwordHash, privacyAgreedAt, ...safeUser } = user;
  return reply.status(200).send({ data: safeUser, message: '登录成功' });
});
```

---

### 3.3 POST /api/auth/logout — 用户登出

**文件路径**: `apps/server/src/routes/auth.js`

**鉴权**: `preHandler: [requireAuth]`（未登录用户调用此端点返回 401）

#### 请求验证 JSON Schema

无请求体（body 为空），无需定义 schema。

#### 成功响应示例

HTTP 状态码: `200 OK`

```json
{
  "data": null,
  "message": "已退出登录"
}
```

#### 失败响应清单

| HTTP 状态码 | `error` 字段值 | 说明 |
|------------|---------------|------|
| `401 Unauthorized` | `Unauthorized` | 当前请求无有效 session（用户已未登录） |
| `500 Internal Server Error` | `INTERNAL_ERROR` | session 销毁过程中出现服务端异常 |

失败响应体格式（以 401 为例）：

```json
{
  "data": null,
  "error": "Unauthorized",
  "message": "请先登录"
}
```

#### 实现要点

```js
// apps/server/src/routes/auth.js（登出端点核心逻辑示意）
fastify.post('/logout', { preHandler: [requireAuth] }, async (request, reply) => {
  // 销毁 session（@fastify/session 提供 destroy 方法）
  await request.session.destroy();
  return reply.status(200).send({ data: null, message: '已退出登录' });
});
```

---

### 3.4 GET /api/auth/me — 获取当前用户信息

**文件路径**: `apps/server/src/routes/auth.js`

**鉴权**: `preHandler: [requireAuth]`（未登录用户调用返回 401）

#### 请求验证 JSON Schema

无请求体，无 querystring 参数，无需定义 schema。

#### 成功响应示例

HTTP 状态码: `200 OK`

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "nickname": "小明",
    "createdAt": "2026-03-12T08:00:00.000Z"
  },
  "message": "ok"
}
```

> 响应中不返回 `passwordHash` 和 `privacyAgreedAt` 字段。此端点供前端 `AuthContext` 在应用启动时调用，用于恢复登录状态。

#### 失败响应清单

| HTTP 状态码 | `error` 字段值 | 说明 |
|------------|---------------|------|
| `401 Unauthorized` | `Unauthorized` | 当前请求无有效 session（未登录或 session 已过期） |
| `404 Not Found` | `NOT_FOUND` | session 中的 userId 对应的用户记录不存在（账号被删除等异常情况） |
| `500 Internal Server Error` | `INTERNAL_ERROR` | 数据库查询异常或其他服务端错误 |

失败响应体格式（以 401 为例）：

```json
{
  "data": null,
  "error": "Unauthorized",
  "message": "请先登录"
}
```

#### 实现要点

```js
// apps/server/src/routes/auth.js（获取当前用户端点核心逻辑示意）
fastify.get('/me', { preHandler: [requireAuth] }, async (request, reply) => {
  const userId = request.session.userId;

  const user = await db
    .select({
      id: users.id,
      email: users.email,
      nickname: users.nickname,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!user) {
    throw new NotFoundError('User');
  }

  return reply.status(200).send({ data: user, message: 'ok' });
});
```

---

### 3.5 路由文件完整结构

```js
// apps/server/src/routes/auth.js
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { requireAuth } from '../plugins/auth.js';
import { AppError, NotFoundError } from '../lib/errors.js';

// JSON Schema 定义
const registerSchema = { /* 见 3.1 */ };
const loginSchema = { /* 见 3.2 */ };

async function authRoutes(fastify) {
  fastify.post('/register', { schema: registerSchema }, async (request, reply) => {
    // 见 3.1 实现要点
  });

  fastify.post('/login', { schema: loginSchema }, async (request, reply) => {
    // 见 3.2 实现要点
  });

  fastify.post('/logout', { preHandler: [requireAuth] }, async (request, reply) => {
    // 见 3.3 实现要点
  });

  fastify.get('/me', { preHandler: [requireAuth] }, async (request, reply) => {
    // 见 3.4 实现要点
  });
}

export { authRoutes };
```

### 3.6 应用入口注册

```js
// apps/server/src/index.js（新增认证路由注册）
import { authRoutes } from './routes/auth.js';

await app.register(authRoutes, { prefix: '/api/auth' });
```

---

### 3.7 端点汇总表

| 端点 | HTTP 方法 | 鉴权 | 成功状态码 | 主要失败状态码 |
|------|----------|------|-----------|--------------|
| `/api/auth/register` | `POST` | 无 | `201` | `400`, `409`, `500` |
| `/api/auth/login` | `POST` | 无 | `200` | `400`, `401`, `500` |
| `/api/auth/logout` | `POST` | `requireAuth` | `200` | `401`, `500` |
| `/api/auth/me` | `GET` | `requireAuth` | `200` | `401`, `404`, `500` |

---

### 3.8 安全设计说明

| 安全点 | 实现方式 |
|--------|---------|
| 密码存储 | `bcrypt.hash(password, 12)`，绝不落库明文 |
| 防用户枚举 | 登录失败时邮箱不存在与密码错误返回相同 `401` 响应（FR-007） |
| Session Cookie | `httpOnly: true`、`sameSite: 'strict'`、生产环境 `secure: true`、7 天过期 |
| 邮箱大小写 | 存储和查询前统一 `toLowerCase()`，防止同邮箱多账号 |
| 并发注册防护 | 应用层先查后插 + 数据库 `unique()` 约束双重保护（FR-003） |
| 敏感字段过滤 | 所有响应均不包含 `passwordHash` 和 `privacyAgreedAt` |
| 参数化查询 | 全程使用 Drizzle ORM，自动防 SQL 注入 |

---

*本文件由 backend-developer subagent 自动生成，内容以 spec 和 architect 文档为准。如有歧义请在 Issue #43 中补充说明。*

---

<!-- §4：原样复制 frontend.md 的完整内容，不得改动 -->

# Frontend Output: 账号注册与登录 — §4 前端页面与组件设计

**关联 Spec**: `specs/active/43-feature-account-registration-login-3.md`
**关联 Architect 输出**: `specs/active/43-feature-account-registration-login-3-design.md.architect.md`
**关联 Issue**: #43
**生成日期**: 2026-03-12
**生成者**: frontend-developer subagent

---

## §4 前端页面与组件设计

### 4.1 新增 Screen 列表

| 文件路径 | URL 路径 | 职责概述 |
|---------|---------|---------|
| `apps/mobile/app/register.jsx` | `/register` | 新用户注册页面：收集邮箱、昵称、密码、隐私协议同意，提交后自动登录并跳转到主界面 |
| `apps/mobile/app/login.jsx` | `/login` | 已有用户登录页面：验证邮箱和密码，建立 Session 后跳转到主界面 |
| `apps/mobile/app/index.jsx` | `/` | 根路由守卫：检查 `AuthContext` 中的登录状态，未登录时重定向到 `/login`，已登录时重定向到 `/memos`（Memo 列表页，后续迭代新增） |

**设计说明**：
- Expo Router 使用文件系统路由，`app/register.jsx` 对应路径 `/register`，`app/login.jsx` 对应路径 `/login`。
- `index.jsx` 充当路由守卫入口，避免未登录用户直接访问业务页面。
- 所有认证页面不渲染底部导航栏（Tab Bar），通过 Expo Router 的布局文件控制。

---

### 4.2 新增组件列表

#### 4.2.1 `AuthFormInput` — 通用表单输入框

**文件路径**: `apps/mobile/components/AuthFormInput.jsx`
**Export 方式**: 具名 export `export function AuthFormInput`

**职责**: 封装注册/登录表单中单个输入字段的完整 UI 逻辑，包含标签、输入框、错误提示文字和聚焦/错误边框样式切换。

**Props 列表**:

| Props 名称 | 类型 | 必填 | 说明 |
|-----------|------|------|------|
| `label` | `string` | 是 | 输入框上方的标签文字（如"邮箱"、"昵称"） |
| `value` | `string` | 是 | 输入框当前值，由父组件受控 |
| `onChangeText` | `function` | 是 | 文字变更回调，签名 `(text: string) => void` |
| `onBlur` | `function` | 否 | 失焦回调，供注册页触发字段级验证，签名 `() => void` |
| `error` | `string \| null` | 否 | 字段级错误文字；有值时输入框边框变红并在下方展示红色提示，无值时隐藏提示区域 |
| `placeholder` | `string` | 否 | 输入框占位文字 |
| `keyboardType` | `string` | 否 | React Native `TextInput` 的 `keyboardType`，默认 `'default'`，邮箱字段传 `'email-address'` |
| `autoCapitalize` | `string` | 否 | 首字母大写策略，默认 `'sentences'`，邮箱字段传 `'none'` |
| `disabled` | `boolean` | 否 | 为 `true` 时输入框禁用（提交加载期间），默认 `false` |
| `testID` | `string` | 否 | E2E 测试选择器标识符 |

**负责的用户交互**:
- 聚焦时输入框边框变为蓝色高亮
- 失焦时触发 `onBlur` 回调（父组件执行字段验证逻辑）
- `error` prop 不为空时，输入框边框变红并在下方渲染红色错误文字
- `disabled` 为 `true` 时，输入框视觉置灰且不响应用户输入

---

#### 4.2.2 `PasswordInput` — 密码输入框（含明密文切换）

**文件路径**: `apps/mobile/components/PasswordInput.jsx`
**Export 方式**: 具名 export `export function PasswordInput`

**职责**: 继承 `AuthFormInput` 的全部能力，额外管理密码明文/密文显示状态，在输入框右侧渲染眼睛图标切换按钮。

**Props 列表**:

| Props 名称 | 类型 | 必填 | 说明 |
|-----------|------|------|------|
| `label` | `string` | 是 | 标签文字，通常为"密码" |
| `value` | `string` | 是 | 密码当前值，由父组件受控 |
| `onChangeText` | `function` | 是 | 文字变更回调，签名 `(text: string) => void` |
| `onBlur` | `function` | 否 | 失焦回调，触发字段验证 |
| `error` | `string \| null` | 否 | 字段级错误文字 |
| `placeholder` | `string` | 否 | 占位文字，默认"请输入密码" |
| `disabled` | `boolean` | 否 | 禁用状态，默认 `false` |
| `testID` | `string` | 否 | E2E 测试选择器标识符 |

**负责的用户交互**:
- 默认以密文（`secureTextEntry={true}`）显示输入内容
- 点击右侧眼睛图标，切换为明文显示；再次点击恢复密文显示
- 内部维护 `visible` 布尔状态，不暴露给父组件

---

#### 4.2.3 `FormErrorBanner` — 表单顶部错误提示横幅

**文件路径**: `apps/mobile/components/FormErrorBanner.jsx`
**Export 方式**: 具名 export `export function FormErrorBanner`

**职责**: 在表单顶部显示服务端返回的全局错误信息（如"该邮箱已被注册"、"邮箱或密码错误"），与字段级错误提示互补。`message` 为 null 或空字符串时不渲染任何内容（高度折叠为零，避免布局抖动）。

**Props 列表**:

| Props 名称 | 类型 | 必填 | 说明 |
|-----------|------|------|------|
| `message` | `string \| null` | 是 | 错误文字；空值时组件不渲染 |
| `testID` | `string` | 否 | E2E 测试选择器标识符 |

**负责的用户交互**: 无交互，纯展示组件。

---

#### 4.2.4 `PrivacyCheckbox` — 隐私协议勾选框

**文件路径**: `apps/mobile/components/PrivacyCheckbox.jsx`
**Export 方式**: 具名 export `export function PrivacyCheckbox`

**职责**: 渲染隐私协议勾选控件，包含勾选框 + "我已阅读并同意隐私协议"文本。未勾选且尝试提交时，通过 `error` prop 展示红色高亮提示。

**Props 列表**:

| Props 名称 | 类型 | 必填 | 说明 |
|-----------|------|------|------|
| `checked` | `boolean` | 是 | 当前勾选状态，由父组件受控 |
| `onChange` | `function` | 是 | 状态切换回调，签名 `(checked: boolean) => void` |
| `error` | `string \| null` | 否 | 未勾选时触发的错误提示文字 |
| `disabled` | `boolean` | 否 | 提交加载期间禁用，默认 `false` |
| `testID` | `string` | 否 | E2E 测试选择器标识符 |

**负责的用户交互**:
- 点击勾选框或文本区域均可切换选中状态
- `error` 不为空时，勾选框边框高亮红色，并在下方显示错误提示文字

---

#### 4.2.5 `SubmitButton` — 表单提交按钮

**文件路径**: `apps/mobile/components/SubmitButton.jsx`
**Export 方式**: 具名 export `export function SubmitButton`

**职责**: 统一封装注册/登录的提交按钮，管理加载状态下的文字切换和禁用逻辑。

**Props 列表**:

| Props 名称 | 类型 | 必填 | 说明 |
|-----------|------|------|------|
| `label` | `string` | 是 | 正常状态的按钮文字（如"注册"、"登录"） |
| `loadingLabel` | `string` | 是 | 加载状态的按钮文字（如"注册中..."、"登录中..."） |
| `loading` | `boolean` | 是 | 是否处于加载状态 |
| `onPress` | `function` | 是 | 按钮点击回调，签名 `() => void` |
| `disabled` | `boolean` | 否 | 额外禁用控制（如表单有错误时），默认 `false` |
| `testID` | `string` | 否 | E2E 测试选择器标识符 |

**负责的用户交互**:
- `loading` 为 `true` 时显示 `loadingLabel`，按钮置灰禁用，防止重复提交
- `loading` 为 `false` 且 `disabled` 为 `false` 时，按钮可点击并触发 `onPress`

---

### 4.3 Context / Reducer 变更

#### 4.3.1 新增文件：`apps/mobile/context/auth-context.js`

**职责**: 维护全局用户认证状态，向全应用暴露当前登录用户信息和身份操作方法。

**State 结构**:

```js
{
  user: {          // 当前登录用户，未登录时为 null
    id: string,        // UUID
    email: string,
    nickname: string,
  } | null,
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated',
  // 'idle'            — 初始状态，尚未执行 /api/auth/me 检查
  // 'loading'         — 正在调用 /api/auth/me 恢复 session
  // 'authenticated'   — 已确认登录
  // 'unauthenticated' — 已确认未登录（/api/auth/me 返回 401 或无 session）
}
```

**新增 Action Type**:

| Action Type | Payload | 触发时机 |
|-------------|---------|---------|
| `AUTH_LOADING` | 无 | 应用启动时调用 `/api/auth/me` 前 |
| `AUTH_SUCCESS` | `{ user: { id, email, nickname } }` | `/api/auth/me`、登录、注册成功后 |
| `AUTH_FAILURE` | 无 | `/api/auth/me` 返回 401，或登录/注册失败后（仅清除 user，不弹错误） |
| `AUTH_LOGOUT` | 无 | 用户主动登出成功后 |

**暴露的 Context Value**:

```js
{
  user,          // 当前用户对象或 null
  status,        // 认证状态字符串
  login,         // async (email, password) => { data, error }
  register,      // async (email, nickname, password) => { data, error }
  logout,        // async () => void
  checkAuth,     // async () => void — 应用启动时调用，恢复 session
}
```

**Provider 放置位置**: `apps/mobile/app/_layout.jsx` 的根 Provider 层，包裹所有路由。

---

### 4.4 自定义 Hook 变更

#### 4.4.1 新增 Hook：`apps/mobile/hooks/use-auth.js`

**职责**: 封装对 `AuthContext` 的访问，提供类型安全的 context 消费方式，并在 Context 未挂载时抛出明确错误信息。

**入参**: 无

**返回值**:

```js
{
  user,          // { id, email, nickname } | null
  status,        // 'idle' | 'loading' | 'authenticated' | 'unauthenticated'
  login,         // async (email, password) => { data, error }
  register,      // async (email, nickname, password) => { data, error }
  logout,        // async () => void
  checkAuth,     // async () => void
  isAuthenticated, // boolean — status === 'authenticated' 的语法糖
  isLoading,       // boolean — status === 'loading' || status === 'idle' 的语法糖
}
```

**使用示例**:

```js
// 在 Screen 或组件中使用
import { useAuth } from '../hooks/use-auth';

function RegisterScreen() {
  const { register, status } = useAuth();
  // ...
}
```

---

### 4.5 用户交互流程

#### 4.5.1 注册流程

```
用户访问 /register
  └─► RegisterScreen 渲染
        ├─► 显示：邮箱输入框、昵称输入框、密码输入框（眼睛图标）、
        │         隐私协议勾选框、"注册"按钮、"已有账号？返回登录"链接
        │
        ├─► 用户填写邮箱 → onBlur → 格式验证（正则）
        │     ├─► 格式无效：AuthFormInput 显示红色错误文字"请输入有效的邮箱地址"
        │     └─► 格式有效：清除错误状态
        │
        ├─► 用户填写昵称 → onBlur → 长度验证（2-20 字符）
        │     ├─► 不符合：显示"昵称长度为 2-20 个字符"
        │     └─► 符合：清除错误状态；输入超过 20 字符时 maxLength 直接阻止继续输入
        │
        ├─► 用户填写密码 → onBlur → 长度验证（8-20 字符）
        │     ├─► 不符合：PasswordInput 显示"密码长度至少为 8 个字符"
        │     └─► 符合：清除错误状态
        │
        ├─► 用户勾选隐私协议 → PrivacyCheckbox checked=true
        │
        ├─► 用户点击"注册"按钮
        │     ├─► 前端整体校验（若有字段未填或存在错误，显示对应错误，阻止提交）
        │     ├─► 未勾选隐私协议：PrivacyCheckbox 高亮红色 + 错误提示
        │     └─► 全部校验通过：
        │           ├─► SubmitButton loading=true（文字变"注册中..."，禁用）
        │           ├─► 所有输入框 disabled=true
        │           ├─► 调用 AuthContext.register(email, nickname, password)
        │           │     └─► POST /api/auth/register
        │           ├─► 成功（201）：
        │           │     ├─► dispatch AUTH_SUCCESS({ user })
        │           │     └─► router.replace('/') → 重定向到 Memo 列表
        │           └─► 失败：
        │                 ├─► SubmitButton loading=false（恢复可点击）
        │                 ├─► 所有输入框恢复可编辑
        │                 └─► FormErrorBanner 展示服务端 error 字段内容
        │
        └─► 用户点击"返回登录"链接
              └─► 清空所有表单状态 → router.push('/login')
```

#### 4.5.2 登录流程

```
用户访问 /login（或未登录状态下被路由守卫重定向至此）
  └─► LoginScreen 渲染
        ├─► 显示：邮箱输入框、密码输入框（眼睛图标）、
        │         "登录"按钮、"没有账号？立即注册"链接
        │
        ├─► 用户填写邮箱、密码（仅提交时验证，无 onBlur 验证）
        │
        ├─► 用户点击"登录"按钮
        │     ├─► SubmitButton loading=true（文字变"登录中..."，禁用）
        │     ├─► 所有输入框 disabled=true
        │     ├─► 调用 AuthContext.login(email, password)
        │     │     └─► POST /api/auth/login
        │     ├─► 成功（200）：
        │     │     ├─► dispatch AUTH_SUCCESS({ user })
        │     │     └─► router.replace('/') → 重定向到 Memo 列表
        │     └─► 失败（401）：
        │           ├─► SubmitButton loading=false（恢复可点击）
        │           ├─► 邮箱输入框保持原内容
        │           ├─► 密码输入框内容清空（value 置空）
        │           ├─► 所有输入框恢复可编辑
        │           └─► FormErrorBanner 展示"邮箱或密码错误，请重试"
        │
        └─► 用户点击"立即注册"链接
              └─► 清空所有表单状态 → router.push('/register')
```

#### 4.5.3 Session 恢复流程（应用启动）

```
应用启动 → _layout.jsx 中 AuthProvider 初始化
  └─► useEffect → checkAuth()
        ├─► dispatch AUTH_LOADING（status = 'loading'）
        ├─► GET /api/auth/me
        ├─► 成功（200，有 Cookie）：
        │     ├─► dispatch AUTH_SUCCESS({ user })
        │     └─► 路由守卫允许访问业务页面
        └─► 失败（401，无有效 Session）：
              ├─► dispatch AUTH_FAILURE（status = 'unauthenticated'）
              └─► 路由守卫将用户重定向到 /login
```

#### 4.5.4 Session 过期处理

```
用户在已登录状态下操作任意业务接口
  └─► API Client 收到 401 响应
        ├─► dispatch AUTH_LOGOUT / AUTH_FAILURE
        └─► 提示"登录已过期，请重新登录"
              └─► router.replace('/login')
```

---

### 4.6 调用的 API 端点

以下端点由前端 `apps/mobile/lib/api-client.js` 中的函数封装并调用，路径遵循 REST 惯例，与 architect 数据模型一致。

#### `POST /api/auth/register` — 用户注册

**调用时机**: 注册页面表单校验通过后

**请求 Body**:
```json
{
  "email": "user@example.com",
  "nickname": "张三",
  "password": "mypassword123"
}
```

**响应 — 成功 (201)**:
```json
{
  "data": {
    "user": {
      "id": "uuid-string",
      "email": "user@example.com",
      "nickname": "张三"
    }
  },
  "message": "注册成功"
}
```

**响应 — 失败 (409，邮箱重复)**:
```json
{
  "data": null,
  "error": "该邮箱已被注册",
  "message": "注册失败"
}
```

**响应 — 失败 (400，参数校验失败)**:
```json
{
  "data": null,
  "error": "请输入有效的邮箱地址",
  "message": "参数错误"
}
```

**前端处理**: 成功后 Session Cookie 由浏览器自动保存（`httpOnly`），前端从 `data.user` 取用户信息写入 `AuthContext`。

---

#### `POST /api/auth/login` — 用户登录

**调用时机**: 登录页面点击"登录"按钮后

**请求 Body**:
```json
{
  "email": "user@example.com",
  "password": "mypassword123"
}
```

**响应 — 成功 (200)**:
```json
{
  "data": {
    "user": {
      "id": "uuid-string",
      "email": "user@example.com",
      "nickname": "张三"
    }
  },
  "message": "登录成功"
}
```

**响应 — 失败 (401)**:
```json
{
  "data": null,
  "error": "邮箱或密码错误，请重试",
  "message": "登录失败"
}
```

**前端处理**: 失败时密码输入框清空，`FormErrorBanner` 展示 `error` 字段内容。

---

#### `POST /api/auth/logout` — 用户登出

**调用时机**: 用户点击登出按钮（业务页面，后续迭代实现）

**请求 Body**: 无

**响应 — 成功 (200)**:
```json
{
  "data": null,
  "message": "已退出登录"
}
```

**前端处理**: 成功后 dispatch `AUTH_LOGOUT`，`router.replace('/login')`。

---

#### `GET /api/auth/me` — 获取当前登录用户信息

**调用时机**: 应用启动时（`AuthProvider` 的 `useEffect` 中），用于恢复 Session 登录状态

**请求 Body**: 无（通过 Cookie 自动携带 Session ID）

**响应 — 成功 (200，有有效 Session)**:
```json
{
  "data": {
    "user": {
      "id": "uuid-string",
      "email": "user@example.com",
      "nickname": "张三"
    }
  },
  "message": "ok"
}
```

**响应 — 失败 (401，无有效 Session)**:
```json
{
  "data": null,
  "error": "未登录",
  "message": "请先登录"
}
```

**前端处理**: 401 时触发 `AUTH_FAILURE`，路由守卫将用户重定向到 `/login`。

---

### 4.7 文件新增汇总

| 类型 | 文件路径 | 说明 |
|------|---------|------|
| Screen | `apps/mobile/app/index.jsx` | 根路由守卫（按认证状态重定向） |
| Screen | `apps/mobile/app/login.jsx` | 登录页面 |
| Screen | `apps/mobile/app/register.jsx` | 注册页面 |
| Screen | `apps/mobile/app/_layout.jsx` | 根布局，挂载 AuthProvider |
| Component | `apps/mobile/components/AuthFormInput.jsx` | 通用表单输入框 |
| Component | `apps/mobile/components/PasswordInput.jsx` | 密码输入框（含明密文切换） |
| Component | `apps/mobile/components/FormErrorBanner.jsx` | 表单顶部全局错误提示 |
| Component | `apps/mobile/components/PrivacyCheckbox.jsx` | 隐私协议勾选控件 |
| Component | `apps/mobile/components/SubmitButton.jsx` | 表单提交按钮（含加载状态） |
| Context | `apps/mobile/context/auth-context.js` | 全局认证状态 Context + Reducer |
| Hook | `apps/mobile/hooks/use-auth.js` | AuthContext 消费 Hook |
| API Client | `apps/mobile/lib/api-client.js` | HTTP 请求封装（若已存在则新增 auth 相关函数） |

---

### 4.8 设计决策与注意事项

1. **路由守卫实现方式**: 使用 Expo Router 的 `app/index.jsx` + `useAuth().status` 实现路由守卫，`status === 'loading' || status === 'idle'` 时渲染全屏 Loading 占位（`ActivityIndicator`），避免路由重定向闪烁（FOUC）。

2. **API Client 的 401 全局拦截**: `apps/mobile/lib/api-client.js` 中封装 `fetchWithAuth` 函数，统一处理 401 响应 — 捕获后 dispatch `AUTH_FAILURE` 并跳转登录页，覆盖 Session 过期场景。

3. **表单状态隔离**: 注册页和登录页各自独立维护本地表单状态（`useState`），不写入全局 Context。全局 Context 只存储认证结果（user + status），表单中间状态不共享。

4. **昵称最大长度限制**: `AuthFormInput` 的 `maxLength` prop 传 `20`，由 React Native `TextInput` 在 UI 层直接阻止超长输入，配合 `onBlur` 提示形成双重保护。

5. **Cookie 跨域配置**: Web 平台下，`api-client.js` 的 `fetch` 调用需设置 `credentials: 'include'`，以确保 `httpOnly` Session Cookie 随请求自动发送。Native 平台（Android/iOS）依赖 Expo 的 Cookie 支持，由 `@react-native-cookies/cookies` 或 Expo 内置机制处理（MVP 阶段以 Web 为主要目标平台）。

6. **密码不进入 AuthContext**: 密码字段仅存在于页面本地 `useState`，提交后立即丢弃，绝不写入 Context 或持久化存储，防止内存中的敏感数据泄露。

---

*本文件由 frontend-developer subagent 自动生成，内容以 spec 文档和 architect 输出为准。如有歧义请在 Issue #43 中补充说明。*

---

## §5 改动文件清单

### 新增

**后端**:

| 文件路径 | 说明 |
|---------|------|
| `apps/server/src/routes/auth.js` | 认证路由 Plugin，包含 register / login / logout / me 四个端点 |
| `apps/server/src/plugins/auth.js` | `requireAuth` preHandler（若尚未存在） |
| `apps/server/src/plugins/session.js` | `@fastify/session` + `@fastify/cookie` 初始化（若尚未存在） |
| `apps/server/src/lib/errors.js` | `AppError` / `NotFoundError` 错误类（若尚未存在） |

**前端**:

| 文件路径 | 说明 |
|---------|------|
| `apps/mobile/app/register.jsx` | 注册页面（Screen） |
| `apps/mobile/app/login.jsx` | 登录页面（Screen） |
| `apps/mobile/app/index.jsx` | 根路由守卫，按认证状态重定向 |
| `apps/mobile/components/AuthFormInput.jsx` | 通用表单输入框组件 |
| `apps/mobile/components/PasswordInput.jsx` | 密码输入框组件（含明密文切换） |
| `apps/mobile/components/FormErrorBanner.jsx` | 表单顶部服务端错误提示横幅 |
| `apps/mobile/components/PrivacyCheckbox.jsx` | 隐私协议勾选控件 |
| `apps/mobile/components/SubmitButton.jsx` | 表单提交按钮（含加载状态） |
| `apps/mobile/context/auth-context.js` | 全局认证状态 Context + Reducer |
| `apps/mobile/hooks/use-auth.js` | AuthContext 消费 Hook，暴露 `isAuthenticated` / `isLoading` 语法糖 |

### 修改

**后端**:

| 文件路径 | 具体改动 |
|---------|---------|
| `apps/server/src/db/schema.js` | 新增 `users` 表定义；确认 `memos` / `tags` / `memo_tags` 表的 `user_id` 外键 `.references(() => users.id, { onDelete: 'cascade' })` 已正确设置 |
| `apps/server/src/index.js` | 注册 `authRoutes` Plugin，添加 `await app.register(authRoutes, { prefix: '/api/auth' })` |

**前端**:

| 文件路径 | 具体改动 |
|---------|---------|
| `apps/mobile/app/_layout.jsx` | 根布局挂载 `AuthProvider`（若已存在则修改，否则新建），包裹所有路由 |
| `apps/mobile/lib/api-client.js` | 新增 `authRegister` / `authLogin` / `authLogout` / `authMe` 四个函数；确认 `fetch` 请求已设置 `credentials: 'include'` |

---

## §6 技术约束与风险

### 6.1 输入校验

| 字段 | 前端校验时机 | 规则 | 后端 Schema 约束 |
|------|------------|------|----------------|
| `email` | 注册：失焦（blur）；登录：提交时 | 标准邮箱格式（正则）、非空 | `format: 'email'`、`maxLength: 254` |
| `nickname` | 注册：失焦（blur） | 长度 2-20 字符；`maxLength` 属性直接阻止超长输入 | `minLength: 2`、`maxLength: 20` |
| `password` | 注册：失焦（blur）；登录：不校验长度（避免泄露规则） | 注册时 8-20 字符 | 注册：`minLength: 8`、`maxLength: 20`；登录：`minLength: 1`、`maxLength: 20` |
| `privacyAgreed` | 注册：提交时检查 | 必须勾选（`true`） | `type: 'boolean'`、`enum: [true]` |

### 6.2 安全约束

- **XSS 防护**：昵称、邮箱均作为纯文本渲染，不允许 HTML 注入；React Native 的 `Text` 组件不解析 HTML，Web 渲染时需确保未使用 `dangerouslySetInnerHTML`。
- **认证边界**：所有业务端点（memos、tags 等）须通过 `requireAuth` preHandler 保护；本次新增的 `/api/auth/logout` 和 `/api/auth/me` 也使用 `requireAuth`，未登录调用返回 401。
- **密码安全**：bcrypt cost factor 12，哈希耗时约 200-400ms（单线程 Node.js），高并发下需留意阻塞问题，生产环境可考虑 `bcrypt.hash` 异步调用或 worker 线程。
- **Session Cookie**：必须设置 `httpOnly: true`、`sameSite: 'strict'`，生产环境 `secure: true`；session secret 须通过环境变量注入，不得硬编码。

### 6.3 性能约束

- **邮箱唯一索引**：`users.email` 的 `unique()` 约束在 SQLite 中自动创建唯一索引，注册时的邮箱查询为 O(log n)，可接受。
- **bcrypt 阻塞风险**：cost factor 12 的 hash 计算约 200-400ms，MVP 阶段流量低，可接受；若未来 QPS 上升，考虑将 bcrypt 移至独立 worker 或降低 cost factor。
- **Session 内存存储**：MVP 阶段使用内存 session store，重启服务器会导致所有用户 Session 失效（需重新登录）。如需持久化，切换至 `better-sqlite3` 文件 store 或 Redis。
- **N+1 查询**：本次无列表查询，无 N+1 风险。

### 6.4 兼容性风险

- **响应格式差异**：§3（backend）成功响应用户数据直接置于 `data` 字段（如 `data.id`），§4（frontend）部分示例期望 `data.user`（嵌套结构）。实现时前端须与后端实际响应格式对齐，以 §3 为准，前端从 `response.data` 直接取 `id`、`email`、`nickname` 字段，不经过 `data.user` 中间层。
- **现有表外键**：若 `memos`、`tags` 表已存在于 schema 但未包含 `user_id` 外键，本次迁移需同时补充外键约束，迁移前需备份数据库。
- **`_layout.jsx` 改动**：若根布局已有其他 Provider（如 ThemeProvider），需确保 `AuthProvider` 包裹在最外层，避免 Context 层级问题。
- **`apps/mobile/lib/api-client.js`**：若已存在 API client 文件，需在现有基础上追加 auth 相关函数，不得替换已有接口。

---

## §7 不包含（范围边界）

1. **密码重置/找回功能** — 本次不提供"忘记密码"入口，登录失败提示中不显示密码找回链接，后续迭代单独处理。
2. **邮箱验证（发送确认邮件）** — 注册时仅做格式校验（正则 + Schema），不发送验证邮件、不要求邮箱激活，以降低 MVP 复杂度。
3. **账号注销功能** — 不提供账号永久删除接口；级联删除 Schema 设计仅为后续迭代预留，本次不实现删除账号的业务逻辑。
4. **OAuth / 第三方登录** — 不涉及 Google、GitHub、微信等第三方身份提供商，所有认证通过自有邮箱+密码完成。
5. **"记住我" / 自定义 Session 时长** — 所有用户统一使用 7 天 Session 有效期，不提供可配置选项。
6. **登录频率限制（防暴力破解）** — 短时间内不限制重试次数，不实现账号锁定机制；后续根据安全需求单独迭代。
7. **头像上传 / 个人资料编辑** — 注册时不支持设置头像，不提供昵称、邮箱的后续修改入口；用户 profile 页留待后续迭代。
