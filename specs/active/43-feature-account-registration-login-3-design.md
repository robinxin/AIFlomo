# 技术方案文档：账号注册与登录

**Feature Branch**: `feat/43-account-registration-login`
**创建日期**: 2026-03-13
**关联 Spec**: `43-feature-account-registration-login-3.md`
**状态**: 设计阶段

---

## 1. 功能概述

### 核心目标

建立 AIFlomo 的用户账号体系，支持新用户注册和已有用户登录，实现"邮箱 + 密码"认证机制，为后续多端同步、数据隔离等功能奠定基础。

### 系统定位

- **数据层**：新增 `users`（用户表）和 `sessions`（会话表），与现有 `memos` 表建立外键关联（`memos.user_id → users.id`）
- **API 层**：新增 `/api/auth/register`、`/api/auth/login`、`/api/auth/logout`、`/api/auth/me` 四个认证端点
- **前端层**：新增注册页面（`/(auth)/register`）和登录页面（`/(auth)/login`），新增 `AuthContext` 管理全局认证状态
- **交互点**：通过 Session Cookie 机制与现有路由集成，所有需要登录的端点（如 Memo CRUD）将使用 `preHandler: [requireAuth]` 中间件保护

### 用户价值

- **新用户**：通过简洁的表单（邮箱、昵称、密码 + 隐私协议）30 秒内完成注册并进入应用，无需邮箱验证等复杂流程
- **已有用户**：登录后自动恢复历史 Memo 数据和个人设置，保持跨设备/跨会话的数据一致性
- **系统**：建立数据隔离边界（每个用户仅能访问自己的 Memo），为后续多租户功能和权限管理提供基础

---

## 2. 数据模型变更

### 新增表 1：users（用户表）

```javascript
import { text, sqliteTable } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  // 主键：UUID，自动生成
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // 登录邮箱：唯一约束，必填
  email: text('email').notNull().unique(),

  // 用户昵称：2-20 字符，必填
  nickname: text('nickname').notNull(),

  // 密码哈希值（bcrypt）：必填，禁止明文存储
  password_hash: text('password_hash').notNull(),

  // 隐私协议同意时间戳：ISO 8601 格式，注册时记录
  privacy_agreed_at: text('privacy_agreed_at'),

  // 创建时间：自动设置为当前时间
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});
```

**设计理由**：
- `email` 设置 `unique()` 约束确保同一邮箱不能重复注册（数据库层强约束 + 业务层检测）
- `password_hash` 使用 bcrypt 加密存储，盐值由 bcrypt 自动管理（成本因子 10）
- `privacy_agreed_at` 记录用户同意隐私协议的时间点，满足合规要求
- 使用 `text` 类型存储 UUID 和时间戳（SQLite 推荐做法）

---

### 新增表 2：sessions（会话表）

```javascript
export const sessions = sqliteTable('sessions', {
  // 主键：UUID，自动生成
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // 关联用户：外键指向 users.id，用户删除时级联删除会话
  user_id: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // 会话过期时间：ISO 8601 格式，登录时设置为当前时间 + 7 天
  expires_at: text('expires_at').notNull(),

  // 创建时间：自动设置为当前时间
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});
```

**设计理由**：
- `onDelete: 'cascade'`：当用户被删除时，其所有会话自动清理，避免孤儿会话
- `expires_at` 设置为创建时间 + 7 天（spec 推断），过期会话由定期清理任务或登录检测时剔除
- Session ID 通过 `httpOnly` Cookie 发送给客户端，后端通过该 ID 查询关联用户

---

### 修改表：memos（Memo 记录表）

```javascript
// 在现有 memos 表定义中新增字段：
export const memos = sqliteTable('memos', {
  // ... 现有字段（id, content, created_at, updated_at）

  // 新增：关联用户，外键指向 users.id，用户删除时级联删除 Memo
  user_id: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
});
```

