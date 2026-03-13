# 技术方案：账号注册与登录

**关联 Spec**: specs/active/43-feature-account-registration-login-3.md
**生成日期**: 2026-03-13

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

---

## §4 前端页面与组件

### 4.1 新增 Screen（页面路由）

| 文件路径 | URL 路径 | 职责 |
|---------|---------|------|
| `apps/mobile/app/register.jsx` | `/register` | 注册页面：收集邮箱、昵称、密码、隐私协议同意，调用注册 API，成功后自动登录并跳转 |
| `apps/mobile/app/login.jsx` | `/login` | 登录页面：收集邮箱、密码，调用登录 API，成功后跳转 Memo 列表 |

> Expo Router 文件路由：`apps/mobile/app/register.jsx` 对应 `/register`，`apps/mobile/app/login.jsx` 对应 `/login`。Memo 列表页（`/`）需在 `AuthContext` 初始化完成后判断 `isAuthenticated`，若未登录则重定向到 `/login`。

---

### 4.2 新增组件

#### 4.2.1 `AuthFormInput`

**文件路径**: `apps/mobile/components/AuthFormInput.jsx`
**具名 export**: `export function AuthFormInput(...)`

**职责**：通用受控输入框，统一封装认证表单中的字段展示、焦点样式、错误提示、密码显示/隐藏切换。

**Props**:

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `label` | `string` | 是 | 输入框标签文字（如"邮箱"、"昵称"、"密码"） |
| `value` | `string` | 是 | 当前输入值（受控） |
| `onChangeText` | `function` | 是 | 文字变更回调 `(text: string) => void` |
| `onBlur` | `function` | 否 | 失焦回调，用于触发字段级验证 `() => void` |
| `error` | `string` | 否 | 字段错误提示文字；有值时输入框边框变红，文字显示在输入框下方 |
| `keyboardType` | `string` | 否 | React Native `keyboardType`，默认 `'default'`；邮箱字段传 `'email-address'` |
| `secureTextEntry` | `boolean` | 否 | 是否为密码模式，默认 `false`；为 `true` 时渲染密码切换眼睛图标 |
| `maxLength` | `number` | 否 | 输入字符上限，超出时阻止继续输入 |
| `editable` | `boolean` | 否 | 是否可编辑，默认 `true`；提交加载期间传 `false` |
| `testID` | `string` | 否 | 供 E2E 测试定位用 |

**负责的用户交互**：
- 聚焦时输入框边框高亮（蓝色）
- 失焦时触发 `onBlur` 回调（注册页使用，登录页不传此 prop）
- `secureTextEntry=true` 时，右侧渲染眼睛图标按钮，点击切换明文/密文；图标状态由组件内部 `useState` 管理
- `error` 非空时，输入框下方渲染红色错误提示文字，边框变红
- `maxLength` 超限时通过 `maxLength` 属性阻止输入，并显示"xxx 最多 N 个字符"提示

---

#### 4.2.2 `AuthFormError`

**文件路径**: `apps/mobile/components/AuthFormError.jsx`
**具名 export**: `export function AuthFormError(...)`

**职责**：表单顶部的统一服务端错误提示区域，用于展示来自后端的错误信息（如"该邮箱已被注册"、"邮箱或密码错误"、"网络连接失败"）。无错误时不渲染（返回 `null`）。

**Props**:

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `message` | `string \| null` | 是 | 错误消息文字；`null` 或空字符串时组件不渲染 |
| `testID` | `string` | 否 | 供 E2E 测试定位用 |

**负责的用户交互**：
- 仅展示，无交互。出现时以红色背景卡片形式展示在表单字段区域上方

---

#### 4.2.3 `AuthSubmitButton`

**文件路径**: `apps/mobile/components/AuthSubmitButton.jsx`
**具名 export**: `export function AuthSubmitButton(...)`

**职责**：认证表单的提交按钮，封装加载状态、禁用状态及文字切换逻辑。

**Props**:

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `label` | `string` | 是 | 正常状态下按钮文字（如"注册"、"登录"） |
| `loadingLabel` | `string` | 是 | 加载状态下按钮文字（如"注册中..."、"登录中..."） |
| `loading` | `boolean` | 是 | 是否处于加载状态；`true` 时按钮禁用并显示 `loadingLabel` |
| `onPress` | `function` | 是 | 点击回调 `() => void` |
| `disabled` | `boolean` | 否 | 额外禁用条件（如隐私协议未勾选），叠加到 `loading` 之上 |
| `testID` | `string` | 否 | 供 E2E 测试定位用 |

