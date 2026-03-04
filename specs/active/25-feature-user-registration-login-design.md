# 技术设计文档：账号注册与登录

**关联 Spec**: `specs/active/25-feature-user-registration-login.md`
**创建日期**: 2026-03-04
**状态**: 草稿
**技术栈**: Expo (React Native) + Fastify + Drizzle ORM + SQLite + JavaScript

---

## 1. 功能概述

本次功能实现用户账号的注册与登录流程，是 AIFlomo 应用的身份认证基础功能。

**核心目标**：
- 用户可通过邮箱 + 密码完成注册，注册成功后自动登录
- 用户可通过邮箱 + 密码登录，验证成功后创建 Session
- 登录状态通过 Cookie-based Session 持久化（7 天有效期）

**系统定位**：
- 后端：新增 `/api/auth/register` 和 `/api/auth/login` 两个公开端点（无需认证）
- 数据库：新增 `users` 表存储用户基本信息，`sessions` 表由 Fastify session 插件自动管理
- 前端：新增 `/login` 和 `/register` 两个路由页面，与现有应用隔离（独立路由组）

**用户价值**：
- 解决了「如何让用户安全地访问个人数据」的问题
- 支持用户关闭应用后再次打开时自动登录（Session 未过期）
- 为后续的笔记 CRUD、标签管理等功能提供用户身份上下文（`userId`）

---

## 2. 数据模型变更

### 2.1 新增 `users` 表

```js
// apps/server/src/db/schema.js
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  nickname: text('nickname').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  lastLoginAt: text('last_login_at'),
});
```

**字段说明**：
- `id`：UUID 主键，由 `crypto.randomUUID()` 自动生成
- `email`：用户邮箱，**唯一索引**，注册时统一转为小写存储（防止 `User@Example.com` 和 `user@example.com` 重复）
- `passwordHash`：bcrypt 哈希后的密码（salt rounds = 10），**不存储明文**
- `nickname`：用户昵称（1-20 字符），用于前端展示
- `createdAt`：注册时间，SQLite `CURRENT_TIMESTAMP` 自动生成（ISO 8601 格式）
- `lastLoginAt`：最后登录时间，登录成功时更新（初始为 `null`）

**索引设计**：
- `email` 字段自动创建唯一索引（`unique()` 修饰符）
- 无需额外复合索引，MVP 阶段用户量小

**级联删除**：
- 后续新增的 `memos` 表会添加 `userId` 外键，设置 `onDelete: 'cascade'`，确保删除用户时同步删除其所有笔记

### 2.2 Session 表（由 Fastify 插件自动管理）

使用 `@fastify/session` + `@mgcrea/fastify-session-sqlite-store` 插件，Session 数据存储在 SQLite 同库，表结构如下（**无需手动定义 schema**）：

```sql
-- 插件自动创建（仅供参考）
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  expires INTEGER NOT NULL,
  data TEXT NOT NULL
);
```

**Session 数据内容**（JSON 格式存储在 `data` 字段）：
```json
{
  "userId": "uuid-string",
  "cookie": { "maxAge": 604800000 }
}
```

**Session 配置**（见第 3 节插件实现）：
- `maxAge`: 7 天（604800000 毫秒）
- `httpOnly`: `true`（防止 XSS 读取 Cookie）
- `sameSite`: `'strict'`（防止 CSRF 攻击）
- `secure`: 生产环境 `true`（仅 HTTPS 传输）

---

## 3. API 端点设计

### 3.1 POST `/api/auth/register` — 用户注册

**文件路径**: `apps/server/src/routes/auth.js`

**鉴权要求**: 无（公开端点）

**请求 Body**:
```typescript
{
  email: string;       // 邮箱，必须符合 RFC 5322 格式
  password: string;    // 密码，8-20 位，必须包含字母和数字
  nickname: string;    // 昵称，1-20 字符
  agreePrivacy: boolean; // 必须为 true
}
```

