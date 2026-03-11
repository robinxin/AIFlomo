# §3 API 端点设计 — 账号注册与登录（Issue #43）

> 作者: backend-developer subagent
> 日期: 2026-03-11
> 依赖: specs/active/43-feature-account-registration-login-3-design.md.architect.md（§2 数据模型）

---

## 概览

本次新增 4 个认证端点，全部挂载在 `apps/server/src/routes/auth.js` 下，通过 `prefix: '/api/auth'` 注册到 Fastify 实例。端点清单：

| 方法 | 路径 | 鉴权 | 职责 |
|------|------|------|------|
| POST | /api/auth/register | 不需要 | 新用户注册，注册成功后自动写入 Session |
| POST | /api/auth/login | 不需要 | 已注册用户登录，验证通过后写入 Session |
| POST | /api/auth/logout | 需要 | 销毁当前 Session，清除 Cookie |
| GET  | /api/auth/me | 需要 | 返回当前登录用户信息（用于前端恢复登录状态） |

---

## 3.1 POST /api/auth/register

**路径**: `POST /api/auth/register`
**文件**: `apps/server/src/routes/auth.js`
**鉴权**: 不需要（`preHandler` 不挂载 `requireAuth`）

### 请求验证 JSON Schema

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

### 业务逻辑（实现要点）

1. 查询数据库确认 `email` 未被使用（Drizzle 参数化查询）
2. 若已存在，抛出 `ConflictError`（409）
3. 调用 `src/lib/password.js` 的 `hashPassword(password)` 生成 `passwordHash`（bcrypt，cost 12）
4. 记录 `agreedToPrivacyAt = new Date().toISOString()`
5. 向 `users` 表插入记录，使用 `.returning()` 取回 `id`、`email`、`nickname`、`createdAt`
6. 写入 Session：`request.session.userId = newUser.id`
7. 调用 `request.session.save()` 持久化 Session
8. 响应 201，返回用户信息（**不含** `passwordHash`）

### 成功响应（HTTP 201）

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

Set-Cookie 响应头示例（由 @fastify/session 自动注入）：
```
Set-Cookie: sessionId=<hash>; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800
```

### 失败响应清单

| HTTP 状态码 | error 字段 | message 字段 | 触发条件 |
|------------|-----------|-------------|---------|
| 400 | `VALIDATION_ERROR` | `请求参数不合法` | JSON Schema 校验不通过（格式错误、字段缺失、agreedToPrivacy 为 false） |
| 409 | `CONFLICT` | `该邮箱已被注册` | email 已存在于 users 表 |
| 500 | `INTERNAL_ERROR` | `服务器内部错误` | 数据库写入异常或其他未预期错误 |

### 失败响应示例（409）

```json
{
  "data": null,
  "error": "CONFLICT",
  "message": "该邮箱已被注册"
}
```

---

## 3.2 POST /api/auth/login

**路径**: `POST /api/auth/login`
**文件**: `apps/server/src/routes/auth.js`
**鉴权**: 不需要（`preHandler` 不挂载 `requireAuth`）

### 请求验证 JSON Schema

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

### 业务逻辑（实现要点）

1. 通过 `email` 从 `users` 表查询用户（Drizzle 参数化查询）
2. 若用户不存在，**不得暴露"邮箱不存在"**，统一返回 `UnauthorizedError`（401），message 为 "邮箱或密码错误，请重试"（FR-007 安全要求）
3. 调用 `src/lib/password.js` 的 `verifyPassword(password, user.passwordHash)` 进行 bcrypt 比对
4. 比对失败，同上返回 `UnauthorizedError`（401）
5. 比对成功，写入 Session：`request.session.userId = user.id`
6. 调用 `request.session.save()` 持久化
7. 响应 200，返回用户信息（**不含** `passwordHash`）

### 成功响应（HTTP 200）

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

Set-Cookie 响应头示例（由 @fastify/session 自动注入）：
```
Set-Cookie: sessionId=<hash>; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800
```

### 失败响应清单

