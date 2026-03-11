# 技术方案：账号注册与登录

**关联 Spec**: `specs/active/43-feature-account-registration-login-3.md`
**关联 Issue**: #43
**生成日期**: 2026-03-11

---

## §1 功能概述

### 核心目标

为 AIFlomo 建立用户身份认证基础设施，支持新用户邮箱注册和已有用户密码登录，并通过 Session Cookie 维持登录状态。

### 系统定位

本模块是 AIFlomo 全栈应用的**身份认证基础层**，是所有需要用户身份的功能（Memo 的创建/读取/删除、标签管理、多端同步）的前置依赖。没有本模块，任何涉及用户数据隔离的功能都无法正常运作。

系统层级关系如下：

```
[注册/登录模块]  ←  本次实现
       ↓
[Session 认证层]  ←  @fastify/session + SQLite store
       ↓
[业务功能层]      ←  Memo、标签、搜索（后续迭代）
```

本次是项目从零出发的第一次数据库建表，users 表将成为所有业务表通过外键关联的根节点。

### 用户价值

**解决的问题**：用户数据在多次访问之间无法持久化，匿名状态下无法实现跨端同步或个人数据隔离。

**带来的体验提升**：
- 用户完成一次注册后，在任意设备（Web / Android / iOS）登录即可恢复全部 Memo 记录。
- 注册成功自动登录，省去二次输入密码的操作摩擦。
- 7 天 Session 有效期在安全与便利之间取得平衡，避免频繁重新登录。
- 实时表单验证（失焦触发）在提交前即告知用户输入错误，降低提交失败的挫败感。

---

## §2 数据模型变更

### 2.1 整体说明

本次为新项目首次建库，需创建两张表：

| 表名 | 说明 |
|------|------|
| `users` | 存储注册用户信息，包含身份标识、认证凭据和元数据 |
| `sessions` | 存储 Session 数据，供 `@fastify/session` 的 SQLite store 使用 |

`sessions` 表由 Session store 适配器（`better-sqlite3-session-store` 或同类库）自动管理，不需要在业务层直接读写，但需要在 schema 中定义以便 Drizzle migrate 创建表结构（或由 store 自行建表，见 2.3 节说明）。

### 2.2 users 表

**设计决策**：
- `id` 使用 UUID（`crypto.randomUUID()`），避免自增整数 ID 在分布式或多端场景下的冲突风险，且不暴露账号数量信息。
- `email` 加 `UNIQUE` 约束，数据库层面保证并发注册时只有一个成功（配合唯一索引，防止竞态条件下的重复注册）。
- `passwordHash` 存储 bcrypt 哈希值，绝不存储明文密码。哈希算法在 `src/lib/password.js` 中封装，bcrypt salt rounds 默认为 12。
- `nickname` 允许 2-20 字符（含中文、英文、数字），约束在应用层校验，数据库层存储 text 不限长度（保持 schema 灵活性）。
- `agreedToPrivacyAt` 记录用户同意隐私协议的时间戳，用于合规审计。`NOT NULL` 约束确保所有账号都经过了协议同意步骤。
- `createdAt` 使用 SQLite 的 `CURRENT_TIMESTAMP` 默认值，存储为 ISO 8601 文本（Drizzle SQLite 惯用方式）。

```js
// src/db/schema.js（users 表定义）
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  // 主键：UUID 文本，由应用层生成
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // 邮箱：唯一约束，用于登录和账号识别
  email: text('email').notNull().unique(),

  // 密码哈希：bcrypt 哈希后存储，永不存明文
  passwordHash: text('password_hash').notNull(),

  // 昵称：用于 UI 显示，2-20 字符（约束在应用层校验）
  nickname: text('nickname').notNull(),

  // 隐私协议同意时间戳：合规审计用，注册时必须记录
  agreedToPrivacyAt: text('agreed_to_privacy_at').notNull(),

  // 账号创建时间：自动填充，ISO 8601 格式文本
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});
```

**字段一览**：