**JSON Schema 验证**:
```js
const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'password', 'nickname', 'agreePrivacy'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: {
        type: 'string',
        minLength: 8,
        maxLength: 20,
        pattern: '^(?=.*[A-Za-z])(?=.*\\d)[A-Za-z\\d@$!%*?&]+$',
      },
      nickname: { type: 'string', minLength: 1, maxLength: 20 },
      agreePrivacy: { type: 'boolean', const: true },
    },
  },
};
```

**成功响应** (HTTP 201):
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "nickname": "小明",
    "createdAt": "2026-03-04T08:30:00.000Z"
  },
  "message": "注册成功"
}
```

**错误响应**:

| HTTP 状态码 | error 字段 | message | 触发条件 |
|----------|-----------|---------|---------|
| 400 | `VALIDATION_ERROR` | "请求参数不合法" | 邮箱格式错误、密码不符合要求、未勾选协议 |
| 409 | `EMAIL_EXISTS` | "该邮箱已注册，请直接登录" | 邮箱已存在（捕获 `UNIQUE constraint failed` 错误） |
| 500 | `INTERNAL_ERROR` | "服务器内部错误" | 其他未预期错误 |

**业务逻辑**:
1. 接收请求体，邮箱统一转为小写（`email.toLowerCase()`）
2. 使用 `bcrypt.hash(password, 10)` 生成密码哈希
3. 插入 `users` 表：`db.insert(users).values({ email, passwordHash, nickname }).returning()`
4. 创建 Session：`request.session.userId = newUser.id`
5. 返回用户信息（不包含 `passwordHash`）

**实现要点**:
- 捕获 SQLite `SQLITE_CONSTRAINT` 错误（错误码 19），返回 409 状态码
- 注册成功后自动登录（设置 `request.session.userId`），无需用户再次输入密码

---

### 3.2 POST `/api/auth/login` — 用户登录

**文件路径**: `apps/server/src/routes/auth.js`

**鉴权要求**: 无（公开端点）

**请求 Body**:
```typescript
{
  email: string;
  password: string;
}
```

**JSON Schema 验证**:
```js
const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 1 },
    },
  },
};
```

**成功响应** (HTTP 200):
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "nickname": "小明",
    "lastLoginAt": "2026-03-04T09:15:00.000Z"
  },
  "message": "登录成功"
}
```

**错误响应**:

| HTTP 状态码 | error 字段 | message | 触发条件 |
|----------|-----------|---------|---------|
| 400 | `VALIDATION_ERROR` | "请求参数不合法" | 邮箱或密码为空 |
| 401 | `INVALID_CREDENTIALS` | "邮箱或密码错误" | 邮箱不存在或密码验证失败 |
| 500 | `INTERNAL_ERROR` | "服务器内部错误" | 其他未预期错误 |

**业务逻辑**:
1. 邮箱统一转为小写
2. 从数据库查询用户：`db.select().from(users).where(eq(users.email, email)).limit(1)`
3. 若用户不存在，返回 401（**不暴露**"邮箱不存在"，统一提示"邮箱或密码错误"）
4. 使用 `bcrypt.compare(password, user.passwordHash)` 验证密码
5. 验证失败，返回 401
6. 验证成功：
   - 更新 `lastLoginAt`：`db.update(users).set({ lastLoginAt: new Date().toISOString() }).where(eq(users.id, user.id))`
   - 创建 Session：`request.session.userId = user.id`
7. 返回用户信息（不包含 `passwordHash`）

---

### 3.3 POST `/api/auth/logout` — 用户登出

**文件路径**: `apps/server/src/routes/auth.js`

**鉴权要求**: 需要登录（`preHandler: [requireAuth]`）

**请求 Body**: 无

**成功响应** (HTTP 204):
```
无 Body
```

**业务逻辑**:
1. 销毁 Session：`request.session.destroy()`
2. 返回 204 No Content

---

### 3.4 GET `/api/auth/me` — 获取当前用户信息