| HTTP 状态码 | error 字段 | message 字段 | 触发条件 |
|------------|-----------|-------------|---------|
| 400 | `VALIDATION_ERROR` | `请求参数不合法` | JSON Schema 校验不通过（字段缺失、格式错误） |
| 401 | `UNAUTHORIZED` | `邮箱或密码错误，请重试` | 邮箱不存在或密码比对失败（故意合并，防枚举攻击） |
| 500 | `INTERNAL_ERROR` | `服务器内部错误` | 数据库查询异常或 bcrypt 执行异常 |

### 失败响应示例（401）

```json
{
  "data": null,
  "error": "UNAUTHORIZED",
  "message": "邮箱或密码错误，请重试"
}
```

---

## 3.3 POST /api/auth/logout

**路径**: `POST /api/auth/logout`
**文件**: `apps/server/src/routes/auth.js`
**鉴权**: 需要，挂载 `preHandler: [requireAuth]`

### 请求验证 JSON Schema

无请求体，无需 Schema。

### 业务逻辑（实现要点）

1. `requireAuth` preHandler 确保用户已登录（未登录直接 401，不进入 handler）
2. 调用 `request.session.destroy()` 销毁 Session（同步清除 SQLite session store 中的记录）
3. 响应 200

### 成功响应（HTTP 200）

```json
{
  "data": null,
  "message": "已退出登录"
}
```

浏览器收到响应后，`Set-Cookie` 会将 sessionId Cookie 的 `Max-Age` 置为 0（由 @fastify/session 自动处理）。

### 失败响应清单

| HTTP 状态码 | error 字段 | message 字段 | 触发条件 |
|------------|-----------|-------------|---------|
| 401 | `UNAUTHORIZED` | `请先登录` | 未携带有效 Session Cookie（由 `requireAuth` preHandler 返回） |
| 500 | `INTERNAL_ERROR` | `服务器内部错误` | Session 销毁异常 |

### 失败响应示例（401）

```json
{
  "data": null,
  "error": "UNAUTHORIZED",
  "message": "请先登录"
}
```

---

## 3.4 GET /api/auth/me

**路径**: `GET /api/auth/me`
**文件**: `apps/server/src/routes/auth.js`
**鉴权**: 需要，挂载 `preHandler: [requireAuth]`

### 请求验证 JSON Schema

无请求体和路径参数，无需 Schema。

### 业务逻辑（实现要点）

1. `requireAuth` preHandler 确保 `request.session.userId` 存在（Session 有效）
2. 通过 `request.session.userId` 从 `users` 表查询用户完整信息（Drizzle 参数化查询）
3. 若数据库中用户记录不存在（账号被删除但 Session 未过期），销毁 Session 并返回 401
4. 响应 200，返回用户信息（**不含** `passwordHash`）

### 成功响应（HTTP 200）

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

### 失败响应清单

| HTTP 状态码 | error 字段 | message 字段 | 触发条件 |
|------------|-----------|-------------|---------|
| 401 | `UNAUTHORIZED` | `请先登录` | Session 不存在或已过期（由 `requireAuth` preHandler 返回） |
| 401 | `UNAUTHORIZED` | `用户不存在，请重新登录` | Session 有效但对应用户已被删除 |
| 500 | `INTERNAL_ERROR` | `服务器内部错误` | 数据库查询异常 |

### 失败响应示例（Session 有效但用户已删除，401）

```json
{
  "data": null,
  "error": "UNAUTHORIZED",
  "message": "用户不存在，请重新登录"
}
```

---

## 3.5 路由文件完整骨架

