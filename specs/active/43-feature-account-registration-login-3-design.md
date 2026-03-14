# 技术方案：账号注册与登录

**关联 Spec**: specs/active/43-feature-account-registration-login-3.md
**生成日期**: 2026-03-14

---

<!-- §1 §2：原样复制 architect.md 的完整内容，不得改动 -->

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

---

<!-- §3：原样复制 backend.md 的完整内容，不得改动（差异处仅追加 ⚠️ 备注行） -->

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

---

<!-- §4：原样复制 frontend.md 的完整内容，不得改动（差异处仅追加 ⚠️ 备注行） -->

# Frontend Output: 账号注册与登录 — §4 前端页面与组件设计

**关联 Spec**: specs/active/43-feature-account-registration-login-3.md
**关联 Architect 文件**: specs/active/43-feature-account-registration-login-3-design.md.architect.md
**关联 Issue**: #43
**生成日期**: 2026-03-14
**生成子 Agent**: frontend-developer

---

## §4 前端页面与组件

### 4.1 新增页面（Screen）

#### 4.1.1 注册页面

| 属性 | 值 |
|------|-----|
| 文件路径 | `apps/mobile/app/register.jsx` |
| URL 路径 | `/register` |
| 访问入口 | 首次访问时由路由守卫重定向，或从登录页点击"立即注册"链接跳转 |
| 职责 | 渲染注册表单，收集邮箱、昵称、密码和隐私协议同意信息，调用注册 API，成功后自动登录并跳转 Memo 列表 |

**页面结构**：

```
register.jsx
├── 页面标题区：应用 Logo + "创建账号"标题
├── FormErrorBanner（服务端错误全局提示区）
├── AuthForm（注册模式）
│   ├── FormField（邮箱）
│   ├── FormField（昵称）
│   ├── FormField（密码，含明暗切换）
│   ├── PrivacyCheckbox（隐私协议勾选）
│   └── SubmitButton（注册按钮）
└── 页脚导航：已有账号？"返回登录"链接
```

---

#### 4.1.2 登录页面

| 属性 | 值 |
|------|-----|
| 文件路径 | `apps/mobile/app/login.jsx` |
| URL 路径 | `/login` |
| 访问入口 | 路由守卫检测到未登录时重定向，或从注册页点击"返回登录"链接跳转 |
| 职责 | 渲染登录表单，收集邮箱和密码，调用登录 API，成功后跳转 Memo 列表 |

**页面结构**：

```
login.jsx
├── 页面标题区：应用 Logo + "欢迎回来"标题
├── FormErrorBanner（服务端错误全局提示区）
├── AuthForm（登录模式）
│   ├── FormField（邮箱）
│   ├── FormField（密码，含明暗切换）
│   └── SubmitButton（登录按钮）
└── 页脚导航：还没有账号？"立即注册"链接
```

---

### 4.2 新增组件

#### 4.2.1 AuthForm

| 属性 | 值 |
|------|-----|
| 文件路径 | `apps/mobile/components/AuthForm.jsx` |
| 职责 | 统一的认证表单容器，根据 `mode` prop 渲染注册或登录视图，管理表单字段值与本地验证逻辑 |

**Props**：

| 名称 | 类型 | 是否必填 | 说明 |
|------|------|---------|------|
| `mode` | `'register' \| 'login'` | 是 | 控制渲染注册表单还是登录表单 |
| `onSubmit` | `function(formData): Promise` | 是 | 表单提交回调，由父页面传入，内部执行 API 调用 |
| `isLoading` | `boolean` | 是 | 控制表单加载状态（禁用输入框和按钮） |
| `serverError` | `string \| null` | 否 | 服务端返回的错误信息，传入后由 FormErrorBanner 展示 |

**用户交互**：
- 用户在邮箱、昵称、密码输入框中输入文字
- 注册模式下，输入框失焦（blur）时触发本地格式验证，并在 FormField 下方显示错误提示
- 登录模式下，仅在点击提交按钮时触发前端格式验证
- 用户勾选/取消隐私协议复选框（仅注册模式）
- 用户点击提交按钮触发 `onSubmit` 回调

---

#### 4.2.2 FormField

| 属性 | 值 |
|------|-----|
| 文件路径 | `apps/mobile/components/FormField.jsx` |
| 职责 | 单个表单字段的封装，包含标签、输入框、错误提示三层结构，支持密码明暗切换 |

**Props**：