| JS 字段名 | DB 列名 | 类型 | 约束 | 说明 |
|-----------|---------|------|------|------|
| `id` | `id` | TEXT | PK | UUID，应用层 `crypto.randomUUID()` 生成 |
| `email` | `email` | TEXT | NOT NULL, UNIQUE | 登录凭据，唯一索引防重复注册 |
| `passwordHash` | `password_hash` | TEXT | NOT NULL | bcrypt 哈希，salt rounds = 12 |
| `nickname` | `nickname` | TEXT | NOT NULL | 显示名称，2-20 字符 |
| `agreedToPrivacyAt` | `agreed_to_privacy_at` | TEXT | NOT NULL | 同意隐私协议的 ISO 8601 时间戳 |
| `createdAt` | `created_at` | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 注册时间 |

### 2.3 sessions 表

**Session 存储策略**：

CLAUDE.md 明确要求"Session 存储于 SQLite 同库"。`@fastify/session` 支持可插拔的 session store，需配合 SQLite 适配器使用。

推荐使用 `better-sqlite3-session-store`（基于 `better-sqlite3`，与 Drizzle 使用的 SQLite 驱动一致）或自行实现轻量 store。该 store 通常自行在数据库中建表（表名默认为 `sessions`），不依赖 Drizzle migrate。

**选项 A（推荐）：由 store 自行建表**

store 初始化时自动执行 `CREATE TABLE IF NOT EXISTS sessions ...`，无需在 Drizzle schema 中定义该表。Drizzle 只管理业务表（`users`、`memos` 等），session 表由 store 维护。

优点：sessions 表结构由 store 库约定，无需手动维护迁移文件。
缺点：sessions 表不在 Drizzle schema 中可见，无法通过 Drizzle Studio 直接查询。

**选项 B：在 Drizzle schema 中显式定义**

若需要通过 Drizzle migrate 统一管理所有表，可在 schema 中定义如下结构（以 `connect-sqlite3` 等常见 store 的表结构为参考）：

```js
// src/db/schema.js（sessions 表定义 — 仅选项 B 使用）
export const sessions = sqliteTable('sessions', {
  // Session ID：store 生成的唯一标识符
  sid: text('sid').primaryKey(),

  // Session 数据：JSON 序列化的会话内容（包含 userId 等）
  sess: text('sess').notNull(),

  // 过期时间：Unix 时间戳（毫秒），store 用于清理过期会话
  expire: integer('expire').notNull(),
});
```

**字段一览**：

| JS 字段名 | DB 列名 | 类型 | 约束 | 说明 |
|-----------|---------|------|------|------|
| `sid` | `sid` | TEXT | PK | Session ID，由 `@fastify/session` 生成 |
| `sess` | `sess` | TEXT | NOT NULL | JSON 序列化的 session 数据（含 `userId`） |
| `expire` | `expire` | INTEGER | NOT NULL | 过期时间戳（毫秒），供 store 清理任务使用 |

**推荐决策**：优先采用选项 A，在 `session.js` plugin 中配置 store 并由其自动建表，保持 Drizzle schema 专注于业务实体。若项目后期需要统一数据库版本管理，再迁移至选项 B。

### 2.4 外键设计预留

虽然本次仅创建 `users` 和 `sessions` 表，但后续所有业务表（`memos`、`tags` 等）都将通过外键引用 `users.id`，并使用 `onDelete: 'cascade'` 确保用户注销时其所有数据随之级联删除。

示例（后续迭代中 memos 表的引用方式）：

```js
// 后续 memos 表引用 users 的方式（供参考，不在本次创建）
userId: text('user_id')
  .notNull()
  .references(() => users.id, { onDelete: 'cascade' }),
```

`onDelete: 'cascade'` 的设计理由：
- **数据完整性**：用户删除账号后，其 Memo、标签等孤立数据自动清理，避免数据库出现无主记录。
- **隐私合规**：满足"用户有权删除其所有数据"的基本合规要求（GDPR 精神）。
- **操作简洁**：只需删除 `users` 表中的一行，数据库自动完成关联数据的清理，无需在应用层编排多步删除。

