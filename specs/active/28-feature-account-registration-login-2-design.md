# 技术设计文档 — 账号注册与登录

**功能规格**: `specs/active/28-feature-account-registration-login-2.md`
**设计作者**: AI Agent
**创建日期**: 2026-03-05
**状态**: 待审核

---

## 1. 功能概述

实现 AIFlomo 的用户注册与登录功能，作为用户访问系统的第一道门槛。

**核心目标**：提供安全、流畅的账号注册与登录体验，支持邮箱 + 密码认证，使用 Session + Cookie 方式维持登录状态。

**系统定位**：
- 本功能为整个系统的基础认证模块，所有后续需要登录的功能都将依赖本次实现的 Session 机制
- 涉及全新的数据表（`users`、`sessions`）、认证中间件（`requireAuth`）、前端 Context（`AuthContext`）
- 登录页面和注册页面作为独立的公开路由（无需认证），成功后跳转到主应用区域

**用户价值**：
- 新用户可在 30 秒内完成注册并开始使用笔记功能
- 已有用户可在 15 秒内登录并访问自己的数据
- 密码安全存储（bcrypt 哈希），Session 有效期 7 天，减少重复登录次数

---

## 2. 数据模型变更

需要新增两张表：`users`（用户）和 `sessions`（会话）。

### 2.1 完整 Schema（Drizzle ORM + SQLite）

```js
// apps/server/src/db/schema.js
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  nickname: text('nickname').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at').notNull(),  // Unix 时间戳（毫秒）
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});
```

### 2.2 字段说明

**`users` 表**：
- `id`：UUID 主键，自动生成
- `email`：邮箱地址，唯一索引，存储前统一转为小写（防止 `User@Example.com` 和 `user@example.com` 重复注册）
- `nickname`：用户昵称，1-50 个字符
- `passwordHash`：密码哈希值，使用 bcrypt 算法加密（不存明文）
- `createdAt`、`updatedAt`：ISO 8601 格式时间戳

**`sessions` 表**：
- `id`：Session ID，作为 Cookie 值传递
- `userId`：关联的用户 ID，外键指向 `users.id`，级联删除（用户删除时自动清理 Session）
- `expiresAt`：过期时间（Unix 时间戳，单位：毫秒），默认 7 天有效期
- `createdAt`：Session 创建时间

### 2.3 设计理由

- **邮箱唯一索引**：确保同一邮箱不能重复注册
- **级联删除（`onDelete: 'cascade'`）**：用户删除时自动清理关联的 Session，避免脏数据
- **Session 存储于 SQLite**：符合 MVP 阶段架构要求，无需引入 Redis

---

## 3. API 端点设计

### 3.1 用户注册

**端点**：`POST /api/auth/register`
**文件路径**：`apps/server/src/routes/auth.js`
**鉴权**：❌ 无需认证（公开接口）

**请求验证（JSON Schema）**：

```js
const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'nickname', 'password', 'agreePolicy'],
    properties: {
      email: { type: 'string', format: 'email', maxLength: 255 },
      nickname: { type: 'string', minLength: 1, maxLength: 50 },
      password: { type: 'string', minLength: 6, maxLength: 128 },
      agreePolicy: { type: 'boolean', const: true },
    },
  },
};
```

**成功响应（201 Created）**：

```json
{
  "data": {
    "id": "uuid-xxx",
    "email": "user@example.com",
    "nickname": "张三",
    "createdAt": "2026-03-05T10:30:00.000Z"
  },
  "message": "注册成功"
}
```

**失败响应清单**：

| HTTP 状态码 | error 字段 | message | 触发条件 |
|------------|-----------|---------|---------|
| 400 | `VALIDATION_ERROR` | 请求参数不合法 | 邮箱格式错误、密码长度不足、未勾选协议等 |
| 409 | `EMAIL_ALREADY_EXISTS` | 该邮箱已被注册 | 邮箱已存在于数据库 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 | 数据库异常、bcrypt 加密失败等 |

**后端逻辑流程**：

1. 校验请求体（Fastify JSON Schema 自动校验）
2. 将 `email` 转为小写
3. 查询数据库检查邮箱是否已注册
4. 使用 `bcrypt.hash()` 生成密码哈希值（salt rounds = 10）
5. 插入 `users` 表
6. 自动创建 Session，返回用户信息（不返回 `passwordHash`）

---

### 3.2 用户登录

**端点**：`POST /api/auth/login`
**文件路径**：`apps/server/src/routes/auth.js`
**鉴权**：❌ 无需认证（公开接口）

**请求验证（JSON Schema）**：

```js
const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', maxLength: 255 },
      password: { type: 'string', minLength: 1, maxLength: 128 },
    },
  },
};
```

**成功响应（200 OK）**：