| 名称 | 类型 | 是否必填 | 说明 |
|------|------|---------|------|
| `label` | `string` | 是 | 输入框标签文字（如"邮箱"、"昵称"、"密码"） |
| `value` | `string` | 是 | 受控输入框的当前值 |
| `onChangeText` | `function(text: string)` | 是 | 输入内容变化的回调 |
| `onBlur` | `function()` | 否 | 失焦回调，注册模式下用于触发验证 |
| `error` | `string \| null` | 否 | 字段级错误提示文字，非空时显示红色错误信息 |
| `secureTextEntry` | `boolean` | 否 | 是否密码模式（默认 false） |
| `showPasswordToggle` | `boolean` | 否 | 是否显示明暗切换图标（仅 secureTextEntry 为 true 时有效） |
| `maxLength` | `number` | 否 | 输入最大字符数限制 |
| `editable` | `boolean` | 否 | 是否可编辑（加载状态下设为 false） |
| `keyboardType` | `string` | 否 | 键盘类型（邮箱字段传 `'email-address'`） |
| `autoCapitalize` | `string` | 否 | 自动大写配置（邮箱和密码字段传 `'none'`） |
| `testID` | `string` | 否 | 测试 ID，供 E2E 测试定位元素 |

**用户交互**：
- 用户聚焦输入框时，输入框边框高亮（蓝色）
- 用户输入文字时，实时更新 `value`（受控组件）
- 昵称字段：输入达到 `maxLength`（20）时阻止继续输入，同时显示字数限制提示
- 密码字段：点击右侧眼睛图标切换明文/密文显示
- 用户失焦时触发 `onBlur` 回调
- 当 `error` 非空时，输入框边框变红，下方显示红色错误提示文字

---

#### 4.2.3 FormErrorBanner

| 属性 | 值 |
|------|-----|
| 文件路径 | `apps/mobile/components/FormErrorBanner.jsx` |
| 职责 | 表单顶部的全局错误提示横幅，用于展示服务端返回的错误（如"该邮箱已被注册"、"邮箱或密码错误"） |

**Props**：

| 名称 | 类型 | 是否必填 | 说明 |
|------|------|---------|------|
| `message` | `string \| null` | 是 | 错误信息文字；为 null 或空字符串时组件不渲染（返回 null） |

**用户交互**：
- 服务端返回错误时横幅出现，显示红色背景 + 错误文字
- 用户开始重新输入表单内容时，父组件清除 `serverError`，横幅消失

---

#### 4.2.4 PrivacyCheckbox

| 属性 | 值 |
|------|-----|
| 文件路径 | `apps/mobile/components/PrivacyCheckbox.jsx` |
| 职责 | 隐私协议勾选框组件，含勾选状态指示、协议文字和错误高亮提示 |

**Props**：

| 名称 | 类型 | 是否必填 | 说明 |
|------|------|---------|------|
| `checked` | `boolean` | 是 | 当前勾选状态 |
| `onChange` | `function(checked: boolean)` | 是 | 状态切换回调 |
| `error` | `string \| null` | 否 | 未勾选提交时的错误提示（如"请阅读并同意隐私协议"） |

**用户交互**：
- 用户点击复选框或旁边文字区域切换勾选状态
- 未勾选时尝试提交，复选框边框变红，下方显示错误提示"请阅读并同意隐私协议"
- 勾选后错误提示消失

---

#### 4.2.5 SubmitButton

| 属性 | 值 |
|------|-----|
| 文件路径 | `apps/mobile/components/SubmitButton.jsx` |
| 职责 | 表单提交按钮，支持加载状态（禁用 + 文字变化），防止重复提交 |

**Props**：

| 名称 | 类型 | 是否必填 | 说明 |
|------|------|---------|------|
| `label` | `string` | 是 | 按钮正常状态文字（如"注册"、"登录"） |
| `loadingLabel` | `string` | 是 | 加载状态文字（如"注册中..."、"登录中..."） |
| `isLoading` | `boolean` | 是 | 是否处于加载状态 |
| `onPress` | `function()` | 是 | 点击回调 |
| `disabled` | `boolean` | 否 | 额外禁用控制（加载中时自动禁用） |
| `testID` | `string` | 否 | 测试 ID |

**用户交互**：
- 正常状态：按钮可点击，显示 `label` 文字
- 加载状态：按钮禁用（无法再次点击），显示 `loadingLabel` 文字，视觉上呈现半透明或活动指示
- 加载结束后（成功或失败）按钮恢复可点击状态