### 2.5 完整 schema.js 骨架（本次实现范围）

```js
// src/db/schema.js
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ── users 表：注册用户，所有业务数据的根节点 ──────────────────────────────
export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  email: text('email').notNull().unique(),

  passwordHash: text('password_hash').notNull(),

  nickname: text('nickname').notNull(),

  agreedToPrivacyAt: text('agreed_to_privacy_at').notNull(),

  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

// ── sessions 表：仅在选项 B（Drizzle 统一管理）时启用 ────────────────────
// 如使用 store 自动建表（选项 A），注释掉此定义
// export const sessions = sqliteTable('sessions', {
//   sid: text('sid').primaryKey(),
//   sess: text('sess').notNull(),
//   expire: integer('expire').notNull(),
// });
```

---

## §3 API 端点设计

### 3.0 总体约定

**路由文件**：所有认证端点集中在 `apps/server/src/routes/auth.js`，以 Fastify plugin 形式导出，注册时添加 `/api/auth` 前缀。

**统一响应格式**（遵循 CLAUDE.md 规范）：

```js
// 成功响应
{ data: value, message: string }

// 失败响应（由全局 errorHandler 处理）
{ data: null, error: string, message: string }
```

**Session 配置**（遵循 architect 数据模型 §2）：
- Session 存储于 SQLite 同库（`@fastify/session` + SQLite store）
- Cookie 配置：`httpOnly: true`、`sameSite: 'strict'`、生产环境 `secure: true`
- Session 有效期：7 天（`maxAge: 7 * 24 * 60 * 60 * 1000`）
- Session 中存储字段：`userId`（对应 `users.id` 的 UUID）

**密码处理**（遵循 architect 数据模型 §2.2）：
- 使用 `bcrypt`，salt rounds = 12
- 密码哈希逻辑封装在 `apps/server/src/lib/password.js`
- 永不在响应中返回 `passwordHash` 字段

**鉴权 preHandler**（来自 `apps/server/src/plugins/auth.js`）：
- `requireAuth`：检查 `request.session.userId` 是否存在，不存在则返回 401

---

### 3.1 POST /api/auth/register — 用户注册

**文件路径**：`apps/server/src/routes/auth.js`

**HTTP 方法**：`POST`

**完整路径**：`POST /api/auth/register`

**鉴权**：不需要（公开端点，无 `preHandler: [requireAuth]`）

#### 请求验证 JSON Schema

```js
const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'nickname', 'password', 'agreedToPrivacy'],
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
      agreedToPrivacy: {
        type: 'boolean',
        enum: [true],
      },
    },
    additionalProperties: false,
  },
};
```

#### 业务逻辑

1. JSON Schema 验证通过后，应用层追加校验 `nickname` 字符集（不允许纯空格或特殊符号）
2. 查询 `users` 表，检查 `email` 是否已存在（`UNIQUE` 约束兜底，应用层主动检查以返回友好错误）
3. 若邮箱未注册：
   - 使用 `bcrypt.hash(password, 12)` 生成 `passwordHash`
   - 记录 `agreedToPrivacyAt`：`new Date().toISOString()`
   - 插入 `users` 表（`id` 由 `crypto.randomUUID()` 自动生成）
4. 注册成功后自动登录：将新用户的 `id` 写入 `request.session.userId`（session 自动持久化到 SQLite store）
5. 响应返回用户公开信息（不含 `passwordHash`）

#### 成功响应

**HTTP 状态码**：`201 Created`

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

#### 失败响应清单

| HTTP 状态码 | `error` 字段 | `message` 字段 | 触发场景 |
|------------|-------------|---------------|---------|
| 400 | `VALIDATION_ERROR` | `请求参数不合法` | JSON Schema 验证失败（字段缺失、格式错误、agreedToPrivacy 不为 true 等） |
| 400 | `INVALID_NICKNAME` | `昵称只能包含中文、英文和数字` | 昵称包含特殊符号或纯空格，应用层校验 |
| 409 | `EMAIL_ALREADY_EXISTS` | `该邮箱已被注册` | 邮箱已存在于 `users` 表 |
| 500 | `INTERNAL_ERROR` | `服务器内部错误` | 数据库写入失败等未预期错误 |