**迁移说明**：
- 执行迁移前，需先创建 `users` 表，再为 `memos` 表添加 `user_id` 字段
- 如果现有 `memos` 表中已有数据，需要设置默认用户（或清空数据，因为 MVP 阶段可能无历史数据）
- 迁移后，所有 Memo 查询需增加 `WHERE user_id = :currentUserId` 条件（通过 Session 获取当前用户 ID）

---

## 3. API 端点设计

### 3.1 注册端点

**路径**: `POST /api/auth/register`
**文件**: `apps/server/src/routes/auth.js`
**鉴权**: 无需认证（公开端点）

**请求验证（Fastify JSON Schema）**：

```javascript
const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'nickname', 'password', 'privacyAgreed'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        maxLength: 255,
        errorMessage: '请输入有效的邮箱地址'
      },
      nickname: {
        type: 'string',
        minLength: 2,
        maxLength: 20,
        pattern: '^[\\u4e00-\\u9fa5a-zA-Z0-9]+$',
        errorMessage: '昵称长度为 2-20 个字符，仅支持中文、英文、数字'
      },
      password: {
        type: 'string',
        minLength: 8,
        maxLength: 20,
        errorMessage: '密码长度为 8-20 个字符'
      },
      privacyAgreed: {
        type: 'boolean',
        const: true,
        errorMessage: '必须同意隐私协议'
      }
    },
    additionalProperties: false
  }
};
```

**成功响应（HTTP 201）**：

```json
{
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "nickname": "张三",
      "created_at": "2026-03-13T10:30:00.000Z"
    },
    "sessionId": "660f9500-f39c-52e5-b827-557766551111"
  },
  "message": "注册成功"
}
```

**失败响应清单**：

| HTTP 状态码 | 场景 | 响应体示例 |
|------------|------|----------|
| 400 | 邮箱格式不正确 | `{ "data": null, "error": "请输入有效的邮箱地址", "message": "注册失败" }` |
| 400 | 昵称长度不符 | `{ "data": null, "error": "昵称长度为 2-20 个字符", "message": "注册失败" }` |
| 400 | 密码长度不符 | `{ "data": null, "error": "密码长度为 8-20 个字符", "message": "注册失败" }` |
| 400 | 未同意隐私协议 | `{ "data": null, "error": "必须同意隐私协议", "message": "注册失败" }` |
| 409 | 邮箱已被注册 | `{ "data": null, "error": "该邮箱已被注册", "message": "注册失败" }` |
| 500 | 服务器内部错误 | `{ "data": null, "error": "服务器错误，请稍后重试", "message": "注册失败" }` |

**业务流程**：
1. 验证请求体（Fastify 自动校验）
2. 检测邮箱是否已存在（`SELECT COUNT(*) FROM users WHERE email = ?`）
3. 使用 bcrypt 哈希密码（`bcrypt.hash(password, 10)`）
4. 插入 `users` 表，记录 `privacy_agreed_at` 为当前时间
5. 创建 Session（插入 `sessions` 表，`expires_at` = 当前时间 + 7 天）
6. 设置 Cookie（`Set-Cookie: session_id=...; HttpOnly; SameSite=Strict; Max-Age=604800`，生产环境加 `Secure`）
7. 返回用户信息 + Session ID

---

### 3.2 登录端点

**路径**: `POST /api/auth/login`
**文件**: `apps/server/src/routes/auth.js`
**鉴权**: 无需认证（公开端点）

**请求验证**：

```javascript
const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        maxLength: 255
      },
      password: {
        type: 'string',
        minLength: 1,
        maxLength: 20
      }
    },
    additionalProperties: false
  }
};
```

**成功响应（HTTP 200）**：

```json
{
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "nickname": "张三",
      "created_at": "2026-03-13T10:30:00.000Z"
    },
    "sessionId": "770fa600-g40d-63f6-c938-668877662222"
  },
  "message": "登录成功"
}
```

**失败响应清单**：