---

### 4.3 状态管理变更

#### 4.3.1 新增 AuthContext

**文件路径**: `apps/mobile/context/AuthContext.jsx`

**职责**: 管理全局认证状态，提供 `authUser`（当前登录用户信息）、认证相关操作（login、register、logout）给所有子组件使用。

**State 结构**：

```js
// AuthContext 管理的 state 结构
{
  authUser: {
    id: number,          // 用户 ID
    email: string,       // 邮箱
    nickname: string,    // 昵称
  } | null,             // null 表示未登录
  isLoading: boolean,   // 认证操作（登录/注册）的加载状态
  error: string | null, // 认证操作的错误信息
}
```

**新增 Action Types**：

| Action Type | 触发时机 | Payload |
|------------|---------|---------|
| `AUTH_REQUEST` | 开始登录或注册请求 | 无 |
| `AUTH_SUCCESS` | 登录或注册 API 返回成功 | `{ user: { id, email, nickname } }` |
| `AUTH_FAILURE` | 登录或注册 API 返回错误 | `{ error: string }` |
| `AUTH_LOGOUT` | 用户主动登出或会话过期 | 无 |
| `AUTH_CLEAR_ERROR` | 用户重新输入时清除错误提示 | 无 |
| `AUTH_RESTORE` | 应用启动时从 `/api/auth/me` 恢复会话 | `{ user: { id, email, nickname } \| null }` |

**Reducer 逻辑概要**：

```js
// apps/mobile/context/AuthContext.jsx
function authReducer(state, action) {
  switch (action.type) {
    case 'AUTH_REQUEST':
      return { ...state, isLoading: true, error: null };
    case 'AUTH_SUCCESS':
      return { ...state, isLoading: false, authUser: action.payload.user, error: null };
    case 'AUTH_FAILURE':
      return { ...state, isLoading: false, error: action.payload.error };
    case 'AUTH_LOGOUT':
      return { ...state, authUser: null, error: null };
    case 'AUTH_CLEAR_ERROR':
      return { ...state, error: null };
    case 'AUTH_RESTORE':
      return { ...state, authUser: action.payload.user };
    default:
      return state;
  }
}
```

**Context Provider 放置位置**：`apps/mobile/app/_layout.jsx`（根布局文件），包裹所有路由，确保全局可访问。

---

#### 4.3.2 影响现有 Context

若项目已存在全局 Context（如 `MemoContext`），需确认其 Provider 也嵌套在 `AuthContext.Provider` 内层，以便 Memo 操作可读取 `authUser` 状态判断权限。

---

### 4.4 自定义 Hook 变更

#### 4.4.1 新增 use-auth.js

| 属性 | 值 |
|------|-----|
| 文件路径 | `apps/mobile/hooks/use-auth.js` |
| 职责 | 封装 AuthContext 的读取与认证操作，对外提供简洁的认证接口，隔离 Context 实现细节 |

**入参**: 无

**返回值**：

```js
{
  authUser: object | null,   // 当前登录用户，null 表示未登录
  isLoading: boolean,        // 认证操作加载中
  error: string | null,      // 认证错误信息
  login: function(email, password): Promise<void>,    // 登录
  register: function(email, nickname, password): Promise<void>, // 注册（成功后自动登录）
  logout: function(): Promise<void>,  // 登出
  clearError: function(): void,       // 清除错误提示
}
```

**使用示例**：

```js
// 在登录页面中使用
const { login, isLoading, error, clearError } = useAuth();

// 在路由守卫中使用
const { authUser } = useAuth();
if (!authUser) router.replace('/login');
```

---

#### 4.4.2 路由守卫逻辑（集成在 _layout.jsx）

在 `apps/mobile/app/_layout.jsx` 的根布局中，通过 `useAuth` 监听 `authUser` 状态，实现路由保护：

- `authUser` 为 null 且路由不是 `/login` 或 `/register`：跳转到 `/login`
- `authUser` 非 null 且当前在 `/login` 或 `/register`：跳转到 `/`（Memo 列表）
- 应用首次启动时调用 `/api/auth/me` 确认会话是否有效，再决定路由跳转方向

---

### 4.5 用户交互流程

#### 4.5.1 注册完整流程

