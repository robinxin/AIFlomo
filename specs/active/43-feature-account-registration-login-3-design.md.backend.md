# §3 API 端点设计 — 账号注册与登录

> 本文件由 backend-developer subagent 生成，仅包含 §3 API 端点设计内容。
> 对应功能规格：specs/active/43-feature-account-registration-login-3.md
> 依赖数据模型：architect 定义的 users 表（见 §2）

---

## 3. API 端点设计

### 概述

| 端点 | HTTP 方法 | 鉴权 | 功能 |
|------|-----------|------|------|
| `/api/auth/register` | POST | 不需要 | 用户注册 |
| `/api/auth/login` | POST | 不需要 | 用户登录 |
| `/api/auth/logout` | POST | 需要 | 用户登出 |
| `/api/auth/me` | GET | 需要 | 获取当前登录用户信息 |

所有路由实现于：`apps/server/src/routes/auth.js`

---

### 3.1 用户注册

**路径 + HTTP 方法**：`POST /api/auth/register`

**对应文件路径**：`apps/server/src/routes/auth.js`

**鉴权**：不需要（`preHandler` 不加 `requireAuth`）

#### 请求验证 JSON Schema

```js
const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'nickname', 'password', 'privacyAgreed'],
    additionalProperties: false,
    properties: {
      email: {
        type: 'string',
        format: 'email',
        maxLength: 254,
        minLength: 5,
        description: '用户邮箱，必须符合标准邮箱格式，唯一',
      },
      nickname: {
        type: 'string',
        minLength: 2,
        maxLength: 20,
        pattern: '^[\\u4e00-\\u9fa5a-zA-Z0-9_-]+$',
        description: '昵称，2-20 字符，允许中文/英文/数字/下划线/连字符，不允许纯空格或特殊符号',
      },
      password: {
        type: 'string',
        minLength: 8,
        maxLength: 20,
        description: '密码，8-20 字符',
      },
      privacyAgreed: {
        type: 'boolean',
        enum: [true],
        description: '用户必须主动同意隐私协议，必须为 true',
      },
    },
  },
};
```

#### 路由实现示例

```js
// apps/server/src/routes/auth.js（片段）
fastify.post('/register', { schema: registerSchema }, async (request, reply) => {
  const { email, nickname, password, privacyAgreed } = request.body;

  // 检查邮箱是否已注册
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return reply.status(409).send({
      data: null,
      error: 'EMAIL_ALREADY_EXISTS',
      message: '该邮箱已被注册',
    });
  }

  // 哈希密码并创建用户
  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(users).values({
    email,
    nickname,
    passwordHash,
    privacyAgreedAt: new Date().toISOString(),
  }).returning({ id: users.id, email: users.email, nickname: users.nickname, createdAt: users.createdAt });

  // 注册成功后自动登录，写入 session
  request.session.userId = user.id;

  return reply.status(201).send({
    data: { id: user.id, email: user.email, nickname: user.nickname, createdAt: user.createdAt },
    message: '注册成功',
  });
});
```

#### 成功响应示例