| HTTP 状态码 | 场景 | 响应体示例 |
|------------|------|----------|
| 400 | 邮箱或密码为空 | `{ "data": null, "error": "邮箱和密码不能为空", "message": "登录失败" }` |
| 401 | 邮箱或密码错误 | `{ "data": null, "error": "邮箱或密码错误，请重试", "message": "登录失败" }` |
| 500 | 服务器内部错误 | `{ "data": null, "error": "服务器错误，请稍后重试", "message": "登录失败" }` |

**业务流程**：
1. 验证请求体
2. 根据邮箱查询用户（`SELECT * FROM users WHERE email = ?`）
3. 若用户不存在，返回 401"邮箱或密码错误"（不泄露具体是邮箱还是密码错误）
4. 使用 bcrypt 验证密码（`bcrypt.compare(password, user.password_hash)`）
5. 若密码错误，返回 401"邮箱或密码错误"
6. 创建 Session（插入 `sessions` 表，`expires_at` = 当前时间 + 7 天）
7. 设置 Cookie 并返回用户信息

**安全考虑**：
- 错误提示统一为"邮箱或密码错误"，避免通过错误信息猜测用户是否存在
- 后续可增加登录失败次数限制（如 5 分钟内连续 5 次失败则锁定 15 分钟）

---

### 3.3 登出端点

**路径**: `POST /api/auth/logout`
**文件**: `apps/server/src/routes/auth.js`
**鉴权**: 需要认证（`preHandler: [requireAuth]`）

**请求体**: 无

**成功响应（HTTP 200）**：

```json
{
  "data": null,
  "message": "登出成功"
}
```

**失败响应清单**：

| HTTP 状态码 | 场景 | 响应体示例 |
|------------|------|----------|
| 401 | Session 不存在或已过期 | `{ "data": null, "error": "登录已过期，请重新登录", "message": "未授权" }` |
| 500 | 服务器内部错误 | `{ "data": null, "error": "服务器错误，请稍后重试", "message": "登出失败" }` |

**业务流程**：
1. 从 Cookie 中提取 `session_id`
2. 删除 `sessions` 表中对应的记录（`DELETE FROM sessions WHERE id = ?`）
3. 清除 Cookie（`Set-Cookie: session_id=; Max-Age=0`）
4. 返回成功响应

---

### 3.4 获取当前用户端点

**路径**: `GET /api/auth/me`
**文件**: `apps/server/src/routes/auth.js`
**鉴权**: 需要认证（`preHandler: [requireAuth]`）

**请求参数**: 无

**成功响应（HTTP 200）**：

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "nickname": "张三",
    "created_at": "2026-03-13T10:30:00.000Z"
  },
  "message": "获取用户信息成功"
}
```

**失败响应清单**：

| HTTP 状态码 | 场景 | 响应体示例 |
|------------|------|----------|
| 401 | Session 不存在或已过期 | `{ "data": null, "error": "登录已过期，请重新登录", "message": "未授权" }` |
| 500 | 服务器内部错误 | `{ "data": null, "error": "服务器错误，请稍后重试", "message": "获取用户信息失败" }` |

**业务流程**：
1. `requireAuth` 中间件已从 Cookie 解析 Session 并注入 `request.user`
2. 直接返回 `request.user`（不包含 `password_hash` 字段）

**用途**：
- 前端应用启动时调用此端点判断用户是否已登录
- AuthContext 初始化时获取当前用户信息

---

## 4. 前端页面与组件

### 4.1 新增 Screen

#### 注册页面

**文件路径**: `apps/mobile/app/(auth)/register.jsx`
**对应 URL**: `/(auth)/register`
**职责**: 收集用户注册信息（邮箱、昵称、密码、隐私协议同意），调用 `/api/auth/register` 创建账号

**页面结构**：

```jsx
// 伪代码示意
<View>
  <Text>欢迎注册 AIFlomo</Text>

  <TextInput placeholder="邮箱" type="email" />
  {emailError && <Text style={errorStyle}>{emailError}</Text>}

  <TextInput placeholder="昵称（2-20 字符）" maxLength={20} />
  {nicknameError && <Text style={errorStyle}>{nicknameError}</Text>}

  <TextInput placeholder="密码（8-20 字符）" secureTextEntry={!showPassword} maxLength={20} />
  <Pressable onPress={togglePasswordVisibility}>
    <Icon name={showPassword ? 'eye' : 'eye-off'} />
  </Pressable>
  {passwordError && <Text style={errorStyle}>{passwordError}</Text>}

  <Pressable onPress={togglePrivacyAgreement}>
    <Icon name={privacyAgreed ? 'checkbox-checked' : 'checkbox-unchecked'} />
    <Text>我已阅读并同意<Text style={linkStyle}>隐私协议</Text></Text>
  </Pressable>
  {privacyError && <Text style={errorStyle}>{privacyError}</Text>}

  {serverError && <View style={alertStyle}><Text>{serverError}</Text></View>}

  <Pressable onPress={handleRegister} disabled={isLoading}>
    <Text>{isLoading ? '注册中...' : '注册'}</Text>
  </Pressable>

  <Pressable onPress={navigateToLogin}>
    <Text style={linkStyle}>返回登录</Text>
  </Pressable>