```
用户看到                     用户操作                      系统响应
─────────────────────────────────────────────────────────────────────
注册页面（空白表单）         —                             —
邮箱输入框高亮（蓝色边框）   点击邮箱输入框               输入框聚焦
输入框显示已输入内容         输入邮箱地址                  受控更新 value
（无提示）                   点击昵称输入框（邮箱失焦）    触发邮箱 blur 验证：
                                                           - 格式有效：无提示
                                                           - 格式无效：输入框变红
                                                             显示"请输入有效的邮箱地址"
输入框显示已输入内容         输入昵称                      受控更新 value
（字数限制：20字符）         输入超过20字符               阻止输入，提示"昵称最多 20 个字符"
                             点击密码输入框（昵称失焦）    触发昵称 blur 验证：
                                                           - 2~20字符：无提示
                                                           - 不足2字符：显示"昵称至少 2 个字符"
密码显示为密文（●●●●）      输入密码                      受控更新 value（密文）
眼睛图标（关闭状态）         点击眼睛图标                  切换为明文显示
眼睛图标（开启状态）         —                             —
                             点击隐私协议区域失焦          触发密码 blur 验证：
                                                           - 8~20字符：无提示
                                                           - 不足8字符：显示"密码长度至少为 8 个字符"
隐私协议复选框（未勾选）     点击复选框或文字              复选框变为已勾选状态
                             点击"注册"按钮               前端完整校验：
                                                           - 全部通过：执行下一步
                                                           - 有错误：高亮对应字段错误，不提交
按钮文字变为"注册中..."      —                             dispatch AUTH_REQUEST
按钮和所有输入框禁用          —                             调用 POST /api/auth/register
                             —（等待响应）                —
                                                           【成功路径】
                                                           dispatch AUTH_SUCCESS({ user })
                                                           路由守卫检测到 authUser 非 null
页面跳转到 Memo 列表         —                             Expo Router replace('/')
                                                           【失败路径（邮箱已注册）】
                                                           dispatch AUTH_FAILURE({ error })
FormErrorBanner 出现         —                             显示"该邮箱已被注册"
按钮恢复"注册"，输入框可编辑 —                             isLoading 恢复 false
                             用户修改邮箱                  dispatch AUTH_CLEAR_ERROR
FormErrorBanner 消失         —                             error 清空
```

---

#### 4.5.2 登录完整流程

```
用户看到                     用户操作                      系统响应
─────────────────────────────────────────────────────────────────────
登录页面（空白表单）         —                             —
                             输入邮箱、密码               受控更新 value
                             点击"登录"按钮               前端格式验证（邮箱格式）：
                                                           - 通过：继续
                                                           - 失败：高亮错误，不提交
按钮文字变为"登录中..."      —                             dispatch AUTH_REQUEST
按钮和输入框禁用              —                             调用 POST /api/auth/login
                             —（等待响应）                —
                                                           【成功路径】
                                                           dispatch AUTH_SUCCESS({ user })
页面跳转到 Memo 列表         —                             路由守卫 replace('/')
                                                           【失败路径（密码错误）】
                                                           dispatch AUTH_FAILURE({ error })
FormErrorBanner 显示         —                             显示"邮箱或密码错误，请重试"
密码输入框自动清空           —                             password value 重置为 ''
按钮恢复"登录"              —                             isLoading 恢复 false
```

---

#### 4.5.3 Session 过期处理流程

```
用户看到                     触发条件                      系统响应
─────────────────────────────────────────────────────────────────────
Memo 列表正常显示            用户进行任意操作              API 请求返回 401
提示"登录已过期，请重新登录" —                             dispatch AUTH_LOGOUT
页面跳转到登录页 /login      —                             路由守卫检测 authUser 为 null
```

---

#### 4.5.4 应用启动会话恢复流程

```
用户看到                     触发条件                      系统响应
─────────────────────────────────────────────────────────────────────
（加载中，无内容）           应用启动                      _layout.jsx 调用 GET /api/auth/me
                             —                             【有效会话】
                                                           dispatch AUTH_RESTORE({ user })
直接进入 Memo 列表           —                             路由守卫跳转 '/'
                             —                             【无效会话或未登录】
                                                           dispatch AUTH_RESTORE({ user: null })
跳转到登录页                 —                             路由守卫跳转 '/login'
```

---

### 4.6 调用的 API 端点

以下端点根据数据模型推断，遵循 REST 惯例，与 backend-developer 并行设计时保持一致。

#### POST /api/auth/register