**负责的用户交互**：
- 点击时触发 `onPress`
- `loading=true` 或 `disabled=true` 时按钮不可点击，样式呈灰色/半透明

---

#### 4.2.4 `PrivacyCheckbox`

**文件路径**: `apps/mobile/components/PrivacyCheckbox.jsx`
**具名 export**: `export function PrivacyCheckbox(...)`

**职责**：隐私协议勾选框，包含勾选状态、"我已阅读并同意隐私协议"文字及可选的隐私协议链接占位。未勾选且尝试提交时高亮显示错误边框。

**Props**:

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `checked` | `boolean` | 是 | 当前勾选状态（受控） |
| `onChange` | `function` | 是 | 状态变更回调 `(checked: boolean) => void` |
| `error` | `boolean` | 否 | 是否显示错误高亮；`true` 时勾选框边框变红并显示"请阅读并同意隐私协议"提示 |
| `testID` | `string` | 否 | 供 E2E 测试定位用 |

**负责的用户交互**：
- 点击勾选框或文字区域切换 `checked` 状态
- `error=true` 时渲染红色错误提示文字"请阅读并同意隐私协议"

---

### 4.3 Context / Reducer 变更

#### 4.3.1 新增文件：`apps/mobile/context/AuthContext.jsx`

**职责**：全局管理用户登录状态，供所有页面和组件消费认证信息，并提供 `login`、`logout`、`register` 等操作方法。

**State 结构**：

```javascript
const initialState = {
  user: null,          // 当前登录用户对象 { id, email, nickname } 或 null（未登录）
  isAuthenticated: false, // 是否已登录
  loading: true,       // 初始化时为 true，等待 GET /api/auth/me 完成后设为 false
};
```

**Action Types**：

| Action Type | Payload | 触发时机 | state 变化 |
|------------|---------|---------|-----------|
| `AUTH_INIT_SUCCESS` | `{ user }` | `GET /api/auth/me` 成功，用户已登录 | `user = payload.user`, `isAuthenticated = true`, `loading = false` |
| `AUTH_INIT_FAILURE` | 无 | `GET /api/auth/me` 失败或返回未登录 | `user = null`, `isAuthenticated = false`, `loading = false` |
| `AUTH_LOGIN_SUCCESS` | `{ user }` | 登录/注册 API 成功 | `user = payload.user`, `isAuthenticated = true`, `loading = false` |
| `AUTH_LOGOUT` | 无 | 调用 `POST /api/auth/logout` 成功 | `user = null`, `isAuthenticated = false`, `loading = false` |

**Context Value（对外暴露）**：

```javascript
{
  user,           // 当前用户信息
  isAuthenticated,
  loading,        // 初始化 loading，用于防止路由守卫闪屏
  login,          // async (email, password) => { user } | throws Error
  register,       // async (email, nickname, password, agreedAt) => { user } | throws Error
  logout,         // async () => void
}
```

**Reducer 文件位置**：`authReducer` 直接定义在 `AuthContext.jsx` 内部（当前项目体量，无需拆分单独文件）。

**Provider 挂载位置**：`apps/mobile/app/_layout.jsx`（Expo Router 根布局），包裹所有子路由。

---

### 4.4 自定义 Hook

#### 4.4.1 `useAuth`

**文件路径**：在 `AuthContext.jsx` 中定义并具名 export

```javascript
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

**入参**：无

**返回值**：`{ user, isAuthenticated, loading, login, register, logout }`（同 Context Value）

**使用场景**：`register.jsx`、`login.jsx` 及未来需要消费认证状态的任意组件。

---

### 4.5 用户交互流程

#### 4.5.1 注册流程

```
用户打开 /register 页面
    ↓
看到：邮箱输入框 / 昵称输入框 / 密码输入框（含眼睛图标）/ 隐私协议勾选框 /
      "注册"按钮 / "已有账号？返回登录"链接