</View>
```

**状态管理**：
- 本地状态（`useState`）：`email`, `nickname`, `password`, `privacyAgreed`, `showPassword`, `emailError`, `nicknameError`, `passwordError`, `privacyError`, `serverError`, `isLoading`
- 失焦（`onBlur`）时触发字段级验证（邮箱格式、昵称长度、密码长度）
- 提交前再次验证所有字段 + 隐私协议勾选状态

**交互流程**：
1. 用户填写表单 → 失焦时显示字段级错误提示
2. 点击"注册" → 禁用按钮、显示"注册中..."、发送 POST 请求到 `/api/auth/register`
3. 成功 → 调用 `AuthContext.login(userData)` 更新全局状态 → 跳转到 `/(app)/`
4. 失败 → 在表单顶部显示服务端错误（如"该邮箱已被注册"） → 恢复按钮可点击状态

---

#### 登录页面

**文件路径**: `apps/mobile/app/(auth)/login.jsx`
**对应 URL**: `/(auth)/login`
**职责**: 验证用户身份（邮箱、密码），调用 `/api/auth/login` 建立会话

**页面结构**：

```jsx
<View>
  <Text>欢迎回来</Text>

  <TextInput placeholder="邮箱" type="email" />

  <TextInput placeholder="密码" secureTextEntry={!showPassword} />
  <Pressable onPress={togglePasswordVisibility}>
    <Icon name={showPassword ? 'eye' : 'eye-off'} />
  </Pressable>

  {serverError && <View style={alertStyle}><Text>{serverError}</Text></View>}

  <Pressable onPress={handleLogin} disabled={isLoading}>
    <Text>{isLoading ? '登录中...' : '登录'}</Text>
  </Pressable>

  <Pressable onPress={navigateToRegister}>
    <Text style={linkStyle}>立即注册</Text>
  </Pressable>