**触发时机**: 用户在注册页面点击"注册"按钮，前端校验全部通过后

**请求**：

```json
{
  "email": "user@example.com",
  "nickname": "测试用户",
  "password": "password123",
  "privacyAgreed": true
}
```

**成功响应（201）**：

```json
{
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "nickname": "测试用户"
    }
  },
  "message": "注册成功"
}
```

**失败响应（400 邮箱格式错误 / 409 邮箱已注册）**：

```json
{
  "data": null,
  "error": "EMAIL_ALREADY_EXISTS",
  "message": "该邮箱已被注册"
}
```

**前端处理**：成功后服务端同时创建会话（Cookie 自动写入），dispatch `AUTH_SUCCESS`，路由守卫跳转 `/`。

---

#### POST /api/auth/login

**触发时机**: 用户在登录页面点击"登录"按钮，前端格式验证通过后

**请求**：

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**成功响应（200）**：

```json
{
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "nickname": "测试用户"
    }
  },
  "message": "登录成功"
}
```

**失败响应（401）**：

```json
{
  "data": null,
  "error": "INVALID_CREDENTIALS",
  "message": "邮箱或密码错误，请重试"
}
```

**前端处理**：失败时清空密码输入框，dispatch `AUTH_FAILURE`，显示 FormErrorBanner。

---

#### POST /api/auth/logout

**触发时机**: 用户主动登出（由其他页面/组件调用，如 Memo 列表顶部的退出登录按钮）

**请求**: 无 Body（依赖 Cookie 中的 session_id）

**成功响应（200）**：

```json
{
  "data": null,
  "message": "已退出登录"
}
```

**前端处理**：dispatch `AUTH_LOGOUT`，路由守卫跳转 `/login`。

---

#### GET /api/auth/me

**触发时机**: 应用启动时（`_layout.jsx` 的 `useEffect` 中调用）

**请求**: 无 Body（依赖 Cookie 中的 session_id）

**成功响应（200，会话有效）**：

```json
{
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "nickname": "测试用户"
    }
  },
  "message": "ok"
}
```

**失败响应（401，未登录或会话过期）**：

```json
{
  "data": null,
  "error": "UNAUTHORIZED",
  "message": "未登录或登录已过期"
}
```

**前端处理**：
- 200：dispatch `AUTH_RESTORE({ user })`，路由守卫保持或跳转 `/`
- 401：dispatch `AUTH_RESTORE({ user: null })`，路由守卫跳转 `/login`

---

### 4.7 前端验证规则

| 字段 | 验证规则 | 错误提示文字 | 验证时机 |
|------|---------|------------|---------|
| 邮箱 | 符合标准邮箱格式（正则 `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`） | 请输入有效的邮箱地址 | 注册：失焦时；登录：提交时 |
| 昵称 | 2-20 个字符，非纯空格 | 昵称至少 2 个字符 / 昵称最多 20 个字符 | 注册：失焦时（超长时实时阻止输入） |
| 密码 | 8-20 个字符 | 密码长度至少为 8 个字符 / 密码长度不超过 20 个字符 | 注册：失焦时；登录：提交时 |
| 隐私协议 | 必须勾选 | 请阅读并同意隐私协议 | 注册：提交时 |

---

### 4.8 文件变更总览

| 操作 | 文件路径 | 说明 |
|------|---------|------|
| 新增 | `apps/mobile/app/register.jsx` | 注册页面 |
| 新增 | `apps/mobile/app/login.jsx` | 登录页面 |
| 新增 | `apps/mobile/components/AuthForm.jsx` | 认证表单容器组件 |
| 新增 | `apps/mobile/components/FormField.jsx` | 通用表单字段组件 |
| 新增 | `apps/mobile/components/FormErrorBanner.jsx` | 服务端错误横幅组件 |
| 新增 | `apps/mobile/components/PrivacyCheckbox.jsx` | 隐私协议复选框组件 |
| 新增 | `apps/mobile/components/SubmitButton.jsx` | 提交按钮组件 |
| 新增 | `apps/mobile/context/AuthContext.jsx` | 认证全局状态管理 |
| 新增 | `apps/mobile/hooks/use-auth.js` | 认证 Hook |
| 修改 | `apps/mobile/app/_layout.jsx` | 挂载 AuthContext.Provider，增加路由守卫逻辑 |
| 新增 | `apps/mobile/lib/api.js`（若不存在） | API 请求封装（含 credentials: 'include' 确保 Cookie 传递） |

