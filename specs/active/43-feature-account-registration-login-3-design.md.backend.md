# Backend Output: 账号注册与登录 — §3 API 端点设计

**关联 Spec**: specs/active/43-feature-account-registration-login-3.md
**关联 Issue**: #43
**生成日期**: 2026-03-14
**生成子 Agent**: backend-developer

---

## §3 API 端点设计

本功能新增四条 Fastify 路由，统一挂载在 `/api/auth` 前缀下。所有路由均位于：

```
apps/server/src/routes/auth.js
```

所有响应均遵循 CLAUDE.md 定义的统一格式：

- 成功：`{ data: value, message: string }`
- 失败：`{ data: null, error: string, message: string }`

Cookie 配置遵循 CLAUDE.md 安全红线：`httpOnly: true`、`sameSite: 'strict'`、生产环境 `secure: true`。

---

### 3.1 POST /api/auth/register — 注册新账号

**文件路径**: `apps/server/src/routes/auth.js`

**鉴权**: 不需要认证中间件（公开端点）

#### 请求 Schema

```js
// Fastify JSON Schema 格式
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
        description: '用户邮箱，作为唯一登录凭证，存储时统一转小写'
      },
      nickname: {
        type: 'string',
        minLength: 2,
        maxLength: 20,
        pattern: '^[\\u4e00-\\u9fa5a-zA-Z0-9]+$',
        description: '显示名称，2-20 字符，仅允许中英文及数字，不允许纯空格或特殊符号'
      },
      password: {
        type: 'string',
        minLength: 8,
        maxLength: 20,
        description: '原始密码，后端接收后立即用 bcrypt 哈希，不存明文'
      },
      privacyAgreed: {
        type: 'boolean',
        const: true,
        description: '用户是否已主动勾选隐私协议，必须为 true 才能注册（FR-004）'
      }
    }
  }
};
```

#### 成功响应 — 201 Created

注册成功后自动登录（FR-008），同时通过 `Set-Cookie` 写入 Session Cookie。

```json
HTTP/1.1 201 Created
Set-Cookie: sessionId=<uuid-v4>; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800

{
  "data": {
    "user": {
      "id": 1,
      "email": "alice@example.com",
      "nickname": "Alice",
      "createdAt": "2026-03-14T10:00:00.000Z"
    }
  },
  "message": "注册成功"
}
```

#### 失败响应清单

| HTTP 状态码 | error 字段内容 | 触发条件 |
|------------|--------------|---------|
| 400 | `VALIDATION_ERROR` | 请求体字段缺失、格式不合法（邮箱格式错误、昵称/密码长度不符、privacyAgreed 不为 true） |
| 409 | `EMAIL_ALREADY_EXISTS` | 邮箱已被注册（SQLite unique 约束冲突，FR-003） |
| 500 | `INTERNAL_SERVER_ERROR` | 数据库写入失败或其他未预期服务端错误 |

```json
// 400 示例
{
  "data": null,
  "error": "VALIDATION_ERROR",
  "message": "请输入有效的邮箱地址"
}

// 409 示例
{
  "data": null,
  "error": "EMAIL_ALREADY_EXISTS",
  "message": "该邮箱已被注册"
}
```

---

### 3.2 POST /api/auth/login — 用户登录

**文件路径**: `apps/server/src/routes/auth.js`

**鉴权**: 不需要认证中间件（公开端点）

#### 请求 Schema

```js
// Fastify JSON Schema 格式
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
        description: '用户注册邮箱，比较前统一转小写'
      },
      password: {
        type: 'string',
        minLength: 1,
        maxLength: 20,
        description: '用户原始密码，由服务端通过 bcrypt.compare 与数据库哈希值比对'
      }
    }
  }
};
```

#### 成功响应 — 200 OK

登录成功后创建新 Session，通过 `Set-Cookie` 写入 Cookie（FR-006）。

```json
HTTP/1.1 200 OK
Set-Cookie: sessionId=<uuid-v4>; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800

{
  "data": {
    "user": {
      "id": 1,
      "email": "alice@example.com",
      "nickname": "Alice",
      "createdAt": "2026-03-14T10:00:00.000Z"
    }
  },
  "message": "登录成功"
}
```

#### 失败响应清单

| HTTP 状态码 | error 字段内容 | 触发条件 |
|------------|--------------|---------|
| 400 | `VALIDATION_ERROR` | 请求体字段缺失或格式不合法（邮箱格式错误、密码为空） |
| 401 | `INVALID_CREDENTIALS` | 邮箱不存在或密码错误（FR-007：不区分具体是哪个字段错误，防信息泄露） |
| 500 | `INTERNAL_SERVER_ERROR` | 数据库查询失败或其他未预期服务端错误 |

```json
// 401 示例
{
  "data": null,
  "error": "INVALID_CREDENTIALS",
  "message": "邮箱或密码错误，请重试"
}
```

---

### 3.3 POST /api/auth/logout — 退出登录

**文件路径**: `apps/server/src/routes/auth.js`

**鉴权**: 需要认证中间件（`requireAuth`），未登录请求直接返回 401

#### 请求 Schema