</View>
```

**状态管理**：
- 本地状态：`email`, `password`, `showPassword`, `serverError`, `isLoading`
- 登录页面仅在提交时验证（不做失焦验证，降低摩擦）

**交互流程**：
1. 用户填写邮箱和密码 → 点击"登录"
2. 禁用按钮、显示"登录中..."、发送 POST 请求到 `/api/auth/login`
3. 成功 → 调用 `AuthContext.login(userData)` → 跳转到 `/(app)/`
4. 失败 → 显示"邮箱或密码错误，请重试" → 清空密码框 → 恢复按钮

---

### 4.2 新增组件

#### PasswordInput 组件

**文件路径**: `apps/mobile/components/PasswordInput.jsx`
**职责**: 密码输入框，支持明文/密文切换（眼睛图标）

**Props**：
- `value`: string（密码值）
- `onChangeText`: (text: string) => void（密码变更回调）
- `placeholder`: string（占位文本）
- `error`: string | null（错误提示）
- `maxLength`: number（默认 20）

**内部状态**：
- `showPassword`: boolean（是否显示明文）

---

#### FormErrorMessage 组件

**文件路径**: `apps/mobile/components/FormErrorMessage.jsx`
**职责**: 统一的表单错误提示框（用于服务端错误，显示在表单顶部）

**Props**：
- `message`: string | null（错误信息）
- `onDismiss`: () => void（可选，点击关闭按钮时回调）

---

### 4.3 Context/Reducer 变更

#### 新增 AuthContext

**文件路径**: `apps/mobile/context/AuthContext.jsx`

**管理状态**：
- `currentUser`: User | null（当前登录用户信息）
- `isLoading`: boolean（认证加载状态，如应用启动时调用 `/api/auth/me`）
- `error`: string | null（认证错误信息）

**Action Types**：

| Action Type | Payload | 说明 |
|------------|---------|------|
| `AUTH_LOADING` | 无 | 开始认证操作（如检测登录状态） |
| `AUTH_SUCCESS` | `{ user: User }` | 登录/注册成功，设置 currentUser |
| `AUTH_FAILURE` | `{ error: string }` | 认证失败，设置错误信息 |
| `AUTH_LOGOUT` | 无 | 登出成功，清空 currentUser |

**暴露方法**：
- `login(email, password)`: Promise<void> — 调用登录 API 并更新状态
- `register(email, nickname, password, privacyAgreed)`: Promise<void> — 调用注册 API 并更新状态
- `logout()`: Promise<void> — 调用登出 API 并清空状态
- `checkAuth()`: Promise<void> — 应用启动时调用 `/api/auth/me` 恢复登录状态

**初始化流程**（应用启动时）：
1. 在根布局（`_layout.jsx`）中包裹 `<AuthProvider>`
2. 在 `AuthProvider` 的 `useEffect` 中调用 `checkAuth()`
3. 若 `/api/auth/me` 返回 200，设置 `currentUser`；若返回 401，保持 `currentUser = null`
4. 根据 `currentUser` 是否为空，决定显示登录页面还是主应用

---

#### 修改 MemoContext（未来工作）

**文件路径**: `apps/mobile/context/MemoContext.jsx`

**本次变更**：暂不修改 `MemoContext`。后续任务中需确保：
- 所有 Memo API 请求携带 Session Cookie（Fetch API 的 `credentials: 'include'`）
- Memo 查询自动过滤为当前用户的数据（后端通过 `requireAuth` 中间件注入 `request.user.id`，查询时加 `WHERE user_id = ?`）

---

### 4.4 自定义 Hook

#### useAuth Hook

**文件路径**: `apps/mobile/hooks/use-auth.js`
**职责**: 从 `AuthContext` 中提取状态和方法，简化组件中的调用

**返回值**：
- `currentUser`
- `isLoading`
- `error`
- `login`
- `register`
- `logout`
- `checkAuth`

**使用示例**：

```jsx
import { useAuth } from '../hooks/use-auth';