---

*本文件由 frontend-developer subagent 生成，仅包含 §4 前端页面与组件设计。*

---

## §5 改动文件清单

### 新增

#### 后端

| 文件路径 | 说明 |
|---------|------|
| `apps/server/src/routes/auth.js` | 认证路由文件，包含 register / login / logout / me 四条 Fastify 路由处理器及对应 JSON Schema |
| `apps/server/src/plugins/auth.js` | `requireAuth` 认证中间件（Fastify preHandler hook），校验 Cookie 中的 sessionId，将 userId 注入 request |
| `apps/server/src/lib/cookie-config.js` | Cookie 配置常量（SESSION_TTL_MS、SESSION_TTL_SEC、COOKIE_OPTIONS），集中管理 Cookie 安全参数 |

#### 前端

| 文件路径 | 说明 |
|---------|------|
| `apps/mobile/app/register.jsx` | 注册页面，渲染注册表单，调用注册 API，成功后自动登录并跳转 Memo 列表 |
| `apps/mobile/app/login.jsx` | 登录页面，渲染登录表单，调用登录 API，成功后跳转 Memo 列表 |
| `apps/mobile/components/AuthForm.jsx` | 认证表单容器组件，根据 `mode` prop 渲染注册或登录视图，管理表单字段值与本地验证逻辑 |
| `apps/mobile/components/FormField.jsx` | 通用表单字段组件，封装标签、输入框、错误提示三层结构，支持密码明暗切换 |
| `apps/mobile/components/FormErrorBanner.jsx` | 服务端错误全局提示横幅组件，message 为 null 时不渲染 |
| `apps/mobile/components/PrivacyCheckbox.jsx` | 隐私协议勾选框组件，含勾选状态指示、协议文字和未勾选提交时的错误高亮提示 |
| `apps/mobile/components/SubmitButton.jsx` | 表单提交按钮，支持加载状态（禁用 + 文字变化），防止重复提交 |
| `apps/mobile/context/AuthContext.jsx` | 认证全局状态管理（React Context + useReducer），管理 authUser、isLoading、error 三个切片 |
| `apps/mobile/hooks/use-auth.js` | 认证 Hook，封装 AuthContext 的读取与 login / register / logout / clearError 操作 |
| `apps/mobile/lib/api.js`（若不存在） | API 请求封装，配置 `credentials: 'include'` 确保跨请求携带 Cookie |

---

### 修改

#### 后端

| 文件路径 | 说明 |
|---------|------|
| `apps/server/src/db/schema.js` | 新增 `users` 表定义、`sessions` 表定义；若 `memos` 表已存在则新增 `user_id` 外键字段（级联删除） |
| `apps/server/src/routes/memos.js`（若已存在） | 所有端点添加 `preHandler: requireAuth`，查询/写入时追加 `WHERE user_id = request.userId` 过滤条件，实现多用户数据隔离 |

#### 前端

| 文件路径 | 说明 |
|---------|------|
| `apps/mobile/app/_layout.jsx` | 挂载 `AuthContext.Provider` 包裹所有路由；新增路由守卫逻辑：应用启动时调用 `GET /api/auth/me` 恢复会话，根据 `authUser` 状态决定跳转到登录页还是 Memo 列表页 |

---

## §6 技术约束与风险

### 输入校验

前后端均需对以下字段执行校验，以最严格的一方（后端）为准，前端提前校验以减少无效请求：

| 字段 | 类型 | 长度/格式要求 | 后端校验方式 | 前端校验时机 |
|------|------|------------|------------|------------|
| `email` | string | 符合 RFC 5321 邮箱格式，最长 254 字符 | Fastify JSON Schema `format: 'email'` | 注册：失焦时；登录：提交时 |
| `nickname` | string | 2-20 字符，仅允许中英文及数字（正则 `^[\u4e00-\u9fa5a-zA-Z0-9]+$`），禁止纯空格 | Fastify JSON Schema `minLength/maxLength/pattern` | 注册：失焦时，超长时实时阻止输入 |
| `password` | string | 8-20 字符 | Fastify JSON Schema `minLength/maxLength` | 注册：失焦时；登录：提交时 |
| `privacyAgreed` | boolean | 必须为 `true` | Fastify JSON Schema `const: true` | 注册：提交时 |

