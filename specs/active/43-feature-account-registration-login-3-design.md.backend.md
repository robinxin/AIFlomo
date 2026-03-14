# Backend Output: 账号注册与登录 — §3 API 端点设计

**关联 Spec**: specs/active/43-feature-account-registration-login-3.md
**生成日期**: 2026-03-13
**生成 Agent**: backend-developer subagent

---

## §3 API 端点设计

本次共新增 4 个认证相关路由，全部位于文件 `apps/server/src/routes/auth.js`，并以 Fastify plugin 形式注册（前缀 `/api/auth`）。

---

### 3.1 POST /api/auth/register — 用户注册

**文件路径**: `apps/server/src/routes/auth.js`

**鉴权**: 无（公开接口，注册前无 Session）

**请求验证 — JSON Schema**:

```javascript
const registerBodySchema = {
  type: 'object',
  required: ['email', 'nickname', 'password', 'agreedToPrivacy'],
  additionalProperties: false,
  properties: {
    email: {
      type: 'string',
      format: 'email',
      maxLength: 254,
      description: '用户邮箱，用于登录唯一标识，必须符合标准邮箱格式',
    },
    nickname: {
      type: 'string',
      minLength: 2,
      maxLength: 20,
      pattern: '^(?!\\s*$).+',
      description: '用户昵称，2-20 字符，不允许纯空格',
    },
    password: {
      type: 'string',
      minLength: 8,
      maxLength: 20,
      description: '账号密码，8-20 字符',
    },
    agreedToPrivacy: {
      type: 'boolean',
      enum: [true],
      description: '是否同意隐私协议，必须为 true',
    },
  },
};

// Fastify 路由定义
fastify.post('/register', {
  schema: {
    body: registerBodySchema,
  },
  handler: registerHandler,
});
```

**业务处理逻辑说明**:

1. 验证邮箱是否已被注册（查询 `users` 表 `email` 字段）
2. 生成 UUID（`crypto.randomUUID()`）作为用户 `id`
3. 使用 `bcrypt`（saltRounds=10）对 `password` 进行哈希处理
4. 将 `nickname` 执行 `trim()` 后写入
5. 记录 `agreedAt = Date.now()`、`createdAt = Date.now()`、`updatedAt = Date.now()`
6. INSERT 用户记录到 `users` 表（Drizzle ORM 参数化查询）
7. 在 Session 中写入 `userId`（`request.session.userId = user.id`）
8. 返回用户信息（不含 `passwordHash`）

**成功响应 — HTTP 201**:

```json
{
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "user@example.com",
    "nickname": "小明",
    "createdAt": 1741824000000
  },
  "message": "注册成功"
}
```

**失败响应清单**:

| HTTP 状态码 | error 字段内容 | 触发场景 |
|------------|--------------|---------|
| 400 | `"请求参数格式错误"` | JSON Schema 校验失败（字段缺失、类型错误、格式不合法等） |
| 400 | `"请输入有效的邮箱地址"` | 邮箱不符合 email format（AJV format 校验失败） |
| 400 | `"昵称长度为 2-20 字符"` | nickname 长度不在 2-20 范围内 |
| 400 | `"密码长度为 8-20 字符"` | password 长度不在 8-20 范围内 |
| 400 | `"请阅读并同意隐私协议"` | agreedToPrivacy 不为 true |
| 409 | `"该邮箱已被注册"` | 邮箱已存在于 users 表（UNIQUE 冲突） |
| 500 | `"服务器内部错误，请稍后重试"` | 数据库写入异常或其他未预期错误 |

**失败响应格式（示例）**:

```json
{
  "data": null,
  "error": "该邮箱已被注册",
  "message": "注册失败"
}
```

---

### 3.2 POST /api/auth/login — 用户登录

**文件路径**: `apps/server/src/routes/auth.js`

**鉴权**: 无（公开接口）

**请求验证 — JSON Schema**:

```javascript
const loginBodySchema = {
  type: 'object',
  required: ['email', 'password'],
  additionalProperties: false,
  properties: {
    email: {
      type: 'string',
      format: 'email',
      maxLength: 254,
      description: '用户邮箱',
    },
    password: {
      type: 'string',
      minLength: 1,
      maxLength: 20,
      description: '账号密码，提交时不限制最小长度（服务端与哈希比对后返回统一错误信息）',
    },
  },
};

// Fastify 路由定义
fastify.post('/login', {
  schema: {
    body: loginBodySchema,
  },
  handler: loginHandler,
});
```

**业务处理逻辑说明**:

1. 根据 `email` 查询 `users` 表，获取用户记录（含 `passwordHash`）
2. 若用户不存在，返回 401（信息不泄露具体原因，符合 FR-007）
3. 使用 `bcrypt.compare(password, user.passwordHash)` 验证密码
4. 若密码不匹配，返回 401（同上，统一错误提示）
5. 在 Session 中写入 `userId`（`request.session.userId = user.id`）
6. 更新用户 `updatedAt = Date.now()`（可选，记录最后活跃时间）
7. 返回用户信息（不含 `passwordHash`）

**成功响应 — HTTP 200**:

```json
{
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "user@example.com",
    "nickname": "小明",
    "createdAt": 1741824000000
  },
  "message": "登录成功"
}
```

**失败响应清单**:

| HTTP 状态码 | error 字段内容 | 触发场景 |
|------------|--------------|---------|
| 400 | `"请求参数格式错误"` | JSON Schema 校验失败（字段缺失、类型错误等） |
| 401 | `"邮箱或密码错误，请重试"` | 邮箱不存在或密码比对失败（统一提示，不泄露具体原因，符合 FR-007） |
| 500 | `"服务器内部错误，请稍后重试"` | 数据库查询异常或其他未预期错误 |

**失败响应格式（示例）**:

```json
{
  "data": null,
  "error": "邮箱或密码错误，请重试",
  "message": "登录失败"
}
```

---

### 3.3 POST /api/auth/logout — 用户登出

**文件路径**: `apps/server/src/routes/auth.js`

**鉴权**: `preHandler: [requireAuth]`（需要已登录 Session）

**请求验证 — JSON Schema**:

```javascript
// 无 body，无 querystring 参数
// Fastify 路由定义
fastify.post('/logout', {
  preHandler: [requireAuth],
  handler: logoutHandler,
});
```

**业务处理逻辑说明**:

1. 调用 `request.session.destroy()` 销毁当前 Session（服务端删除 Session 记录）
2. 清除客户端 Cookie（Fastify Session 插件在 destroy 后自动处理）
3. 返回成功响应

**成功响应 — HTTP 200**:

```json
{
  "data": null,
  "message": "已成功登出"
}
```

**失败响应清单**:

| HTTP 状态码 | error 字段内容 | 触发场景 |
|------------|--------------|---------|
| 401 | `"请先登录"` | 未携带有效 Session Cookie（requireAuth 拦截） |
| 500 | `"服务器内部错误，请稍后重试"` | Session 销毁过程中出现异常 |

**失败响应格式（示例）**:

```json
{
  "data": null,
  "error": "请先登录",
  "message": "登出失败"
}
```

---

### 3.4 GET /api/auth/me — 获取当前登录用户信息

**文件路径**: `apps/server/src/routes/auth.js`

**鉴权**: `preHandler: [requireAuth]`（需要已登录 Session）

**请求验证 — JSON Schema**:

```javascript
// 无 body，无 querystring 参数
// Fastify 路由定义
fastify.get('/me', {
  preHandler: [requireAuth],
  handler: getMeHandler,
});
```

**业务处理逻辑说明**:

1. 从 Session 中读取 `userId`（`request.session.userId`）
2. 根据 `userId` 查询 `users` 表，获取用户完整信息
3. 若用户记录不存在（异常情况，如账号已被删除），销毁 Session 并返回 401
4. 返回用户信息（不含 `passwordHash`）

**成功响应 — HTTP 200**:

```json
{
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "user@example.com",
    "nickname": "小明",
    "createdAt": 1741824000000
  },
  "message": "获取用户信息成功"
}
```

**失败响应清单**:

| HTTP 状态码 | error 字段内容 | 触发场景 |
|------------|--------------|---------|
| 401 | `"请先登录"` | 未携带有效 Session Cookie（requireAuth 拦截）或 Session 已过期 |
| 401 | `"用户不存在，请重新登录"` | Session 中的 userId 对应的用户已被删除（异常情况） |
| 500 | `"服务器内部错误，请稍后重试"` | 数据库查询异常或其他未预期错误 |

**失败响应格式（示例）**:

```json
{
  "data": null,
  "error": "请先登录",
  "message": "获取用户信息失败"
}
```

---

### 3.5 requireAuth 中间件设计

`requireAuth` 是一个 Fastify `preHandler` 钩子函数，用于保护需要登录才能访问的路由。

**文件路径**: `apps/server/src/lib/auth.js`

```javascript
// apps/server/src/lib/auth.js
export function requireAuth(request, reply, done) {
  if (!request.session || !request.session.userId) {
    return reply.code(401).send({
      data: null,
      error: '请先登录',
      message: '未授权访问',
    });
  }
  done();
}
```

---

### 3.6 路由注册方式（Plugin 封装）

所有认证路由以 Fastify Plugin 形式封装，注册时统一添加 `/api/auth` 前缀：

```javascript
// apps/server/src/routes/auth.js
import fp from 'fastify-plugin';
import { requireAuth } from '../lib/auth.js';

async function authRoutes(fastify) {
  // POST /api/auth/register
  fastify.post('/register', {
    schema: { body: registerBodySchema },
    handler: registerHandler,
  });

  // POST /api/auth/login
  fastify.post('/login', {
    schema: { body: loginBodySchema },
    handler: loginHandler,
  });

  // POST /api/auth/logout
  fastify.post('/logout', {
    preHandler: [requireAuth],
    handler: logoutHandler,
  });

  // GET /api/auth/me
  fastify.get('/me', {
    preHandler: [requireAuth],
    handler: getMeHandler,
  });
}

export default fp(authRoutes);

// apps/server/src/index.js（注册示例）
// fastify.register(authRoutes, { prefix: '/api/auth' });
```

---

### 3.7 端点汇总表

| 方法 | 路径 | 是否需要鉴权 | 功能描述 | 成功状态码 |
|------|------|------------|---------|-----------|
| POST | `/api/auth/register` | 否 | 新用户注册，创建账号并自动登录 | 201 |
| POST | `/api/auth/login` | 否 | 已注册用户登录，建立 Session | 200 |
| POST | `/api/auth/logout` | 是 | 登出，销毁 Session 和 Cookie | 200 |
| GET | `/api/auth/me` | 是 | 获取当前登录用户信息，供前端初始化鉴权状态 | 200 |