function LoginScreen() {
  const { login, isLoading, error } = useAuth();
  // ...
}
```

---

### 4.5 用户交互流程

#### 注册流程

1. 用户打开应用 → 系统检测未登录 → 显示注册页面（`/(auth)/register`）
2. 用户填写邮箱（失焦时验证格式）、昵称（失焦时验证长度）、密码（失焦时验证长度）、勾选隐私协议
3. 用户点击"注册" → 系统禁用表单、显示"注册中..."、调用 `register()` 方法
4. 成功 → `AuthContext` 更新 `currentUser` → 系统跳转到 Memo 列表（`/(app)/`）
5. 失败（如邮箱已注册）→ 在表单顶部显示红色错误提示框 → 表单恢复可编辑状态

#### 登录流程

1. 用户打开应用 → 系统检测未登录 → 显示登录页面（`/(auth)/login`）或用户从注册页点击"返回登录"
2. 用户填写邮箱、密码 → 点击"登录"
3. 系统禁用表单、显示"登录中..."、调用 `login()` 方法
4. 成功 → `AuthContext` 更新 `currentUser` → 系统跳转到 `/(app)/`
5. 失败 → 显示"邮箱或密码错误，请重试" → 清空密码框 → 表单恢复

#### Session 过期处理

1. 用户在 Memo 列表页面操作 → 发送 API 请求（如创建 Memo）
2. 后端 `requireAuth` 中间件检测 Session 已过期 → 返回 401 Unauthorized
3. 前端拦截 401 响应 → 调用 `AuthContext.logout()` 清空 `currentUser`
4. 系统自动跳转到登录页面（`/(auth)/login`）→ 显示"登录已过期，请重新登录"提示

---

## 5. 改动文件清单

### 新增

#### 后端

- `apps/server/src/routes/auth.js` — 认证路由（注册、登录、登出、获取当前用户）
- `apps/server/src/plugins/require-auth.js` — `requireAuth` 中间件（验证 Session，注入 `request.user`）
- `apps/server/src/lib/password.js` — 密码哈希与验证工具（封装 bcrypt）

#### 前端

- `apps/mobile/app/(auth)/register.jsx` — 注册页面
- `apps/mobile/app/(auth)/login.jsx` — 登录页面
- `apps/mobile/app/(auth)/_layout.jsx` — 认证路由布局（可选，用于共享样式）
- `apps/mobile/context/AuthContext.jsx` — 认证状态管理 Context + Reducer
- `apps/mobile/hooks/use-auth.js` — AuthContext 的简化 Hook
- `apps/mobile/components/PasswordInput.jsx` — 密码输入框组件
- `apps/mobile/components/FormErrorMessage.jsx` — 表单错误提示组件
- `apps/mobile/lib/api-client.js` — API 请求封装（统一错误处理、Cookie 携带）

---

### 修改

#### 后端

- `apps/server/src/db/schema.js` — 新增 `users` 和 `sessions` 表定义，修改 `memos` 表新增 `user_id` 字段
- `apps/server/src/index.js` — 注册 `auth.js` 路由插件
- `apps/server/src/plugins/session.js` — 配置 Fastify Session 插件（SQLite 存储，Cookie 设置）

#### 前端

- `apps/mobile/app/_layout.jsx` — 包裹 `<AuthProvider>`，根据 `currentUser` 决定显示认证页面还是主应用
- `apps/mobile/app/(app)/_layout.jsx` — 在主应用布局中增加登出按钮（未来）

---

## 6. 技术约束与风险

### 6.1 输入校验

**前端校验（实时反馈）**：

| 字段 | 类型 | 长度 | 格式要求 | 触发时机 |
|------|------|------|---------|---------|
| email | string | ≤ 255 | 正则 `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` | 失焦（注册页） |
| nickname | string | 2-20 | 仅中文、英文、数字，不允许空格 | 失焦（注册页） |
| password | string | 8-20 | 无复杂度要求 | 失焦（注册页） |
| privacyAgreed | boolean | — | 必须为 `true` | 提交前（注册页） |

**后端校验（Fastify JSON Schema）**：
- 所有前端校验规则在后端重新校验（不信任客户端输入）
- 额外校验：邮箱唯一性（数据库 UNIQUE 约束 + 业务层检测）
- bcrypt 哈希密码前无需额外校验（已通过 Schema 验证长度）

---

### 6.2 安全

#### XSS 防护

- 前端使用 `<Text>{user.nickname}</Text>` 纯文本渲染，禁止 `dangerouslySetInnerHTML`
- 所有用户输入在存储前不做转义（存储原始值），在显示时由 React Native 自动转义

#### 认证边界

- 所有需要登录的端点（Memo CRUD、用户信息修改等）必须使用 `preHandler: [requireAuth]`
- `requireAuth` 中间件职责：
  1. 从 Cookie 提取 `session_id`
  2. 查询 `sessions` 表，检查是否存在且未过期（`expires_at > CURRENT_TIMESTAMP`）
  3. 若 Session 有效，查询关联用户并注入 `request.user`
  4. 若 Session 无效或不存在，返回 401 并清空 Cookie

#### 密码存储

- 使用 bcrypt 哈希（成本因子 10，盐值自动管理）
- 禁止在日志中记录明文密码或哈希值
- API 响应中永远不包含 `password_hash` 字段

#### CSRF 防护

- Cookie 设置 `sameSite: 'strict'`，阻止跨站请求携带 Session Cookie
- 暂不实现 CSRF Token（后续可根据需要添加）

#### Session 劫持防护

- 生产环境 Cookie 必须设置 `secure: true`（仅 HTTPS 传输）
- Session ID 使用 UUID（随机性高，难以猜测）
- 后续可增加：Session 与 IP 绑定、浏览器指纹验证

---

### 6.3 性能

#### 潜在的 N+1 查询

**场景 1**：获取 Memo 列表时关联用户信息
**问题**：若每个 Memo 都单独查询 `users` 表（`SELECT * FROM users WHERE id = ?`），导致 N+1 查询
**解决方案**：
- 方案 A（推荐）：Drizzle ORM 的 `innerJoin` 一次性关联查询（`SELECT memos.*, users.nickname FROM memos INNER JOIN users ON memos.user_id = users.id WHERE memos.user_id = ?`）
- 方案 B：由于当前用户的所有 Memo 都属于同一个用户，直接在 Context 中缓存 `currentUser.nickname`，无需每次查询

**场景 2**：用户登录时验证 Session 是否过期
**问题**：每次 API 请求都执行 `SELECT * FROM sessions WHERE id = ? AND expires_at > CURRENT_TIMESTAMP`
**解决方案**：
- Fastify Session 插件内部已优化（使用内存缓存 + 定期同步 SQLite）
- 会话数据较小（仅 user_id 和过期时间），查询性能影响可忽略

#### 分页需求

**本次功能不涉及分页**（注册/登录不返回列表数据）。
未来 Memo 列表需实现分页时：
- 后端增加 `GET /api/memos?page=1&limit=20` 参数
- 返回格式包含 `{ data: { items: [...], total: 100, page: 1, limit: 20 }, message: "..." }`

---

### 6.4 兼容性

#### 与现有功能的兼容性风险

**风险 1**：现有 Memo CRUD 端点未鉴权
**影响**：若用户未登录就访问 `/api/memos`，会导致错误（因为 `user_id` 为 NULL）
**解决方案**：
- 在所有 Memo 端点上增加 `preHandler: [requireAuth]`
- 前端在未登录状态下隐藏 Memo 相关页面（通过 `_layout.jsx` 路由守卫）

**风险 2**：现有 `memos` 表数据无 `user_id`
**影响**：执行迁移后，旧数据的 `user_id` 为 NULL，无法关联到用户
**解决方案**：
- MVP 阶段假设无历史数据，执行迁移前清空 `memos` 表（`DELETE FROM memos`）
- 若有历史数据需保留，先创建测试用户，将所有旧 Memo 的 `user_id` 设置为该测试用户 ID

**风险 3**：前端 MemoContext 未携带 Session Cookie
**影响**：后端无法识别当前用户，返回 401
**解决方案**：
- 在 `api-client.js` 中统一设置 `fetch` 请求的 `credentials: 'include'`
- 确保所有 API 请求都通过 `api-client.js` 发送（不直接使用 `fetch`）

---

## 7. 不包含（范围边界）

以下功能**不在本次设计范围内**，避免实现阶段范围蔓延：

1. **邮箱验证功能**
   - 本次不发送验证邮件，用户注册即可使用
   - 后续迭代可增加邮箱验证（发送验证码 → 点击链接激活账号）

2. **密码重置/忘记密码**
   - 本次不提供"忘记密码"链接和重置流程
   - 用户若忘记密码，暂时无法自助恢复（后续可增加邮箱验证 + 重置密码功能）

3. **第三方登录（OAuth）**
   - 本次不支持 Google、Apple、GitHub 等第三方登录
   - 仅支持邮箱 + 密码认证

4. **"记住我"功能**
   - 本次不提供勾选框延长 Session 有效期
   - 所有用户 Session 有效期统一为 7 天

5. **密码复杂度要求**
   - 本次不强制密码包含大小写字母、数字、特殊字符
   - 仅限制长度（8-20 字符），降低注册门槛

6. **登录失败次数限制（防暴力破解）**
   - 本次不实现短时间内多次登录失败后锁定账号
   - 后续可增加：5 分钟内连续 5 次失败 → 锁定 15 分钟

7. **手机号注册/登录**
   - 本次仅支持邮箱作为账号标识
   - 后续可增加手机号 + 短信验证码登录

8. **用户资料编辑（昵称、头像）**
   - 本次注册后不可修改昵称，不支持上传头像
   - 后续可增加用户资料编辑页面（`/(app)/profile/edit`）

9. **账号注销/删除**
   - 本次不提供删除账号功能
   - 后续需考虑 GDPR 合规（用户主动删除账号 + 级联删除关联数据）

10. **多设备登录管理**
    - 本次不限制同一账号的 Session 数量（可多设备同时登录）
    - 后续可增加：查看所有活跃 Session、远程登出其他设备

---

## 附录

### A. 环境变量清单

在根目录 `.env` 文件中新增：

```bash
# Session 密钥（32 字节随机字符串，生产环境必须替换）
SESSION_SECRET=your-random-32-byte-secret-here