额外注意：
- `email` 在写入数据库前须统一转小写（`email.toLowerCase()`），防止大小写差异导致的重复注册绕过。
- 后端 `nickname` pattern 校验与前端正则需保持一致，避免后端拒绝前端允许的内容。

### 安全

- **XSS 防护**：所有用户输入（nickname、email）在前端展示时使用纯文本渲染（React Native Text 组件默认不解析 HTML，Web 端避免使用 `dangerouslySetInnerHTML`）。
- **密码安全**：密码在后端接收后立即使用 `bcryptjs` 哈希（cost factor 10），`password_hash` 字段永远不在 API 响应中返回。
- **认证边界**：`requireAuth` 中间件须应用于所有非公开端点（logout、me 及所有 Memo 路由）；公开端点（register、login）不得误加此中间件。
- **会话 ID 安全**：使用 UUID v4 生成 sessionId，防止会话枚举攻击；Cookie 必须设置 `httpOnly: true`、`sameSite: 'strict'`，生产环境设置 `secure: true`。
- **信息泄露防护**：登录失败时统一返回"邮箱或密码错误"，不区分邮箱不存在与密码错误（FR-007），防止通过错误信息枚举已注册邮箱。

### 性能

- **N+1 查询风险**：`requireAuth` 中间件对每个受保护请求均查询 `sessions` 表，属于单次查询，无 N+1 问题；但高并发场景下需确保 `sessions.id` 字段有索引（SQLite 主键默认有索引，已满足）。
- **bcrypt 耗时**：cost factor 10 下 bcrypt 哈希约需 100ms，注册/登录端点为阻塞操作，在 Node.js 单线程环境中须使用 `bcryptjs` 的异步 API（`bcrypt.hash()`、`bcrypt.compare()`），避免阻塞事件循环。
- **分页**：本功能涉及的四个认证端点均为单条记录操作（注册/登录返回一个用户对象），无需分页。
- **会话清理**：过期 Session 不会自动删除，长期运行后 `sessions` 表可能积累大量过期记录；MVP 阶段可接受，后续可添加定时清理任务（如每日删除 `expires_at < Date.now()` 的记录）。

### 兼容性

- **现有 Memo 路由兼容**：若 `memos.js` 已存在，添加 `requireAuth` 和 `user_id` 过滤后，所有现有 Memo API 将要求认证，未登录请求将收到 401。需确认当前调用方（前端）已实现认证流程后再上线，否则会导致现有功能中断。
- **数据库迁移兼容**：若 `memos` 表已有历史数据（无 `user_id`），新增 `user_id NOT NULL` 字段会导致迁移失败。MVP 阶段建议执行 `pnpm db:reset` 清空重建；若需保留历史数据，须先以可为空方式添加字段，再填充默认值，最后设置非空约束。
- **Cookie 跨域兼容**：前端 Web 端 API 请求须配置 `credentials: 'include'`，后端 CORS 须设置 `credentials: true` 并指定允许的 origin（不可使用通配符 `*`），否则 Cookie 无法在跨域请求中传递。

---

## §7 不包含（范围边界）

本次设计明确不包含以下功能，实现阶段须严格遵守范围边界，避免功能蔓延：

1. **密码重置/找回功能**：用户忘记密码时，系统暂不提供密码重置流程（包括发送重置邮件、重置密码链接等），登录失败提示中不显示"忘记密码"链接。后续迭代由独立 Spec 覆盖。

2. **邮箱验证（发送验证邮件）**：注册流程仅做邮箱格式校验（前端正则 + 后端 JSON Schema），不发送验证邮件，不要求用户点击确认链接激活账号。降低 MVP 复杂度，后续可根据需求补充。

3. **第三方 OAuth 登录**：本次仅实现邮箱+密码的传统认证方式，不包含 Google、GitHub、微信等第三方登录集成。

4. **"记住我"功能**：所有用户会话统一使用 7 天有效期，不提供"记住我"选项，不支持用户自定义会话时长。

5. **多设备会话管理**：用户在多台设备登录时，各设备的 Session 独立存在，不提供查看当前活跃会话列表、远程登出其他设备等会话管理功能。

6. **账号注销功能**：本次设计不包含账号永久删除（注销）的功能入口和后端逻辑，仅实现退出登录（删除当前 Session）。

7. **防暴力破解机制**：登录失败后不设置短时间内的重试次数限制（如锁定账号、增加验证码），MVP 阶段接受此风险，后续根据安全需求增加速率限制。
