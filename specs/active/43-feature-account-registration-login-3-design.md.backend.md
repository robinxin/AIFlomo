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