# Session 有效期（秒，7 天 = 604800）
SESSION_MAX_AGE=604800

# bcrypt 成本因子（默认 10，值越高越安全但越慢）
BCRYPT_ROUNDS=10
```

---

### B. 数据库迁移步骤

```bash
# 1. 生成迁移文件（Drizzle）
pnpm db:generate -w apps/server

# 2. 检查生成的 SQL 文件（apps/server/src/db/migrations/XXXX_create_users_sessions.sql）
# 确认包含 CREATE TABLE users, CREATE TABLE sessions, ALTER TABLE memos ADD COLUMN user_id

# 3. 执行迁移
pnpm db:migrate -w apps/server

# 4. 验证表结构
sqlite3 apps/server/data.db ".schema users"
sqlite3 apps/server/data.db ".schema sessions"
sqlite3 apps/server/data.db ".schema memos"
```

---

### C. 测试用例清单（E2E）

基于 spec 文件的验收场景，需编写以下 Playwright 测试用例：

| 用例 ID | 场景描述 | 文件路径 |
|---------|---------|---------|
| TC-001 | 新用户成功注册并自动登录 | `apps/tests/auth/register-success.spec.js` |
| TC-002 | 注册时邮箱已存在提示 | `apps/tests/auth/register-duplicate-email.spec.js` |
| TC-003 | 注册时未勾选隐私协议提示 | `apps/tests/auth/register-privacy-required.spec.js` |
| TC-004 | 注册时邮箱格式错误实时提示 | `apps/tests/auth/register-email-validation.spec.js` |
| TC-005 | 已有用户成功登录 | `apps/tests/auth/login-success.spec.js` |
| TC-006 | 登录时邮箱或密码错误提示 | `apps/tests/auth/login-invalid-credentials.spec.js` |
| TC-007 | 注册页与登录页快速切换 | `apps/tests/auth/navigate-between-auth-pages.spec.js` |
| TC-008 | Session 过期后重新登录 | `apps/tests/auth/session-expiry.spec.js` |

---

### D. API 请求示例（cURL）

#### 注册

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "nickname": "张三",
    "password": "securepassword123",
    "privacyAgreed": true
  }'
```

#### 登录

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123"
  }'
```

#### 获取当前用户

```bash
curl -X GET http://localhost:3000/api/auth/me \
  -b cookies.txt
```

#### 登出

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -b cookies.txt
```

---

## 审核记录

| 日期 | 审核人 | 状态 | 备注 |
|------|--------|------|------|
| 2026-03-13 | Claude (architect subagent) | 草稿完成 | 基于 spec #43 和项目规范生成初版设计文档 |

---

**文档结束**