---

### 3.2 POST /api/auth/login — 用户登录

**文件路径**：`apps/server/src/routes/auth.js`

**HTTP 方法**：`POST`

**完整路径**：`POST /api/auth/login`

**鉴权**：不需要（公开端点，无 `preHandler: [requireAuth]`）

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

#### 业务逻辑

1. JSON Schema 验证通过
2. 根据 `email` 查询 `users` 表，获取 `id`、`passwordHash`、`nickname`、`createdAt`
3. 若用户不存在，**不区分"邮箱不存在"和"密码错误"**，统一返回 401 错误 `INVALID_CREDENTIALS`（遵循 spec FR-007，防止账号枚举攻击）
4. 使用 `bcrypt.compare(password, user.passwordHash)` 验证密码
5. 密码不匹配，同样返回 401 `INVALID_CREDENTIALS`（同一错误码，不泄露具体失败原因）
6. 验证通过：将 `user.id` 写入 `request.session.userId`，session 自动持久化
7. 返回用户公开信息

#### 成功响应

**HTTP 状态码**：`200 OK`

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

#### 失败响应清单

| HTTP 状态码 | `error` 字段 | `message` 字段 | 触发场景 |
|------------|-------------|---------------|---------|
| 400 | `VALIDATION_ERROR` | `请求参数不合法` | JSON Schema 验证失败（字段缺失、邮箱格式错误） |
| 401 | `INVALID_CREDENTIALS` | `邮箱或密码错误，请重试` | 邮箱不存在 **或** 密码错误，统一返回 |
| 500 | `INTERNAL_ERROR` | `服务器内部错误` | 数据库查询失败等未预期错误 |

---

### 3.3 POST /api/auth/logout — 用户登出

**文件路径**：`apps/server/src/routes/auth.js`

**HTTP 方法**：`POST`

**完整路径**：`POST /api/auth/logout`

**鉴权**：需要（`preHandler: [requireAuth]`）

**说明**：使用 POST 而非 GET，遵循 RESTful 语义（登出是一个有副作用的操作，需要销毁 session 状态）。使用 POST 还可防止 CSRF 攻击（GET 请求可被第三方页面通过 `<img src>` 等方式触发）。

#### 请求验证 JSON Schema

无请求体，无需 schema。

#### 业务逻辑

1. `requireAuth` preHandler 确认 session 有效（`userId` 存在）
2. 调用 `request.session.destroy()` 销毁服务端 session 记录（从 SQLite store 中删除对应记录）
3. `@fastify/session` 自动清除客户端 Cookie（通过 Set-Cookie 设置过期）
4. 返回成功响应

#### 成功响应

**HTTP 状态码**：`200 OK`

```json
{
  "data": null,
  "message": "已成功登出"
}
```

#### 失败响应清单

| HTTP 状态码 | `error` 字段 | `message` 字段 | 触发场景 |
|------------|-------------|---------------|---------|
| 401 | `Unauthorized` | `请先登录` | 未登录状态下调用登出 |
| 500 | `INTERNAL_ERROR` | `服务器内部错误` | session 销毁失败等未预期错误 |

---

### 3.4 GET /api/auth/session — 获取当前会话状态

**文件路径**：`apps/server/src/routes/auth.js`

**HTTP 方法**：`GET`

**完整路径**：`GET /api/auth/session`

**鉴权**：不使用 `requireAuth`（此端点专门用于检测登录状态，未登录时应返回明确的未登录信息而非 401 错误）

**用途**：前端应用启动时调用此端点判断用户是否已登录，决定展示登录页还是 Memo 列表页。

#### 请求验证 JSON Schema

无请求体，无需 schema（GET 请求）。

#### 业务逻辑

1. 检查 `request.session.userId` 是否存在
2. 若存在，查询 `users` 表获取用户公开信息（验证用户记录仍然有效）
3. 若 session 中有 `userId` 但数据库中用户已不存在（账号已删除），销毁 session 并返回未登录状态
4. 若不存在，直接返回未登录状态（不抛出错误）