```js
// apps/server/src/routes/auth.js
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../plugins/auth.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { ConflictError, UnauthorizedError } from '../lib/errors.js';

// ── JSON Schema 定义 ─────────────────────────────────────────────────────────

const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'nickname', 'password', 'agreedToPrivacy'],
    properties: {
      email: { type: 'string', format: 'email', maxLength: 255 },
      nickname: { type: 'string', minLength: 2, maxLength: 20 },
      password: { type: 'string', minLength: 8, maxLength: 20 },
      agreedToPrivacy: { type: 'boolean', enum: [true] },
    },
    additionalProperties: false,
  },
};

const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', maxLength: 255 },
      password: { type: 'string', minLength: 1, maxLength: 100 },
    },
    additionalProperties: false,
  },
};

// ── 路由 Plugin ──────────────────────────────────────────────────────────────

async function authRoutes(fastify) {
  // POST /api/auth/register
  fastify.post('/register', { schema: registerSchema }, async (request, reply) => {
    const { email, nickname, password, agreedToPrivacy } = request.body;

    const existing = await db.select().from(users).where(eq(users.email, email));
    if (existing.length > 0) {
      throw new ConflictError('该邮箱已被注册');
    }

    const passwordHash = await hashPassword(password);
    const agreedToPrivacyAt = new Date().toISOString();

    const [newUser] = await db
      .insert(users)
      .values({ email, nickname, passwordHash, agreedToPrivacyAt })
      .returning({ id: users.id, email: users.email, nickname: users.nickname, createdAt: users.createdAt });

    request.session.userId = newUser.id;
    await request.session.save();

    return reply.status(201).send({ data: newUser, message: '注册成功' });
  });

  // POST /api/auth/login
  fastify.post('/login', { schema: loginSchema }, async (request, reply) => {
    const { email, password } = request.body;

    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      throw new UnauthorizedError('邮箱或密码错误，请重试');
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError('邮箱或密码错误，请重试');
    }

    request.session.userId = user.id;
    await request.session.save();

    return reply.status(200).send({
      data: { id: user.id, email: user.email, nickname: user.nickname, createdAt: user.createdAt },
      message: '登录成功',
    });
  });

  // POST /api/auth/logout
  fastify.post('/logout', { preHandler: [requireAuth] }, async (request, reply) => {
    await request.session.destroy();
    return reply.status(200).send({ data: null, message: '已退出登录' });
  });

  // GET /api/auth/me
  fastify.get('/me', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.session.userId;

    const [user] = await db.select({
      id: users.id,
      email: users.email,
      nickname: users.nickname,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.id, userId));

    if (!user) {
      await request.session.destroy();
      throw new UnauthorizedError('用户不存在，请重新登录');
    }

    return reply.status(200).send({ data: user, message: 'ok' });
  });
}

export { authRoutes };
```

---

## 3.6 新增错误类（src/lib/errors.js 补充）

在现有 `AppError`、`NotFoundError`、`ForbiddenError` 基础上，补充以下两个错误类：

```js
// src/lib/errors.js（追加）

export class UnauthorizedError extends AppError {
  constructor(message = '请先登录') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class ConflictError extends AppError {
  constructor(message = '资源已存在') {
    super(409, message, 'CONFLICT');
  }
}
```

---

## 3.7 密码工具（src/lib/password.js）

```js
// src/lib/password.js
// 使用 Node.js 内置 crypto 实现 bcrypt 等效的安全哈希
// 实际实现依赖 bcryptjs（纯 JS，无需原生扩展）

import bcrypt from 'bcryptjs';

const COST_FACTOR = 12;

/**
 * 对明文密码进行哈希
 * @param {string} plainPassword
 * @returns {Promise<string>} bcrypt 哈希字符串
 */
export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, COST_FACTOR);
}

/**
 * 验证明文密码与哈希值是否匹配
 * @param {string} plainPassword
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}
```

> 注意：`bcryptjs` 已在 architect 阶段的技术方案中确认为允许使用的依赖，无需新增额外 npm 包（使用项目已有的或通过标准方式引入）。

---

## 3.8 在 index.js 注册 authRoutes

```js
// src/index.js（追加 authRoutes 注册，插在其他路由前）
import { authRoutes } from './routes/auth.js';

await app.register(authRoutes, { prefix: '/api/auth' });
```

---

## 3.9 安全设计说明

| 安全点 | 实现方式 |
|--------|---------|
| 密码存储 | bcrypt 哈希（cost 12），不存明文 |
| 防枚举攻击 | 邮箱不存在与密码错误返回相同 401 响应体 |
| Session 安全 | `httpOnly: true`、`sameSite: 'strict'`、生产环境 `secure: true`、7 天有效期 |
| 输入验证 | Fastify 原生 JSON Schema（ajv），每个字段严格约束类型、长度、格式 |
| SQL 注入防御 | 全程 Drizzle ORM 参数化查询，禁止字符串拼接 |
| XSS 防御 | API 层纯 JSON 响应，无 HTML 渲染；nickname 仅限长度约束，展示层纯文本渲染 |
| 响应不泄露密码哈希 | `.returning()` 和 `.select()` 均明确列出字段，排除 `passwordHash` |