**文件路径**: `apps/server/src/routes/auth.js`

**鉴权要求**: 需要登录（`preHandler: [requireAuth]`）

**成功响应** (HTTP 200):
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "nickname": "小明",
    "createdAt": "2026-03-04T08:30:00.000Z",
    "lastLoginAt": "2026-03-04T09:15:00.000Z"
  },
  "message": "ok"
}
```

**错误响应**:

| HTTP 状态码 | error 字段 | message | 触发条件 |
|----------|-----------|---------|---------|
| 401 | `Unauthorized` | "请先登录" | Session 不存在或已过期 |

**业务逻辑**:
1. 从 Session 获取 `userId`：`request.session.userId`
2. 查询用户信息（由 `requireAuth` preHandler 保证 `userId` 存在）
3. 返回用户信息

**用途**:
- 前端应用启动时调用，检测用户是否已登录
- 若返回 401，跳转到登录页；若返回 200，进入主应用

---

## 4. 前端组件与页面

### 4.1 新增页面

#### 4.1.1 登录页 — `app/(auth)/login.jsx`

**职责**: 渲染邮箱 + 密码输入框，处理登录表单提交

**类型**: Client Component（需使用 `useState` 管理表单状态）

**UI 元素**:
- 邮箱输入框（`<TextInput>` with `keyboardType="email-address"`）
- 密码输入框（`<TextInput>` with `secureTextEntry={true}`）
- 登录按钮（`<Pressable>` 调用 `POST /api/auth/login`）
- "立即注册" 链接（`<Link href="/register">`）

**状态管理**:
- 组件内部 `useState` 管理表单字段（`email`, `password`）
- 登录成功后，调用 `AuthContext.dispatch({ type: 'LOGIN_SUCCESS', payload: userData })`
- 使用 `router.replace('/memo')` 跳转到笔记列表页

**错误处理**:
- 前端校验：邮箱格式、密码非空（提交前校验，实时提示）
- 后端错误：显示 `message` 字段内容（如"邮箱或密码错误"）

**示例代码结构**:
```jsx
// app/(auth)/login.jsx
import { useState } from 'react';
import { View, TextInput, Pressable, Text } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api-client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { dispatch } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    setError('');
    try {
      const user = await api.post('/api/auth/login', { email, password });
      dispatch({ type: 'LOGIN_SUCCESS', payload: user });
      router.replace('/memo');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <View>
      {/* 输入框、按钮、错误提示、注册链接 */}
    </View>
  );
}
```

---

#### 4.1.2 注册页 — `app/(auth)/register.jsx`

**职责**: 渲染注册表单（邮箱、昵称、密码、隐私协议），处理注册提交

**类型**: Client Component

**UI 元素**:
- 邮箱输入框
- 昵称输入框
- 密码输入框
- 隐私协议勾选框（`<Checkbox>` 或自定义实现）
- 注册按钮（未勾选协议时禁用）
- "返回登录" 链接（`<Link href="/login">`）

**状态管理**:
- 组件内部 `useState` 管理表单字段（`email`, `nickname`, `password`, `agreePrivacy`）
- 注册成功后，自动登录（后端已设置 Session），直接 `router.replace('/memo')`

**错误处理**:
- 前端校验：
  - 邮箱格式（正则 `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`）
  - 密码 8-20 位且包含字母和数字
  - 昵称 1-20 字符
  - 协议必须勾选
- 后端错误：显示 `message` 字段（如"该邮箱已注册，请直接登录"）

---

### 4.2 新增路由组

#### 4.2.1 认证路由组布局 — `app/(auth)/_layout.jsx`

**职责**: 为登录和注册页面提供统一布局（无 Tab 导航，Stack 模式）

**类型**: Layout Component

**代码示例**:
```jsx
// app/(auth)/_layout.jsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
```

---

### 4.3 新增 Context — `context/AuthContext.jsx`

**职责**: 管理全局登录状态（`user` 对象、`isAuthenticated` 布尔值）

**状态结构**:
```js
{
  user: null | { id, email, nickname, createdAt, lastLoginAt },
  isAuthenticated: false,
  isLoading: true, // 初始加载中（检测 Session 状态）
}
```

**Reducer Actions**:
- `LOGIN_SUCCESS`: 设置 `user` 和 `isAuthenticated: true`
- `LOGOUT`: 清空 `user`，设置 `isAuthenticated: false`
- `CHECK_AUTH_START`: 设置 `isLoading: true`（用于初始化检测）
- `CHECK_AUTH_SUCCESS`: 设置 `user` 和 `isAuthenticated: true`，`isLoading: false`
- `CHECK_AUTH_FAILURE`: 设置 `isAuthenticated: false`，`isLoading: false`

**导出 Hook**:
```js
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