#### 成功响应（已登录）

**HTTP 状态码**：`200 OK`

```json
{
  "data": {
    "loggedIn": true,
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "nickname": "小明",
      "createdAt": "2026-03-11T08:00:00.000Z"
    }
  },
  "message": "ok"
}
```

#### 成功响应（未登录）

**HTTP 状态码**：`200 OK`

```json
{
  "data": {
    "loggedIn": false,
    "user": null
  },
  "message": "ok"
}
```

**说明**：未登录状态返回 200 而非 401，是因为"未登录"是一种合法的应用状态（用户首次访问），前端需要用它来做路由决策，不应将其视为错误。

#### 失败响应清单

| HTTP 状态码 | `error` 字段 | `message` 字段 | 触发场景 |
|------------|-------------|---------------|---------|
| 500 | `INTERNAL_ERROR` | `服务器内部错误` | 数据库查询失败等未预期错误 |

---

### 3.5 端点汇总表

| 端点 | 方法 | 鉴权 | 功能 | 成功状态码 |
|------|------|------|------|-----------|
| `/api/auth/register` | POST | 无 | 用户注册（自动登录） | 201 |
| `/api/auth/login` | POST | 无 | 用户登录 | 200 |
| `/api/auth/logout` | POST | requireAuth | 用户登出（销毁 session） | 200 |
| `/api/auth/session` | GET | 无（内部检查） | 查询当前会话状态 | 200 |

---

## §4 前端页面与组件设计

### 4.1 新增 Screen（Expo Router 文件路由）

所有认证页面放在 `(auth)` 路由分组下，分组本身不影响 URL 路径。

#### 4.1.1 根布局（新增）

| 文件路径 | 说明 |
|---------|------|
| `apps/mobile/app/_layout.jsx` | 根布局，包裹 `AuthProvider`，提供全局 Auth 状态 |

说明：根布局负责将 `AuthProvider` 注入整个应用，确保所有子页面都可访问登录状态。页面导航由 Expo Router 的 `Stack` 组件管理。

#### 4.1.2 认证组布局（新增）

| 文件路径 | 对应 URL | 说明 |
|---------|---------|------|
| `apps/mobile/app/(auth)/_layout.jsx` | — | 认证路由分组布局，无导航栏，纯白背景 |

#### 4.1.3 注册页面（新增）

| 文件路径 | 对应 URL | 说明 |
|---------|---------|------|
| `apps/mobile/app/(auth)/register.jsx` | `/register` | 新用户注册页面，收集邮箱、昵称、密码、隐私协议同意信息 |

**表单字段与验证规则**：

| 字段 | 输入类型 | 验证规则 | 错误提示文案 |
|------|---------|---------|------------|
| 邮箱 | `email` / `keyboardType="email-address"` | 非空 + 正则格式（含 @ 和域名） | "请输入有效的邮箱地址" |
| 昵称 | `text` | 非空 + 长度 2-20 字符（允许中英文数字，禁止纯空格） | "昵称长度为 2-20 个字符" / "昵称格式不正确" |
| 密码 | `password`（`secureTextEntry`） | 非空 + 长度 8-20 字符 | "密码长度至少为 8 个字符" / "密码最多 20 个字符" |
| 隐私协议勾选 | `Checkbox`（自定义实现） | 必须为 true | "请阅读并同意隐私协议" |

**调用的 API 端点**：

- `POST /api/auth/register`
  - 请求体：`{ email, nickname, password, agreedToPrivacy: true }`
  - 成功响应：`{ data: { id, email, nickname, createdAt }, message: "注册成功" }`
  - 失败响应：`{ data: null, error: "EMAIL_ALREADY_EXISTS", message: "该邮箱已被注册" }`

---

#### 4.1.4 登录页面（新增）

| 文件路径 | 对应 URL | 说明 |
|---------|---------|------|
| `apps/mobile/app/(auth)/login.jsx` | `/login` | 已注册用户登录页面，收集邮箱和密码 |