```json
{
  "data": {
    "id": "uuid-xxx",
    "email": "user@example.com",
    "nickname": "张三"
  },
  "message": "登录成功"
}
```

**失败响应清单**：

| HTTP 状态码 | error 字段 | message | 触发条件 |
|------------|-----------|---------|---------|
| 400 | `VALIDATION_ERROR` | 请求参数不合法 | 邮箱或密码为空 |
| 401 | `INVALID_CREDENTIALS` | 邮箱或密码错误 | 邮箱不存在或密码不匹配（统一提示，不泄露具体错误） |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 | 数据库异常、bcrypt 验证失败等 |

**后端逻辑流程**：

1. 校验请求体
2. 将 `email` 转为小写
3. 根据邮箱查询用户，若不存在直接返回 401（不暴露"邮箱不存在"）
4. 使用 `bcrypt.compare()` 验证密码，若失败返回 401
5. 创建新 Session（过期时间 = 当前时间 + 7 天）
6. 将 Session ID 写入 Cookie（`httpOnly: true`, `sameSite: 'strict'`, `secure: true` in production）
7. 返回用户信息

---

### 3.3 用户登出

**端点**：`POST /api/auth/logout`
**文件路径**：`apps/server/src/routes/auth.js`
**鉴权**：✅ 需要认证（`preHandler: [requireAuth]`）

**请求验证**：无（不需要请求体）

**成功响应（204 No Content）**：

```
（无响应体）
```

**失败响应清单**：

| HTTP 状态码 | error 字段 | message | 触发条件 |
|------------|-----------|---------|---------|
| 401 | `UNAUTHORIZED` | 请先登录 | Session 不存在或已过期 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 | 数据库删除 Session 失败 |

**后端逻辑流程**：

1. 从 `request.session.sessionId` 获取当前 Session ID
2. 删除数据库中的 Session 记录
3. 清除 Cookie（`reply.clearCookie('sessionId')`）
4. 返回 204

---

### 3.4 获取当前用户信息

**端点**：`GET /api/auth/me`
**文件路径**：`apps/server/src/routes/auth.js`
**鉴权**：✅ 需要认证（`preHandler: [requireAuth]`）

**请求验证**：无

**成功响应（200 OK）**：

```json
{
  "data": {
    "id": "uuid-xxx",
    "email": "user@example.com",
    "nickname": "张三"
  },
  "message": "ok"
}
```

**失败响应清单**：

| HTTP 状态码 | error 字段 | message | 触发条件 |
|------------|-----------|---------|---------|
| 401 | `UNAUTHORIZED` | 请先登录 | Session 不存在或已过期 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 | 数据库查询失败 |

**后端逻辑流程**：

1. `requireAuth` 中间件验证 Session 有效性，自动注入 `request.session.userId`
2. 根据 `userId` 查询用户信息
3. 返回用户数据（不返回 `passwordHash`）

---

## 4. 前端页面与组件

### 4.1 页面新增

**注册页面**：
- 文件路径：`apps/mobile/app/(auth)/register.jsx`
- URL 路径：`/register`
- 职责：展示注册表单，处理注册逻辑，成功后跳转到登录页面或自动登录

**登录页面**：
- 文件路径：`apps/mobile/app/(auth)/login.jsx`
- URL 路径：`/login`
- 职责：展示登录表单，处理登录逻辑，成功后跳转到主页面（`/memo`）

**认证路由组布局**：
- 文件路径：`apps/mobile/app/(auth)/_layout.jsx`
- 职责：为 `login` 和 `register` 提供统一布局（Stack 导航，无 header）

### 4.2 组件新增

**通用文本输入框**：
- 文件路径：`apps/mobile/components/TextInput.jsx`
- 具名导出：`export function TextInput({ label, value, onChangeText, secureTextEntry, error, ... })`
- 职责：统一样式的文本输入框，支持错误提示、密码掩码、邮箱键盘类型

**通用按钮**：
- 文件路径：`apps/mobile/components/Button.jsx`
- 具名导出：`export function Button({ title, onPress, disabled, loading, variant })`
- 职责：统一样式的按钮，支持加载状态、禁用状态、主次样式变体

**隐私协议复选框**：
- 文件路径：`apps/mobile/components/PolicyCheckbox.jsx`
- 具名导出：`export function PolicyCheckbox({ checked, onPress })`
- 职责：注册页面使用，展示"我已阅读并同意隐私协议"及勾选框

### 4.3 Context/Reducer 变更

**新增 Context**：
- 文件路径：`apps/mobile/context/AuthContext.jsx`
- Provider：`<AuthProvider>`
- Hook：`useAuth()`
- State 结构：

```js
{
  user: null | { id, email, nickname },
  isLoading: false,
  error: null,
}
```