---

### 4.4 新增 Hook — `hooks/use-check-auth.js`

**职责**: 应用启动时检测用户登录状态（调用 `GET /api/auth/me`）

**使用场景**: 在根布局 `app/_layout.jsx` 中调用，确保应用启动时自动识别 Session

**代码示例**:
```js
// hooks/use-check-auth.js
import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api-client';

export function useCheckAuth() {
  const { dispatch } = useAuth();

  useEffect(() => {
    (async () => {
      dispatch({ type: 'CHECK_AUTH_START' });
      try {
        const user = await api.get('/api/auth/me');
        dispatch({ type: 'CHECK_AUTH_SUCCESS', payload: user });
      } catch (err) {
        dispatch({ type: 'CHECK_AUTH_FAILURE' });
      }
    })();
  }, [dispatch]);
}
```

**调用位置**:
```jsx
// app/_layout.jsx（根布局）
import { useCheckAuth } from '@/hooks/use-check-auth';
import { useAuth } from '@/context/AuthContext';
import { Redirect } from 'expo-router';

export default function RootLayout() {
  useCheckAuth();
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Redirect href="/login" />;

  return <Stack>...</Stack>;
}
```

---

### 4.5 用户交互流程

#### 4.5.1 新用户注册流程

1. 用户访问应用 → 检测未登录 → 自动跳转 `/login`
2. 用户点击"立即注册" → 跳转 `/register`
3. 用户输入邮箱、昵称、密码，勾选协议，点击"注册"
4. 前端校验通过 → 调用 `POST /api/auth/register`
5. 后端验证成功 → 创建用户 → 自动设置 Session → 返回用户信息
6. 前端接收响应 → 更新 `AuthContext` → `router.replace('/memo')` 跳转到笔记页

#### 4.5.2 已有用户登录流程

1. 用户访问应用 → 检测未登录 → 自动跳转 `/login`
2. 用户输入邮箱、密码，点击"登录"
3. 前端校验通过 → 调用 `POST /api/auth/login`
4. 后端验证成功 → 更新 `lastLoginAt` → 设置 Session → 返回用户信息
5. 前端接收响应 → 更新 `AuthContext` → `router.replace('/memo')` 跳转到笔记页

#### 4.5.3 自动登录流程（Session 未过期）

1. 用户关闭应用后再次打开
2. 应用启动 → `useCheckAuth` Hook 调用 `GET /api/auth/me`
3. 后端验证 Session 有效 → 返回用户信息
4. 前端更新 `AuthContext` → 直接进入 `/memo` 笔记页（跳过登录页）

---

## 5. 改动文件清单

### 5.1 新增文件

#### 后端（apps/server）

```
apps/server/src/
├── db/
│   ├── schema.js                      # 新增 users 表定义
│   └── migrations/                    # Drizzle 自动生成的迁移文件
├── routes/
│   └── auth.js                        # 新增认证路由（register, login, logout, me）
├── plugins/
│   └── session.js                     # 新增 Fastify session 插件配置
└── lib/
    └── password.js                    # 新增密码工具函数（bcrypt 封装）
```