用户依次填写各字段
    ↓
    [邮箱失焦] → 前端正则验证邮箱格式
        - 不合法 → 邮箱框下方显示"请输入有效的邮箱地址"（红色），边框变红
        - 合法   → 清除邮箱错误提示

    [昵称失焦] → 前端校验长度 2-20 字符（trim 后）
        - 不合法 → 昵称框下方显示对应提示（红色），边框变红
        - 合法   → 清除昵称错误提示

    [密码失焦] → 前端校验长度 8-20 字符
        - 不合法 → 密码框下方显示"密码长度至少为 8 个字符"（红色），边框变红
        - 合法   → 清除密码错误提示

    [昵称输入达到20字] → maxLength 属性阻止继续输入，昵称框下方实时显示"昵称最多 20 个字符"

    [点击眼睛图标] → 密码切换明文/密文显示

用户勾选隐私协议
    ↓ 勾选框状态变为已选中（清除隐私协议错误高亮）

用户点击"注册"按钮
    ↓
    [前端校验] → 逐字段校验，有任意字段错误则阻止提交，高亮对应错误
    [未勾选隐私协议] → 隐私协议框高亮红色 + "请阅读并同意隐私协议"
    [全部通过] →
        表单提交加载状态：
          - "注册"按钮文字变为"注册中..."并禁用
          - 所有输入框变为不可编辑（editable=false）
          - 清除表单顶部服务端错误提示

        调用 POST /api/auth/register（含 agreedAt = Date.now()）
            ↓
        [成功 HTTP 200] →
            dispatch(AUTH_LOGIN_SUCCESS, { user })
            router.replace('/') 跳转到 Memo 列表页面
        [失败 - 邮箱已注册 HTTP 409] →
            表单顶部显示"该邮箱已被注册"
            按钮恢复可点击，输入框恢复可编辑
        [失败 - 网络错误] →
            表单顶部显示"网络连接失败，请稍后重试"
            按钮恢复可点击，输入框恢复可编辑

用户点击"已有账号？返回登录"
    ↓ 清空所有表单字段和错误状态 → router.push('/login')
```

#### 4.5.2 登录流程

```
用户打开 /login 页面
    ↓
看到：邮箱输入框 / 密码输入框（含眼睛图标）/
      "登录"按钮 / "没有账号？立即注册"链接

用户填写邮箱和密码（登录页无失焦实时验证）

用户点击"登录"按钮
    ↓
    表单提交加载状态：
      - "登录"按钮文字变为"登录中..."并禁用
      - 所有输入框变为不可编辑
      - 清除表单顶部错误提示

    调用 POST /api/auth/login
        ↓
    [成功 HTTP 200] →
        dispatch(AUTH_LOGIN_SUCCESS, { user })
        router.replace('/') 跳转到 Memo 列表页面
    [失败 - 邮箱或密码错误 HTTP 401] →
        表单顶部显示"邮箱或密码错误，请重试"
        密码输入框自动清空（value 置为空字符串）
        邮箱输入框保留原内容
        按钮恢复可点击，输入框恢复可编辑
    [失败 - 网络错误] →
        表单顶部显示"网络连接失败，请稍后重试"
        按钮恢复可点击，输入框恢复可编辑

用户点击"没有账号？立即注册"
    ↓ 清空所有表单字段和错误状态 → router.push('/register')
```

#### 4.5.3 全局认证初始化流程（App 启动）

```
App 启动，AuthProvider 挂载
    ↓
loading = true（防止路由守卫闪屏）
    ↓
调用 GET /api/auth/me
    ↓
[成功，返回用户信息] → dispatch(AUTH_INIT_SUCCESS, { user }) → loading = false
[失败或未登录] → dispatch(AUTH_INIT_FAILURE) → loading = false → 路由守卫跳转到 /login

Session 过期场景（用户已在 App 内）：
    任意 API 调用返回 HTTP 401
    → 前端 API Client 统一捕获 401 → dispatch(AUTH_INIT_FAILURE) → router.replace('/login')
    → 登录页面显示（由于是路由跳转，不显示额外"过期"提示；后续可优化为 toast 提示）