**表单字段与验证规则**（登录页仅在提交时验证，不做失焦验证以降低摩擦）：

| 字段 | 输入类型 | 验证规则（提交时） | 错误提示文案 |
|------|---------|----------------|------------|
| 邮箱 | `email` / `keyboardType="email-address"` | 非空 + 基本格式检查 | "请输入邮箱" |
| 密码 | `password`（`secureTextEntry`） | 非空 | "请输入密码" |

**调用的 API 端点**：

- `POST /api/auth/login`
  - 请求体：`{ email, password }`
  - 成功响应：`{ data: { id, email, nickname, createdAt }, message: "登录成功" }`
  - 失败响应：`{ data: null, error: "INVALID_CREDENTIALS", message: "邮箱或密码错误，请重试" }`

---

### 4.2 新增组件

所有组件位于 `apps/mobile/components/` 下，使用具名导出（`export function`）。

#### 4.2.1 FormInput — 通用表单输入框组件

**文件路径**：`apps/mobile/components/FormInput.jsx`

**职责**：封装 React Native `TextInput`，统一处理聚焦状态样式（蓝色边框）、错误状态样式（红色边框）、错误文字展示、密码明文/密文切换（眼睛图标）。

**关键 Props**：`label`, `value`, `onChangeText`, `onBlur`, `error`, `secureTextEntry`, `keyboardType`, `editable`, `maxLength`, `placeholder`

#### 4.2.2 FormButton — 通用提交按钮组件

**文件路径**：`apps/mobile/components/FormButton.jsx`

**职责**：封装 React Native `Pressable`，统一处理加载中状态（显示文字变体）、禁用状态（降低透明度）、按压反馈（背景色变深）。

**关键 Props**：`label`, `loadingLabel`, `onPress`, `isLoading`, `disabled`

#### 4.2.3 FormError — 表单顶部服务端错误提示组件

**文件路径**：`apps/mobile/components/FormError.jsx`

**职责**：展示来自服务端的错误信息（如"该邮箱已被注册"、"邮箱或密码错误"），显示在表单顶部，为红色背景提示框。`message` 为 null 或空字符串时自动隐藏（不渲染）。

**关键 Props**：`message`

#### 4.2.4 PrivacyCheckbox — 隐私协议勾选组件

**文件路径**：`apps/mobile/components/PrivacyCheckbox.jsx`

**职责**：渲染隐私协议勾选行，包含自定义勾选框（React Native 无内置 Checkbox）和协议文字。未勾选提交时显示红色高亮边框和错误文字。

**关键 Props**：`checked`, `onToggle`, `error`

---

### 4.3 Context / Reducer 变更

#### 4.3.1 AuthContext — 新增

**文件路径**：`apps/mobile/context/AuthContext.jsx`

**职责**：管理全局用户登录状态（user 信息、isLoading、error），提供 login、logout、register 三个 action，供全局路由保护和 Profile 页面展示用户信息使用。

**状态结构**：

```js
const initialState = {
  user: null,        // 登录成功后的用户对象 { id, email, nickname, createdAt }，未登录时为 null
  isLoading: false,  // 正在检查登录状态（如 app 启动时从服务端恢复 session）
  error: null,       // 全局认证错误（通常由页面级 state 处理，Context 中备用）
};
```

**Action 类型**：

| Action Type | Payload | 说明 |
|-------------|---------|------|
| `AUTH_INIT_START` | — | App 启动时开始检查 Session 状态 |
| `AUTH_INIT_DONE` | `user \| null` | Session 检查完毕，payload 为用户对象或 null |
| `LOGIN_SUCCESS` | `user` | 登录或注册成功，payload 为用户对象 |
| `LOGOUT` | — | 用户登出，清空 user |
| `AUTH_ERROR` | `error message` | 认证过程出错 |

**Provider 实现要点**：

App 启动时检查 Session 是否仍有效：调用 `GET /api/auth/session`。

**注意**：frontend-developer subagent 原设计使用 `GET /api/auth/me`，但 backend-developer 的实际实现为 `GET /api/auth/session`。前端应调用 `/api/auth/session` 端点。