```js
// 无请求体，仅通过 Cookie 中的 sessionId 识别当前会话
const logoutSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {}
  }
};
```

#### 成功响应 — 200 OK

从数据库删除对应 Session 记录，同时通过 `Set-Cookie` 清除客户端 Cookie（Max-Age=0）。

```json
HTTP/1.1 200 OK
Set-Cookie: sessionId=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0

{
  "data": null,
  "message": "已退出登录"
}
```

#### 失败响应清单

| HTTP 状态码 | error 字段内容 | 触发条件 |
|------------|--------------|---------|
| 401 | `UNAUTHORIZED` | Cookie 中无 sessionId 或 Session 不存在 / 已过期 |
| 500 | `INTERNAL_SERVER_ERROR` | 数据库删除失败或其他未预期服务端错误 |

```json
// 401 示例
{
  "data": null,
  "error": "UNAUTHORIZED",
  "message": "登录已过期，请重新登录"
}
```

---

### 3.4 GET /api/auth/me — 获取当前登录用户信息

**文件路径**: `apps/server/src/routes/auth.js`

**鉴权**: 需要认证中间件（`requireAuth`），未登录请求直接返回 401

#### 请求 Schema

```js
// 无请求体，无查询参数；会话信息从 Cookie 中读取
// 前端用于应用启动时检查登录状态、恢复 authUser 切片
const meSchema = {
  // 纯 GET 请求，无需定义 body schema
};
```

#### 成功响应 — 200 OK

返回当前已登录用户的基本信息（不返回 `password_hash`）。

```json
HTTP/1.1 200 OK

{
  "data": {
    "user": {
      "id": 1,
      "email": "alice@example.com",
      "nickname": "Alice",
      "createdAt": "2026-03-14T10:00:00.000Z"
    }
  },
  "message": "获取用户信息成功"
}
```

#### 失败响应清单

| HTTP 状态码 | error 字段内容 | 触发条件 |
|------------|--------------|---------|
| 401 | `UNAUTHORIZED` | Cookie 中无 sessionId 或 Session 不存在 / 已过期（边界场景"Session 过期"） |
| 500 | `INTERNAL_SERVER_ERROR` | 数据库查询失败或其他未预期服务端错误 |

```json
// 401 示例（Session 过期场景）
{
  "data": null,
  "error": "UNAUTHORIZED",
  "message": "登录已过期，请重新登录"
}
```

---

### 3.5 认证中间件 `requireAuth`

**文件路径**: `apps/server/src/plugins/auth.js`

所有需要鉴权的路由（包括现有 Memo 相关路由）均通过此中间件校验 Session。

#### 中间件逻辑

```js
// apps/server/src/plugins/auth.js
// Fastify preHandler hook 实现

async function requireAuth(request, reply) {
  // 1. 从 Cookie 中读取 sessionId
  const sessionId = request.cookies?.sessionId;
  if (!sessionId) {
    return reply.code(401).send({
      data: null,
      error: 'UNAUTHORIZED',
      message: '请先登录',
    });
  }

  // 2. 查询数据库确认 Session 存在且未过期
  const session = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .get();

  if (!session || session.expires_at < Date.now()) {
    // 过期时同步清除 Cookie
    reply.clearCookie('sessionId', { path: '/' });
    return reply.code(401).send({
      data: null,
      error: 'UNAUTHORIZED',
      message: '登录已过期，请重新登录',
    });
  }

  // 3. 将 userId 注入 request，供后续处理函数使用
  request.userId = session.user_id;
}
```

#### Cookie 配置常量

```js
// apps/server/src/lib/cookie-config.js
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天（毫秒）
const SESSION_TTL_SEC = 7 * 24 * 60 * 60;        // 7 天（秒，用于 Max-Age）

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict',
  path: '/',
  maxAge: SESSION_TTL_SEC,
  secure: process.env.NODE_ENV === 'production',
};
```

---

### 3.6 路由注册结构

```js
// apps/server/src/routes/auth.js（路由文件结构概览）
import fp from 'fastify-plugin';

async function authRoutes(fastify, opts) {
  // POST /api/auth/register
  fastify.post('/register', { schema: registerSchema }, registerHandler);

  // POST /api/auth/login
  fastify.post('/login', { schema: loginSchema }, loginHandler);

  // POST /api/auth/logout — 需要鉴权
  fastify.post('/logout', { preHandler: requireAuth }, logoutHandler);

  // GET /api/auth/me — 需要鉴权
  fastify.get('/me', { preHandler: requireAuth }, meHandler);
}

export default fp(authRoutes, { prefix: '/api/auth' });
```

---

### 3.7 现有路由变更说明

若项目后续存在 Memo 相关路由（如 `apps/server/src/routes/memos.js`），所有端点须在注册时添加 `preHandler: requireAuth`，并在查询/写入时自动附加 `WHERE user_id = request.userId` 过滤条件，实现多用户数据隔离（对应 §2.3 `memos` 表 `user_id` 外键变更）。

---

*本文件由 backend-developer subagent 生成，仅包含 §3 API 端点设计，供后续 frontend-developer 子 Agent 在此基础上补充 §4 组件结构等章节。*