```

---

### 4.6 调用的 API 端点

以下 API 根据数据模型（§2）及 REST 惯例推断，与 backend-developer 保持一致约定。

⚠️ **API 路径与§3不完全一致，已更正如下，以§3为准：**

#### 4.6.1 `POST /api/auth/register` — 用户注册

**调用时机**：用户点击注册按钮且前端验证全部通过

**请求**：

```json
{
  "email": "user@example.com",
  "nickname": "小明",
  "password": "mypassword123",
  "agreedToPrivacy": true
}
```

⚠️ **API 路径已更正，以 §3 为准：请求体字段名为 `agreedToPrivacy`（boolean），前端需提交时计算 `agreedAt` 时间戳的设计已废弃。§3 定义的后端接收 `agreedToPrivacy` 为 `true` 后，由后端在插入数据库时自动记录 `agreed_at = Date.now()`。**

| 字段 | 类型 | 说明 |
|------|------|------|
| `email` | string | 用户邮箱，前端已做格式验证 |
| `nickname` | string | 用户昵称，前端已做长度验证（2-20 字符，trim 后） |
| `password` | string | 明文密码，前端已做长度验证（8-20 字符），后端负责哈希 |
| `agreedToPrivacy` | boolean | 用户是否同意隐私协议，前端传 `true`，后端记录时间戳 |

**成功响应** (`HTTP 201`)：

```json
{
  "data": {
    "id": "uuid-string",
    "email": "user@example.com",
    "nickname": "小明",
    "createdAt": 1741824000000
  },
  "message": "注册成功"
}
```

**失败响应**：

| HTTP 状态码 | `error` 字段 | 场景 |
|------------|-------------|------|
| 409 | `"该邮箱已被注册"` | 邮箱已被注册（§3） |
| 400 | `"请求参数格式错误"` | 请求参数格式非法（后端兜底）（§3） |
| 500 | `"服务器内部错误，请稍后重试"` | 服务端内部错误（§3） |

---

#### 4.6.2 `POST /api/auth/login` — 用户登录

**调用时机**：用户点击登录按钮

**请求**：

```json
{
  "email": "user@example.com",
  "password": "mypassword123"
}
```

**成功响应** (`HTTP 200`)：

```json
{
  "data": {
    "id": "uuid-string",
    "email": "user@example.com",
    "nickname": "小明",
    "createdAt": 1741824000000
  },
  "message": "登录成功"
}
```

**失败响应**：

| HTTP 状态码 | `error` 字段 | 场景 |
|------------|-------------|------|
| 401 | `"邮箱或密码错误，请重试"` | 邮箱或密码错误（不区分具体哪个，防止用户枚举）（§3） |
| 400 | `"请求参数格式错误"` | 请求参数格式非法（§3） |

---

#### 4.6.3 `POST /api/auth/logout` — 用户登出

**调用时机**：用户主动点击登出（在未来的用户设置/个人中心页面使用；本次不实现登出入口，但 `AuthContext` 已预留 `logout` 方法）

**请求**：无 Body（通过 Cookie 中的 Session ID 识别用户）

**成功响应** (`HTTP 200`)：

```json
{
  "data": null,
  "message": "已成功登出"
}
```

⚠️ **API 路径已更正，以 §3 为准：成功响应 message 为"已成功登出"，而非"已登出"。**

---

#### 4.6.4 `GET /api/auth/me` — 获取当前登录用户信息

**调用时机**：App 启动时，`AuthProvider` 挂载后立即调用，用于恢复登录状态

**请求**：无 Body（通过 Cookie 中的 Session ID 识别用户）

**成功响应** (`HTTP 200`，已登录)：

```json
{
  "data": {
    "id": "uuid-string",
    "email": "user@example.com",
    "nickname": "小明",
    "createdAt": 1741824000000
  },
  "message": "获取用户信息成功"
}
```

**失败响应**：

| HTTP 状态码 | `error` 字段 | 场景 |
|------------|-------------|------|
| 401 | `"请先登录"` | 未登录或 Session 已过期（§3） |

---

### 4.7 文件清单汇总

| 文件路径 | 类型 | 操作 |
|---------|------|------|
| `apps/mobile/app/register.jsx` | Screen | 新增 |
| `apps/mobile/app/login.jsx` | Screen | 新增 |
| `apps/mobile/components/AuthFormInput.jsx` | Component | 新增 |
| `apps/mobile/components/AuthFormError.jsx` | Component | 新增 |
| `apps/mobile/components/AuthSubmitButton.jsx` | Component | 新增 |
| `apps/mobile/components/PrivacyCheckbox.jsx` | Component | 新增 |
| `apps/mobile/context/AuthContext.jsx` | Context + Reducer + Hook | 新增 |
| `apps/mobile/app/_layout.jsx` | Root Layout | 修改（挂载 `AuthProvider`，添加路由守卫逻辑） |

> `apps/mobile/app/_layout.jsx` 若为首次创建则标记为"新增"；若已存在则为"修改"。本次为项目首个设计文档，按"新增"处理，实现时以实际文件是否存在为准。

---

### 4.8 设计约束与注意事项

1. **无 TypeScript**：所有文件使用 `.jsx` / `.js` 后缀，遵循项目规范，不引入 TypeScript。
2. **状态管理**：使用 React Context + useReducer，禁止引入 Redux / Zustand。
3. **路由**：使用 Expo Router 文件路由，`router.replace('/')` 替代 `navigation.navigate` 确保登录后无法返回认证页面。
4. **API 请求**：统一通过 `apps/mobile/lib/` 下的 API Client 发起（HTTP Client 已有或需新建），请求需携带 `credentials: 'include'`（Web 平台）以传递 Cookie。
5. **错误处理**：API Client 统一捕获 HTTP 401，触发全局登出（dispatch `AUTH_INIT_FAILURE`）。
6. **无 XSS 风险**：用户输入均作为纯文本渲染，不使用 `dangerouslySetInnerHTML` 或等效 API。
7. **loading 防闪屏**：`AuthContext.loading=true` 期间，根布局渲染加载占位而非直接渲染子路由，防止未登录状态短暂闪现业务页面。

---

## §5 改动文件清单

### 新增

**后端**:
- `apps/server/src/routes/auth.js` — 认证路由模块（包含注册、登录、登出、获取当前用户 4 个端点）
- `apps/server/src/lib/auth.js` — `requireAuth` 鉴权中间件
- `apps/server/src/plugins/session.js` — Fastify Session 插件配置（如不存在则新建）
- `apps/server/src/db/migrations/` 下的迁移文件 — 新增 `users` 表结构

**前端**:
- `apps/mobile/app/register.jsx` — 注册页面 Screen
- `apps/mobile/app/login.jsx` — 登录页面 Screen
- `apps/mobile/components/AuthFormInput.jsx` — 通用认证表单输入框组件
- `apps/mobile/components/AuthFormError.jsx` — 服务端错误提示组件
- `apps/mobile/components/AuthSubmitButton.jsx` — 提交按钮组件
- `apps/mobile/components/PrivacyCheckbox.jsx` — 隐私协议勾选框组件
- `apps/mobile/context/AuthContext.jsx` — 全局认证状态 Context + Reducer + `useAuth` Hook
- `apps/mobile/lib/api-client.js` — 统一 HTTP 请求封装（若不存在则新建）

### 修改

**后端**:
- `apps/server/src/db/schema.js` — 新增 `users` 表的 Drizzle schema 定义
- `apps/server/src/index.js` — 注册 `authRoutes` plugin（`fastify.register(authRoutes, { prefix: '/api/auth' })`）

**前端**:
- `apps/mobile/app/_layout.jsx` — 挂载 `AuthProvider`，添加路由守卫逻辑（`loading=true` 期间显示加载占位，`isAuthenticated=false` 时重定向到 `/login`）

---

## §6 技术约束与风险

### 输入校验

**前端校验**（字段级，注册页失焦时 + 提交前全量校验）：
- `email`：正则 `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` 验证格式
- `nickname`：trim 后长度 2-20 字符，不允许纯空格（`/^\s*$/.test()` 为 `true` 时拒绝）
- `password`：长度 8-20 字符
- `agreedToPrivacy`：必须为 `true`

**后端校验**（JSON Schema + Drizzle 约束，所有字段都需校验）：
- `email`：AJV `format: 'email'` + `maxLength: 254` + 数据库 UNIQUE 约束
- `nickname`：`minLength: 2`, `maxLength: 20`, `pattern: '^(?!\\s*$).+'`（不允许纯空格），服务端 trim 后再存储
- `password`：`minLength: 8`, `maxLength: 20`，后端 bcrypt 哈希后不可逆存储
- `agreedToPrivacy`：`enum: [true]`

### 安全

- **XSS 防护**：所有用户输入（`email`、`nickname`）在前端渲染时作为纯文本，禁止使用 `dangerouslySetInnerHTML` 或 HTML 拼接
- **密码存储**：后端必须使用 bcrypt（saltRounds=10）哈希，禁止明文或弱哈希算法（如 MD5、SHA1）
- **Session Cookie 安全**：
  - `httpOnly: true` — 防止 XSS 窃取 Cookie
  - `sameSite: 'strict'` — 防止 CSRF 攻击
  - `secure: true`（生产环境）— 仅通过 HTTPS 传输
  - Session 有效期：7 天（`maxAge: 7 * 24 * 60 * 60 * 1000`）
- **认证边界**：
  - `GET /api/auth/me`、`POST /api/auth/logout` 使用 `requireAuth` 中间件保护
  - 未来所有业务 API（Memo CRUD 等）都需添加 `preHandler: [requireAuth]`
- **错误信息不泄露**：
  - 登录失败统一返回"邮箱或密码错误"，不区分"用户不存在"或"密码错误"（防止用户枚举攻击，符合 FR-007）
  - 服务端内部错误统一返回"服务器内部错误，请稍后重试"，不暴露技术细节（栈跟踪、SQL 语句等仅记录到服务端日志）

### 性能

- **N+1 查询**：当前注册/登录流程单次查询即可完成（按 `email` 查询 `users` 表），无 N+1 风险
- **并发注册竞态条件**：
  - 数据库 `email` 字段设置 UNIQUE 约束，确保并发插入时仅有一个成功
  - 前端收到 HTTP 409 时显示"该邮箱已被注册"，引导用户登录
- **Session 存储性能**：
  - 使用 SQLite 存储 Session，读写性能足够支撑 MVP 阶段流量（预计 <1000 QPS）
  - 未来流量增长时可迁移至 Redis（修改 Session 插件配置，业务代码无需变更）
- **分页**：
  - 本次功能不涉及列表数据，无需分页
  - 未来 Memo 列表等接口需引入分页（默认 `limit=20`，支持 `offset` 或 `cursor` 参数）

### 兼容性

- **与现有功能的兼容性风险**：
  - 当前代码库无已有功能（本次为首个设计文档），无兼容性冲突
  - 未来新增业务表（如 `memos`）时，需添加 `userId` 外键引用 `users.id`，设置 `onDelete: 'cascade'` 确保用户注销时级联删除所有关联数据
- **Session 与 Stateless API 共存**：
  - MVP 阶段统一使用 Session-Cookie 认证
  - 未来若需支持移动端 Native App OAuth 或 API Token 认证，需在 `requireAuth` 中间件中添加 Token 校验逻辑（优先级：Token > Session > 401）
- **前端路由守卫边界**：
  - `AuthContext.loading=true` 期间，根布局必须阻塞所有子路由渲染，防止未登录状态短暂闪现业务页面
  - 若 `GET /api/auth/me` 超时或失败，需在 5 秒后超时降级为"未登录"状态，跳转到 `/login`

---

## §7 不包含（范围边界）

本次技术方案**明确不包含**以下功能，防止实现阶段范围蔓延：

1. **忘记密码 / 重置密码功能** — 需引入邮件发送服务（SMTP 配置、验证码存储），未来单独实现
2. **邮箱验证 / 邮件激活** — MVP 阶段注册即可使用，无需邮箱验证；未来根据合规要求决定是否实施
3. **第三方登录（OAuth）** — 如 Google / Apple / GitHub 登录，未来根据用户需求单独实现
4. **个人中心 / 账号设置页面** — 修改昵称、修改密码、注销账号等功能，未来单独设计
5. **多设备管理 / Session 列表** — 查看当前登录设备、踢出其他设备等功能，未来根据安全需求实施
6. **登录日志 / 操作审计** — 记录用户登录时间、IP、设备信息等，未来根据合规要求实施
7. **验证码 / 图形验证码** — 防止机器人注册，未来根据滥用情况决定是否引入
8. **密码强度指示器** — 注册页面实时显示密码强度（弱 / 中 / 强），未来作为体验优化项
9. **自动登出（无操作超时）** — 当前 Session 固定 7 天有效，无滑动过期机制；未来根据安全要求实施
10. **手机号注册 / 短信验证码登录** — MVP 阶段仅支持邮箱 + 密码，未来根据用户需求扩展