---

### 4.4 自定义 Hook 变更

#### 4.4.1 useAuth — 新增

**文件路径**：`apps/mobile/hooks/use-auth.js`

**职责**：对外暴露 AuthContext 的状态和常用操作（login、logout、register），组件不直接调用 `dispatch`，通过此 Hook 的封装方法操作。

**暴露接口**：`user`, `isLoading`, `isAuthenticated`, `register`, `login`, `logout`

**设计说明**：`register` 和 `login` 的异步错误由调用方（页面组件）的 `try/catch` 捕获，并更新页面级 `serverError` 状态。Hook 本身不处理错误，保持单一职责。

---

### 4.5 API 端点汇总（前端视角）

| 端点 | Method | 调用时机 | 成功后操作 |
|------|--------|---------|----------|
| `POST /api/auth/register` | POST | 注册表单提交 | dispatch LOGIN_SUCCESS + 跳转 /memo |
| `POST /api/auth/login` | POST | 登录表单提交 | dispatch LOGIN_SUCCESS + 跳转 /memo |
| `POST /api/auth/logout` | POST | 用户主动登出（预留） | dispatch LOGOUT + 跳转 /login |
| `GET /api/auth/session` | GET | App 启动时，检查 Session | dispatch AUTH_INIT_DONE(user 或 null) |

---

## §5 改动文件清单

### 新增文件

#### 后端（apps/server）

- `apps/server/src/routes/auth.js` — 认证路由（注册、登录、登出、会话状态）
- `apps/server/src/db/schema.js` — Drizzle schema 定义（users 表，sessions 表视配置选项）
- `apps/server/src/db/index.js` — Drizzle 实例导出
- `apps/server/src/lib/password.js` — 密码哈希工具（bcrypt 封装）
- `apps/server/src/lib/errors.js` — 统一错误类定义（AppError、NotFoundError、ForbiddenError）
- `apps/server/src/plugins/session.js` — @fastify/session 配置插件
- `apps/server/src/plugins/cors.js` — @fastify/cors 配置插件
- `apps/server/src/plugins/auth.js` — requireAuth preHandler
- `apps/server/src/index.js` — Fastify 应用入口（注册插件和路由）
- `apps/server/drizzle.config.js` — Drizzle Kit 配置
- `apps/server/package.json` — 后端 package.json（依赖：fastify、drizzle-orm、better-sqlite3、bcrypt 等）

#### 前端（apps/mobile）

- `apps/mobile/app/_layout.jsx` — 根布局（包裹 AuthProvider）
- `apps/mobile/app/(auth)/_layout.jsx` — 认证路由分组布局
- `apps/mobile/app/(auth)/register.jsx` — 注册页面（URL: /register）
- `apps/mobile/app/(auth)/login.jsx` — 登录页面（URL: /login）
- `apps/mobile/context/AuthContext.jsx` — 全局用户认证状态管理
- `apps/mobile/hooks/use-auth.js` — 封装 register / login / logout 操作
- `apps/mobile/components/FormInput.jsx` — 通用表单输入框
- `apps/mobile/components/FormButton.jsx` — 通用提交按钮
- `apps/mobile/components/FormError.jsx` — 表单顶部服务端错误提示框
- `apps/mobile/components/PrivacyCheckbox.jsx` — 隐私协议勾选行
- `apps/mobile/lib/api-client.js` — HTTP 请求封装（fetch + credentials + 错误处理）
- `apps/mobile/package.json` — 前端 package.json（依赖：expo、expo-router、react-native 等）

#### 根目录配置

- `.env` — 环境变量（SESSION_SECRET、DB_PATH、CORS_ORIGIN、EXPO_PUBLIC_API_URL 等）
- `package.json` — Monorepo 根 package.json（pnpm workspaces）

---

## §6 技术约束与风险

### 6.1 输入校验