- Action Types：
  - `LOGIN_START`：开始登录（设置 `isLoading: true`）
  - `LOGIN_SUCCESS`：登录成功（设置 `user` 数据，`isLoading: false`）
  - `LOGIN_ERROR`：登录失败（设置 `error`，`isLoading: false`）
  - `REGISTER_START`、`REGISTER_SUCCESS`、`REGISTER_ERROR`（同上）
  - `LOGOUT`：清除 `user` 和 `error`
  - `FETCH_USER_SUCCESS`：获取当前用户信息成功（页面刷新时调用）

### 4.4 自定义 Hook 变更

**新增 Hook**：
- 文件路径：`apps/mobile/hooks/use-auth.js`
- 导出：`export function useAuthActions()`
- 功能：封装 `login(email, password)`、`register(email, nickname, password)`、`logout()`、`fetchCurrentUser()` 方法
- 内部逻辑：调用 `api.post('/api/auth/login')` 等，根据结果 dispatch 对应 action

### 4.5 用户交互流程

**注册流程**：
1. 用户访问 `/register`
2. 看到注册表单：邮箱输入框、昵称输入框、密码输入框、隐私协议勾选框、"注册"按钮、"返回登录"链接
3. 填写信息并点击"注册"
4. 前端校验（邮箱格式、密码长度、协议勾选），若失败直接显示错误提示
5. 提交到后端 `POST /api/auth/register`
6. 若成功：显示"注册成功"提示，1 秒后跳转到登录页面（或自动登录并跳转到 `/memo`）
7. 若失败：显示后端返回的错误信息（如"该邮箱已被注册"）

**登录流程**：
1. 用户访问 `/login`（或注册成功后自动跳转到此）
2. 看到登录表单：邮箱输入框、密码输入框、"登录"按钮、"立即注册"链接
3. 填写邮箱和密码，点击"登录"
4. 前端校验（邮箱格式、密码非空），若失败直接显示错误提示
5. 提交到后端 `POST /api/auth/login`
6. 若成功：保存用户信息到 `AuthContext`，跳转到 `/memo`（主页面）
7. 若失败：显示"邮箱或密码错误"（不暴露具体错误）

**页面导航**：
- 登录页面点击"立即注册" → 跳转到 `/register`
- 注册页面点击"返回登录" → 跳转到 `/login`

---

## 5. 改动文件清单

### 新增文件

**后端**：
- `apps/server/src/db/schema.js` — 新增 `users` 和 `sessions` 表定义
- `apps/server/src/db/index.js` — 导出 Drizzle 实例
- `apps/server/src/routes/auth.js` — 注册、登录、登出、获取当前用户四个接口
- `apps/server/src/plugins/auth.js` — `requireAuth` 中间件（校验 Session）
- `apps/server/src/plugins/session.js` — 配置 `@fastify/session`（SQLite store）
- `apps/server/src/plugins/cors.js` — 配置 `@fastify/cors`
- `apps/server/src/lib/password.js` — 封装 `bcrypt.hash()` 和 `bcrypt.compare()`
- `apps/server/src/lib/errors.js` — 自定义错误类（`AppError`、`UnauthorizedError`、`ConflictError`）
- `apps/server/src/index.js` — 应用入口（注册插件和路由）
- `apps/server/drizzle.config.js` — Drizzle Kit 配置
- `apps/server/package.json` — 后端依赖和脚本

**前端**：
- `apps/mobile/app/(auth)/_layout.jsx` — 认证路由组布局
- `apps/mobile/app/(auth)/login.jsx` — 登录页面
- `apps/mobile/app/(auth)/register.jsx` — 注册页面
- `apps/mobile/components/TextInput.jsx` — 通用文本输入框组件
- `apps/mobile/components/Button.jsx` — 通用按钮组件
- `apps/mobile/components/PolicyCheckbox.jsx` — 隐私协议复选框组件
- `apps/mobile/context/AuthContext.jsx` — 认证状态管理（Context + Reducer）
- `apps/mobile/hooks/use-auth.js` — 认证操作封装（login、register、logout）
- `apps/mobile/lib/api-client.js` — 统一 API 请求封装（fetch + credentials: 'include'）
- `apps/mobile/app/_layout.jsx` — 根布局（包裹 `<AuthProvider>`）
- `apps/mobile/package.json` — 前端依赖和脚本
- `apps/mobile/babel.config.js` — 路径别名配置

**根目录**：
- `package.json` — 根 workspace 配置
- `.env` — 环境变量（`SESSION_SECRET`、`DB_PATH`、`EXPO_PUBLIC_API_URL` 等）

### 修改文件

无（本次为全新功能，无需修改现有文件）

---

## 6. 技术约束与风险

### 6.1 输入校验

**前端校验**（即时反馈，无需等待后端）：
- **邮箱格式**：使用正则 `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`，长度 ≤ 255
- **昵称长度**：1-50 个字符（中英文统一按字符计数）
- **密码长度**：6-128 个字符
- **隐私协议**：必须勾选，`agreePolicy === true`