#### 前端（apps/mobile）

```
apps/mobile/
├── app/
│   ├── (auth)/                        # 新增认证路由组
│   │   ├── _layout.jsx                # 认证布局（Stack 模式）
│   │   ├── login.jsx                  # 登录页
│   │   └── register.jsx               # 注册页
│   └── _layout.jsx                    # 修改：集成 AuthProvider + useCheckAuth
├── context/
│   └── AuthContext.jsx                # 新增 AuthContext
├── hooks/
│   └── use-check-auth.js              # 新增登录状态检测 Hook
└── lib/
    └── api-client.js                  # 修改：确保 credentials: 'include'
```

### 5.2 修改文件

```
apps/server/src/
└── index.js                           # 修改：注册 sessionPlugin 和 authRoutes

apps/mobile/
└── app/_layout.jsx                    # 修改：
                                       #   1. 包裹 <AuthProvider>
                                       #   2. 调用 useCheckAuth()
                                       #   3. 根据 isAuthenticated 控制路由重定向
```

### 5.3 环境变量新增

```bash
# apps/server/.env
SESSION_SECRET=<32-char-random-string>  # 新增 Session 密钥

# apps/mobile/.env（Expo）
EXPO_PUBLIC_API_URL=http://localhost:3000  # 确保已配置
```

---

## 6. 技术约束与风险

### 6.1 输入校验

#### 前端校验（实时反馈）

| 字段 | 类型 | 长度 | 格式要求 | 错误提示 |
|------|------|------|---------|---------|
| `email` | string | - | 符合 RFC 5322（正则：`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`） | "请输入有效邮箱地址" |
| `password` | string | 8-20 字符 | 必须包含字母和数字（正则：`/^(?=.*[A-Za-z])(?=.*\d)/`） | "密码需为 8-20 位，包含字母和数字" |
| `nickname` | string | 1-20 字符 | 无特殊要求（纯文本） | "昵称长度为 1-20 字符" |
| `agreePrivacy` | boolean | - | 必须为 `true` | "请先同意隐私协议" |

#### 后端校验（安全防护）

- 使用 Fastify JSON Schema 做参数验证（见第 3 节）
- 邮箱统一转为小写（`email.toLowerCase()`）
- 密码长度与格式再次校验（防止绕过前端）
- `agreePrivacy` 必须为 `true`（拒绝 `false` 或缺失）

### 6.2 安全约束

#### 6.2.1 密码存储

- 使用 `bcrypt` 算法（salt rounds = 10）
- **禁止**明文存储或使用弱哈希算法（如 MD5、SHA1）
- 密码哈希函数封装在 `lib/password.js`，统一调用

**示例代码**:
```js
// lib/password.js
import bcrypt from 'bcrypt';

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
```

#### 6.2.2 Session 安全

- Cookie 配置：
  - `httpOnly: true` — 禁止 JavaScript 读取 Cookie（防 XSS）
  - `sameSite: 'strict'` — 禁止跨站请求携带 Cookie（防 CSRF）
  - `secure: true`（生产环境） — 仅 HTTPS 传输
  - `maxAge: 7 天` — Session 过期后自动失效
- Session Secret 必须 >= 32 字符，使用 `crypto.randomBytes(32).toString('hex')` 生成

#### 6.2.3 防 SQL 注入

- 使用 Drizzle ORM 参数化查询，**禁止**字符串拼接
- 示例：
  ```js
  // ✅ 正确
  await db.select().from(users).where(eq(users.email, email));

  // ❌ 错误（禁止）
  await db.run(`SELECT * FROM users WHERE email = '${email}'`);
  ```

#### 6.2.4 防 XSS

- 昵称等用户输入在前端渲染时使用 `<Text>{nickname}</Text>`，React Native 自动转义
- Web 端（Expo Web）确保使用 React 的 JSX 渲染，不使用 `dangerouslySetInnerHTML`

#### 6.2.5 登录失败信息隐藏