**HTTP 201 Created**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "nickname": "小明",
    "createdAt": "2026-03-11T10:00:00.000Z"
  },
  "message": "注册成功"
}
```

#### 失败响应清单

| HTTP 状态码 | error 字段 | message 说明 | 触发条件 |
|------------|-----------|-------------|---------|
| 400 | `VALIDATION_ERROR` | 请求参数不合法 | email 格式错误 / nickname 长度或字符不合法 / password 长度不合法 / privacyAgreed 不为 true / 缺少必填字段 |
| 409 | `EMAIL_ALREADY_EXISTS` | 该邮箱已被注册 | 邮箱已存在于数据库 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 | 数据库写入异常或其他未预期错误 |

**失败响应结构示例（409）**

```json
{
  "data": null,
  "error": "EMAIL_ALREADY_EXISTS",
  "message": "该邮箱已被注册"
}
```

---

### 3.2 用户登录

**路径 + HTTP 方法**：`POST /api/auth/login`

**对应文件路径**：`apps/server/src/routes/auth.js`

**鉴权**：不需要（`preHandler` 不加 `requireAuth`）

#### 请求验证 JSON Schema

```js
const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    additionalProperties: false,
    properties: {
      email: {
        type: 'string',
        format: 'email',
        maxLength: 254,
        minLength: 5,
        description: '用户邮箱',
      },
      password: {
        type: 'string',
        minLength: 1,
        maxLength: 20,
        description: '用户密码，仅做非空校验，具体规则由后端哈希比对',
      },
    },
  },
};
```

#### 路由实现示例

```js
// apps/server/src/routes/auth.js（片段）
fastify.post('/login', { schema: loginSchema }, async (request, reply) => {
  const { email, password } = request.body;

  // 查询用户（邮箱不存在与密码错误返回相同提示，防止信息泄露）
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    return reply.status(401).send({
      data: null,
      error: 'INVALID_CREDENTIALS',
      message: '邮箱或密码错误，请重试',
    });
  }

  const isMatch = await verifyPassword(password, user.passwordHash);
  if (!isMatch) {
    return reply.status(401).send({
      data: null,
      error: 'INVALID_CREDENTIALS',
      message: '邮箱或密码错误，请重试',
    });
  }

  // 登录成功，写入 session
  request.session.userId = user.id;

  return reply.status(200).send({
    data: { id: user.id, email: user.email, nickname: user.nickname, createdAt: user.createdAt },
    message: '登录成功',
  });
});
```

#### 成功响应示例

**HTTP 200 OK**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "nickname": "小明",
    "createdAt": "2026-03-11T10:00:00.000Z"
  },
  "message": "登录成功"
}
```

#### 失败响应清单

| HTTP 状态码 | error 字段 | message 说明 | 触发条件 |
|------------|-----------|-------------|---------|
| 400 | `VALIDATION_ERROR` | 请求参数不合法 | email 格式错误 / password 为空 / 缺少必填字段 |
| 401 | `INVALID_CREDENTIALS` | 邮箱或密码错误，请重试 | 邮箱不存在或密码哈希比对不通过（统一提示，不区分具体原因） |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 | 数据库查询异常或其他未预期错误 |

**失败响应结构示例（401）**

```json
{
  "data": null,
  "error": "INVALID_CREDENTIALS",
  "message": "邮箱或密码错误，请重试"
}
```

---

### 3.3 用户登出

**路径 + HTTP 方法**：`POST /api/auth/logout`

**对应文件路径**：`apps/server/src/routes/auth.js`

**鉴权**：需要（`preHandler: [requireAuth]`）

#### 请求验证 JSON Schema

```js
// 无请求体，无需 schema 定义
const logoutSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {},
  },
};
```

#### 路由实现示例

```js
// apps/server/src/routes/auth.js（片段）
fastify.post('/logout', { preHandler: [requireAuth] }, async (request, reply) => {
  await request.session.destroy();
  return reply.status(200).send({
    data: null,
    message: '已成功登出',
  });
});
```

#### 成功响应示例

**HTTP 200 OK**

```json
{
  "data": null,
  "message": "已成功登出"
}
```

#### 失败响应清单

| HTTP 状态码 | error 字段 | message 说明 | 触发条件 |
|------------|-----------|-------------|---------|
| 401 | `Unauthorized` | 请先登录 | 未携带有效 session（由 requireAuth preHandler 返回） |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 | session 销毁异常或其他未预期错误 |

**失败响应结构示例（401）**

```json
{
  "data": null,
  "error": "Unauthorized",
  "message": "请先登录"
}
```

---

### 3.4 获取当前登录用户信息

**路径 + HTTP 方法**：`GET /api/auth/me`

**对应文件路径**：`apps/server/src/routes/auth.js`

**鉴权**：需要（`preHandler: [requireAuth]`）

#### 请求验证 JSON Schema

```js
// 无请求体，无 querystring 参数，无需额外 schema
// Fastify 默认不验证无参数请求
```

#### 路由实现示例