**后端校验**（Fastify JSON Schema）：
- 所有字段的 `type`、`minLength`、`maxLength`、`format`（邮箱）、`required`
- 邮箱唯一性检查（数据库查询）
- 密码哈希前不对内容做额外限制（允许任意字符，由 bcrypt 处理）

### 6.2 安全

**密码存储**：
- 使用 `bcrypt` 算法（salt rounds = 10），存储哈希值，严禁明文
- 登录验证使用 `bcrypt.compare()`，时间恒定，防止时序攻击

**Session 安全**：
- Cookie 设置：`httpOnly: true`（防止 JavaScript 访问）、`sameSite: 'strict'`（防 CSRF）、`secure: true`（生产环境启用 HTTPS）
- Session 有效期 7 天，过期后自动清理（通过 `expiresAt` 字段判断）
- 登出时删除数据库中的 Session 记录，不仅清除 Cookie

**XSS 防护**：
- 前端所有用户输入（邮箱、昵称）仅作为纯文本渲染（React Native 默认安全，但避免使用 `dangerouslySetInnerHTML`）
- 后端返回的错误信息不包含用户输入内容的回显

**错误信息脱敏**：
- 登录失败统一返回"邮箱或密码错误"，不暴露"用户不存在"或"密码错误"
- 注册时若邮箱已存在，明确提示"该邮箱已被注册"（符合用户体验，不泄露敏感信息）

### 6.3 性能

**潜在 N+1 查询**：
- 本功能不涉及关联查询，所有操作均为单表查询或插入，无 N+1 风险

**分页**：
- 用户表和 Session 表不需要分页（单用户操作，数据量小）

**防重复提交**：
- 前端：点击"注册"或"登录"按钮后立即禁用，设置 `disabled={loading}` 状态
- 后端：邮箱唯一索引天然防止重复注册；登录请求无副作用（幂等）

### 6.4 兼容性

**与现有功能的兼容性**：
- 本次为首个功能，无现有用户数据，无迁移风险
- 后续所有需要登录的路由需使用 `preHandler: [requireAuth]`，统一鉴权入口

**前端路由保护**：
- 主应用路由组 `(app)/_layout.jsx` 需检查 `useAuth()` 的 `user` 状态，若为 `null` 则自动跳转到 `/login`
- 公开路由组 `(auth)` 无需鉴权

---

## 7. 不包含（范围边界）

本次设计明确不包含以下功能，防止范围蔓延：

1. **忘记密码/重置密码**：不实现邮箱验证码找回密码功能，用户忘记密码只能联系管理员（MVP 阶段）
2. **第三方登录**：不支持 OAuth（Google、GitHub 等），仅支持邮箱 + 密码
3. **邮箱验证**：注册后无需验证邮箱真实性，直接可用（MVP 阶段简化流程）
4. **用户头像**：不实现头像上传功能，仅支持昵称和邮箱
5. **密码强度提示**：仅校验长度（6-128 字符），不强制要求大小写、数字、特殊字符组合
6. **Session 续期**：Session 过期后需重新登录，不实现自动续期或"记住我"功能
7. **多设备管理**：不显示用户的活跃 Session 列表，不支持踢出其他设备
8. **用户注销/删除账号**：不提供用户主动删除账号的功能（需后续迭代）
9. **登录日志/审计**：不记录登录 IP、设备信息、登录历史（安全审计功能留待后续）
10. **前端表单自动填充**：不主动对接浏览器密码管理器的 `autocomplete` 属性（浏览器默认行为即可）

---

## 附录：依赖清单

### 后端依赖（`apps/server/package.json`）

```json
{
  "dependencies": {
    "fastify": "^5.0.0",
    "@fastify/session": "^10.0.0",
    "@fastify/cookie": "^10.0.0",
    "@fastify/cors": "^10.0.0",
    "drizzle-orm": "^0.30.0",
    "bcrypt": "^5.1.1",
    "dotenv": "^16.6.1"
  },
  "devDependencies": {
    "drizzle-kit": "^0.20.0",
    "eslint": "^8.57.0"
  }
}
```

### 前端依赖（`apps/mobile/package.json`）

```json
{
  "dependencies": {
    "expo": "~51.0.0",
    "expo-router": "~3.5.0",
    "react": "18.2.0",
    "react-native": "0.74.0"
  },
  "devDependencies": {
    "babel-plugin-module-resolver": "^5.0.0",
    "eslint": "^8.57.0"
  }
}
```

**注**：所有版本号以实际 `package.json` 为准，此处仅为示例。本次设计不引入任何新的外部依赖库，除非 CLAUDE.md 和 CONSTITUTION.md 明确允许。