**前端校验**（apps/mobile）：
- 邮箱格式：正则 `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`（基本格式，非 RFC 822 完整实现）
- 昵称：2-20 字符，允许中文、英文、数字，正则 `/^[\u4e00-\u9fa5a-zA-Z0-9]+$/`（不允许纯空格或特殊符号）
- 密码：8-20 字符，无复杂度要求
- 隐私协议：必须勾选（`agreedToPrivacy === true`）

**后端校验**（apps/server）：
- JSON Schema 层（Fastify 内置）：字段类型、长度、邮箱格式（`format: 'email'`）
- 应用层追加：昵称字符集正则校验、邮箱唯一性检查、密码哈希验证
- 所有 Drizzle 查询使用参数化（`eq()`、`like()` 等），不拼接 SQL 字符串

### 6.2 安全

- **密码存储**：bcrypt hash，salt rounds = 12，永不存明文或返回给客户端
- **Session 安全**：Cookie 设置 `httpOnly: true`（防 XSS 窃取 Cookie）、`sameSite: 'strict'`（防 CSRF）、生产环境 `secure: true`（仅 HTTPS）
- **XSS 防护**：前端渲染用户输入内容时使用 React Native `Text` 组件（自动转义），不使用 `dangerouslySetInnerHTML` 等
- **CSRF 防护**：登出使用 POST 而非 GET，所有 state-changing 操作均为 POST/PUT/DELETE
- **账号枚举防护**：登录失败时，"邮箱不存在"和"密码错误"统一返回 401 `INVALID_CREDENTIALS`，不区分具体失败原因
- **CORS 白名单**：仅允许 `.env` 中配置的 `CORS_ORIGIN`（如 `http://localhost:8082`），生产环境改为实际域名

### 6.3 性能

- **无 N+1 查询风险**：本次仅单表查询（users），无关联查询
- **无需分页**：认证端点不返回列表数据
- **Session store 性能**：SQLite session store 适用于 MVP 阶段，后续若并发量增大可迁移至 Redis

### 6.4 兼容性

- **与现有功能的兼容性风险**：本次是新项目第一个功能模块，无现有功能，无兼容性风险
- **后续功能依赖**：后续 Memo、标签等功能均需通过 `requireAuth` 确保用户已登录，需在路由中统一添加 `preHandler: [requireAuth]`

### 6.5 数据库迁移

- **Drizzle migrate 流程**：修改 `schema.js` 后运行 `pnpm db:generate` 生成迁移文件，再运行 `pnpm db:migrate` 应用迁移
- **幂等性**：Drizzle 生成的迁移使用 `CREATE TABLE IF NOT EXISTS`，可重复执行
- **Session store 建表**：若采用选项 A（store 自建表），session store 初始化时自动建表，无需手动迁移；若采用选项 B（Drizzle 管理），需在 schema 中定义 sessions 表

---

## §7 不包含（范围边界）

本次技术方案**不**涉及以下功能，防止实现阶段范围蔓延：

1. **密码重置/找回功能** — 用户忘记密码时的重置流程（需发送验证邮件、重置链接等），本次不实现，后续迭代考虑
2. **邮箱验证** — 注册后发送验证邮件、用户点击链接激活账号的流程，本次仅做邮箱格式校验，不发送验证邮件
3. **第三方登录（OAuth）** — 微信、Google、GitHub 等第三方登录方式，本次仅支持邮箱密码登录
4. **多因素认证（MFA/2FA）** — 短信验证码、TOTP 二次验证，本次不实现
5. **"记住我"功能** — 延长 Session 有效期或使用 Refresh Token，本次统一 7 天 Session，不提供选项
6. **用户个人资料编辑** — 修改昵称、邮箱、密码等，本次仅支持注册时填写，不支持后续修改
7. **账号注销/删除** — 用户主动删除账号及其所有数据，本次不实现（虽然数据模型预留了 `onDelete: 'cascade'`，但无前端入口）
8. **Session 过期前主动刷新** — 用户活跃时自动延长 Session，本次固定 7 天过期，到期需重新登录
9. **登录设备管理** — 查看所有登录设备、踢出其他设备，本次不实现
10. **登录日志/审计** — 记录登录时间、IP、设备信息等，本次不记录