```js
// apps/server/src/routes/auth.js（片段）
fastify.get('/me', { preHandler: [requireAuth] }, async (request, reply) => {
  const userId = request.session.userId;

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      nickname: users.nickname,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    // session 中存在 userId 但数据库找不到用户（账号被删除等异常场景）
    await request.session.destroy();
    return reply.status(401).send({
      data: null,
      error: 'USER_NOT_FOUND',
      message: '用户不存在，请重新登录',
    });
  }

  return reply.status(200).send({
    data: { id: user.id, email: user.email, nickname: user.nickname, createdAt: user.createdAt },
    message: 'ok',
  });
});
```

#### 成功响应示例

**HTTP 200 OK**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "nickname": "小明",
    "createdAt": "2026-03-11T10:00:00.000Z"
  },
  "message": "ok"
}
```

#### 失败响应清单

| HTTP 状态码 | error 字段 | message 说明 | 触发条件 |
|------------|-----------|-------------|---------|
| 401 | `Unauthorized` | 请先登录 | 未携带有效 session（由 requireAuth preHandler 返回） |
| 401 | `USER_NOT_FOUND` | 用户不存在，请重新登录 | session 有效但对应用户已从数据库删除 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 | 数据库查询异常或其他未预期错误 |

**失败响应结构示例（401 未登录）**

```json
{
  "data": null,
  "error": "Unauthorized",
  "message": "请先登录"
}
```

---

### 3.5 完整路由文件结构

```js
// apps/server/src/routes/auth.js
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../plugins/auth.js';
import { hashPassword, verifyPassword } from '../lib/password.js';

// ── JSON Schema 定义 ──────────────────────────────────────────────────────────

const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'nickname', 'password', 'privacyAgreed'],
    additionalProperties: false,
    properties: {
      email: {
        type: 'string',
        format: 'email',
        maxLength: 254,
        minLength: 5,
      },
      nickname: {
        type: 'string',
        minLength: 2,
        maxLength: 20,
        pattern: '^[\\u4e00-\\u9fa5a-zA-Z0-9_-]+$',
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
  },
};

const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    additionalProperties: false,
    properties: {
      email: {
        type: 'string',
        format: 'email',
        maxLength: 254,
        minLength: 5,
      },
      password: {
        type: 'string',
        minLength: 1,
        maxLength: 20,
      },
    },
  },
};

// ── 路由 Plugin ───────────────────────────────────────────────────────────────

async function authRoutes(fastify) {
  // POST /api/auth/register — 用户注册
  fastify.post('/register', { schema: registerSchema }, async (request, reply) => { /* ... */ });

  // POST /api/auth/login — 用户登录
  fastify.post('/login', { schema: loginSchema }, async (request, reply) => { /* ... */ });

  // POST /api/auth/logout — 用户登出（需鉴权）
  fastify.post('/logout', { preHandler: [requireAuth] }, async (request, reply) => { /* ... */ });

  // GET /api/auth/me — 获取当前用户信息（需鉴权）
  fastify.get('/me', { preHandler: [requireAuth] }, async (request, reply) => { /* ... */ });
}

export { authRoutes };
```

---

### 3.6 设计约束与安全说明

| 约束项 | 实现方式 |
|--------|---------|
| 密码不明文存储 | 使用 `hashPassword()` 工具函数（bcrypt 或 Node.js 内置 `crypto.scrypt`）哈希后写入 `password_hash` 列 |
| 登录错误不暴露细节 | 邮箱不存在和密码错误统一返回 `INVALID_CREDENTIALS`，防止邮箱枚举攻击（符合 FR-007） |
| Session Cookie 安全 | `httpOnly: true`、`sameSite: 'strict'`、生产环境 `secure: true`，有效期 7 天（符合 CLAUDE.md 安全红线） |
| 响应不返回 passwordHash | 所有查询使用列选择（`.select({ id, email, nickname, createdAt })`），确保 `password_hash` 字段不出现在任何响应中 |
| privacyAgreed 强制为 true | JSON Schema 中使用 `enum: [true]`，`false` 值会在 Fastify 校验阶段直接拒绝（返回 400） |
| SQL 注入防护 | 全部使用 Drizzle ORM 参数化查询，禁止原生 SQL 字符串拼接（符合 CONSTITUTION.md） |
| 并发注册唯一性 | `email` 列设置 `UNIQUE` 约束，数据库层保证并发场景下只有一个注册成功，竞态失败时捕获唯一约束错误返回 409 |