- 邮箱不存在和密码错误统一提示"邮箱或密码错误"，**不暴露**"该邮箱未注册"
- 防止攻击者通过错误提示枚举已注册邮箱

### 6.3 性能考量

#### 6.3.1 bcrypt 性能

- bcrypt 是 CPU 密集型操作，单次耗时约 50-100ms（salt rounds = 10）
- 对于 MVP 阶段（并发量 < 100），性能影响可接受
- 若后续并发登录过高，可考虑引入 Redis 缓存 Session 或使用更快的哈希算法（如 Argon2）

#### 6.3.2 数据库查询优化

- `email` 字段已设置唯一索引，查询性能优秀（O(log n)）
- 登录时使用 `.limit(1)` 避免全表扫描
- 无 N+1 查询问题（单表查询）

#### 6.3.3 Session 过期清理

- Fastify session 插件会自动清理过期 Session（基于 `expires` 字段）
- 若长期运行后 `sessions` 表过大，可定期执行：
  ```sql
  DELETE FROM sessions WHERE expires < strftime('%s', 'now') * 1000;
  ```

### 6.4 兼容性要求

#### 6.4.1 跨平台兼容

- Expo Router 支持 Web / Android / iOS 三端
- 登录页和注册页使用 React Native 原生组件（`TextInput`, `Pressable`），自动适配三端
- Web 端使用浏览器原生 Cookie，移动端使用 Expo 的 Fetch API（支持 `credentials: 'include'`）

#### 6.4.2 已有数据兼容

- 本次是首次添加用户系统，无已有数据迁移问题
- 后续新增 `memos` 表时，需添加 `userId` 外键，默认值可设为某个测试用户 ID，或要求迁移脚本手动处理

---

## 7. 不包含（范围边界）

以下功能**不在本次设计范围内**，避免范围蔓延：

1. **邮箱验证**：注册时不发送验证邮件，邮箱默认视为已验证（MVP 阶段信任用户输入）
2. **找回密码**：无"忘记密码"功能，后续通过邮件或管理后台重置
3. **第三方登录**：不支持 Google / Apple Sign-In（后续功能）
4. **用户头像**：用户表不包含头像字段，使用默认占位符或昵称首字母
5. **多设备登录管理**：不限制同一账号的并发登录设备数量
6. **登录日志**：不记录登录 IP、设备信息等（仅记录 `lastLoginAt` 时间戳）
7. **账号注销**：不提供"删除账号"功能（后续通过管理后台实现）
8. **密码强度提示**：仅做格式校验，不显示"弱/中/强"强度条（UX 优化项）
9. **CAPTCHA 验证码**：无图形验证码或滑块验证（MVP 阶段不防机器注册）

---

## 附录 A：依赖包清单

### A.1 后端新增依赖（apps/server）

| 包名 | 版本 | 用途 |
|------|------|------|
| `bcrypt` | `^5.1.1` | 密码哈希和验证 |
| `@fastify/session` | `^11.0.0` | Session 管理 |
| `@mgcrea/fastify-session-sqlite-store` | `^1.0.0` | SQLite Session 存储 |
| `@fastify/cookie` | `^10.0.0` | Cookie 解析（Session 依赖） |

### A.2 前端无新增依赖

- 已有 Expo Router、React Native 核心库，无需额外安装

---

## 附录 B：错误码字典

| 错误码 | HTTP 状态码 | 含义 | 触发场景 |
|--------|----------|------|---------|
| `VALIDATION_ERROR` | 400 | 请求参数不合法 | JSON Schema 验证失败 |
| `EMAIL_EXISTS` | 409 | 邮箱已注册 | 注册时邮箱重复 |
| `INVALID_CREDENTIALS` | 401 | 邮箱或密码错误 | 登录验证失败 |
| `Unauthorized` | 401 | 未登录 | 访问受保护端点但 Session 不存在 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 | 其他未预期错误 |

---

**文档结束**
