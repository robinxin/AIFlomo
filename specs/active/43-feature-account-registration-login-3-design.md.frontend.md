# Frontend Output: 账号注册与登录 — §4 前端页面与组件设计

**关联 Spec**: `specs/active/43-feature-account-registration-login-3.md`
**关联 Architect 输出**: `specs/active/43-feature-account-registration-login-3-design.md.architect.md`
**关联 Issue**: #43
**生成日期**: 2026-03-12
**生成者**: frontend-developer subagent

---

## §4 前端页面与组件设计

### 4.1 新增 Screen 列表

| 文件路径 | URL 路径 | 职责概述 |
|---------|---------|---------|
| `apps/mobile/app/register.jsx` | `/register` | 新用户注册页面：收集邮箱、昵称、密码、隐私协议同意，提交后自动登录并跳转到主界面 |
| `apps/mobile/app/login.jsx` | `/login` | 已有用户登录页面：验证邮箱和密码，建立 Session 后跳转到主界面 |
| `apps/mobile/app/index.jsx` | `/` | 根路由守卫：检查 `AuthContext` 中的登录状态，未登录时重定向到 `/login`，已登录时重定向到 `/memos`（Memo 列表页，后续迭代新增） |

**设计说明**：
- Expo Router 使用文件系统路由，`app/register.jsx` 对应路径 `/register`，`app/login.jsx` 对应路径 `/login`。
- `index.jsx` 充当路由守卫入口，避免未登录用户直接访问业务页面。
- 所有认证页面不渲染底部导航栏（Tab Bar），通过 Expo Router 的布局文件控制。

---

### 4.2 新增组件列表

#### 4.2.1 `AuthFormInput` — 通用表单输入框

**文件路径**: `apps/mobile/components/AuthFormInput.jsx`
**Export 方式**: 具名 export `export function AuthFormInput`

**职责**: 封装注册/登录表单中单个输入字段的完整 UI 逻辑，包含标签、输入框、错误提示文字和聚焦/错误边框样式切换。

**Props 列表**:

| Props 名称 | 类型 | 必填 | 说明 |
|-----------|------|------|------|
| `label` | `string` | 是 | 输入框上方的标签文字（如"邮箱"、"昵称"） |
| `value` | `string` | 是 | 输入框当前值，由父组件受控 |
| `onChangeText` | `function` | 是 | 文字变更回调，签名 `(text: string) => void` |
| `onBlur` | `function` | 否 | 失焦回调，供注册页触发字段级验证，签名 `() => void` |
| `error` | `string \| null` | 否 | 字段级错误文字；有值时输入框边框变红并在下方展示红色提示，无值时隐藏提示区域 |
| `placeholder` | `string` | 否 | 输入框占位文字 |
| `keyboardType` | `string` | 否 | React Native `TextInput` 的 `keyboardType`，默认 `'default'`，邮箱字段传 `'email-address'` |
| `autoCapitalize` | `string` | 否 | 首字母大写策略，默认 `'sentences'`，邮箱字段传 `'none'` |
| `disabled` | `boolean` | 否 | 为 `true` 时输入框禁用（提交加载期间），默认 `false` |
| `testID` | `string` | 否 | E2E 测试选择器标识符 |

**负责的用户交互**:
- 聚焦时输入框边框变为蓝色高亮
- 失焦时触发 `onBlur` 回调（父组件执行字段验证逻辑）
- `error` prop 不为空时，输入框边框变红并在下方渲染红色错误文字
- `disabled` 为 `true` 时，输入框视觉置灰且不响应用户输入

---

#### 4.2.2 `PasswordInput` — 密码输入框（含明密文切换）

**文件路径**: `apps/mobile/components/PasswordInput.jsx`
**Export 方式**: 具名 export `export function PasswordInput`

**职责**: 继承 `AuthFormInput` 的全部能力，额外管理密码明文/密文显示状态，在输入框右侧渲染眼睛图标切换按钮。

**Props 列表**:

| Props 名称 | 类型 | 必填 | 说明 |
|-----------|------|------|------|
| `label` | `string` | 是 | 标签文字，通常为"密码" |
| `value` | `string` | 是 | 密码当前值，由父组件受控 |
| `onChangeText` | `function` | 是 | 文字变更回调，签名 `(text: string) => void` |
| `onBlur` | `function` | 否 | 失焦回调，触发字段验证 |
| `error` | `string \| null` | 否 | 字段级错误文字 |
| `placeholder` | `string` | 否 | 占位文字，默认"请输入密码" |
| `disabled` | `boolean` | 否 | 禁用状态，默认 `false` |
| `testID` | `string` | 否 | E2E 测试选择器标识符 |

**负责的用户交互**:
- 默认以密文（`secureTextEntry={true}`）显示输入内容
- 点击右侧眼睛图标，切换为明文显示；再次点击恢复密文显示
- 内部维护 `visible` 布尔状态，不暴露给父组件

---

#### 4.2.3 `FormErrorBanner` — 表单顶部错误提示横幅

**文件路径**: `apps/mobile/components/FormErrorBanner.jsx`
**Export 方式**: 具名 export `export function FormErrorBanner`

**职责**: 在表单顶部显示服务端返回的全局错误信息（如"该邮箱已被注册"、"邮箱或密码错误"），与字段级错误提示互补。`message` 为 null 或空字符串时不渲染任何内容（高度折叠为零，避免布局抖动）。

**Props 列表**:

| Props 名称 | 类型 | 必填 | 说明 |
|-----------|------|------|------|
| `message` | `string \| null` | 是 | 错误文字；空值时组件不渲染 |
| `testID` | `string` | 否 | E2E 测试选择器标识符 |

**负责的用户交互**: 无交互，纯展示组件。

---

#### 4.2.4 `PrivacyCheckbox` — 隐私协议勾选框

**文件路径**: `apps/mobile/components/PrivacyCheckbox.jsx`
**Export 方式**: 具名 export `export function PrivacyCheckbox`

**职责**: 渲染隐私协议勾选控件，包含勾选框 + "我已阅读并同意隐私协议"文本。未勾选且尝试提交时，通过 `error` prop 展示红色高亮提示。

**Props 列表**:

| Props 名称 | 类型 | 必填 | 说明 |
|-----------|------|------|------|
| `checked` | `boolean` | 是 | 当前勾选状态，由父组件受控 |
| `onChange` | `function` | 是 | 状态切换回调，签名 `(checked: boolean) => void` |
| `error` | `string \| null` | 否 | 未勾选时触发的错误提示文字 |
| `disabled` | `boolean` | 否 | 提交加载期间禁用，默认 `false` |
| `testID` | `string` | 否 | E2E 测试选择器标识符 |

**负责的用户交互**:
- 点击勾选框或文本区域均可切换选中状态
- `error` 不为空时，勾选框边框高亮红色，并在下方显示错误提示文字

---

#### 4.2.5 `SubmitButton` — 表单提交按钮

**文件路径**: `apps/mobile/components/SubmitButton.jsx`
**Export 方式**: 具名 export `export function SubmitButton`

**职责**: 统一封装注册/登录的提交按钮，管理加载状态下的文字切换和禁用逻辑。

**Props 列表**:

| Props 名称 | 类型 | 必填 | 说明 |
|-----------|------|------|------|
| `label` | `string` | 是 | 正常状态的按钮文字（如"注册"、"登录"） |
| `loadingLabel` | `string` | 是 | 加载状态的按钮文字（如"注册中..."、"登录中..."） |
| `loading` | `boolean` | 是 | 是否处于加载状态 |
| `onPress` | `function` | 是 | 按钮点击回调，签名 `() => void` |
| `disabled` | `boolean` | 否 | 额外禁用控制（如表单有错误时），默认 `false` |
| `testID` | `string` | 否 | E2E 测试选择器标识符 |

**负责的用户交互**:
- `loading` 为 `true` 时显示 `loadingLabel`，按钮置灰禁用，防止重复提交
- `loading` 为 `false` 且 `disabled` 为 `false` 时，按钮可点击并触发 `onPress`

---

### 4.3 Context / Reducer 变更

#### 4.3.1 新增文件：`apps/mobile/context/auth-context.js`

**职责**: 维护全局用户认证状态，向全应用暴露当前登录用户信息和身份操作方法。

**State 结构**:

```js
{
  user: {          // 当前登录用户，未登录时为 null
    id: string,        // UUID
    email: string,
    nickname: string,
  } | null,
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated',
  // 'idle'            — 初始状态，尚未执行 /api/auth/me 检查
  // 'loading'         — 正在调用 /api/auth/me 恢复 session
  // 'authenticated'   — 已确认登录
  // 'unauthenticated' — 已确认未登录（/api/auth/me 返回 401 或无 session）
}
```

**新增 Action Type**:

| Action Type | Payload | 触发时机 |
|-------------|---------|---------|
| `AUTH_LOADING` | 无 | 应用启动时调用 `/api/auth/me` 前 |
| `AUTH_SUCCESS` | `{ user: { id, email, nickname } }` | `/api/auth/me`、登录、注册成功后 |
| `AUTH_FAILURE` | 无 | `/api/auth/me` 返回 401，或登录/注册失败后（仅清除 user，不弹错误） |
| `AUTH_LOGOUT` | 无 | 用户主动登出成功后 |

**暴露的 Context Value**:

```js
{
  user,          // 当前用户对象或 null
  status,        // 认证状态字符串
  login,         // async (email, password) => { data, error }
  register,      // async (email, nickname, password) => { data, error }
  logout,        // async () => void
  checkAuth,     // async () => void — 应用启动时调用，恢复 session
}
```

**Provider 放置位置**: `apps/mobile/app/_layout.jsx` 的根 Provider 层，包裹所有路由。

---

### 4.4 自定义 Hook 变更

#### 4.4.1 新增 Hook：`apps/mobile/hooks/use-auth.js`

**职责**: 封装对 `AuthContext` 的访问，提供类型安全的 context 消费方式，并在 Context 未挂载时抛出明确错误信息。

**入参**: 无

**返回值**:

```js
{
  user,          // { id, email, nickname } | null
  status,        // 'idle' | 'loading' | 'authenticated' | 'unauthenticated'
  login,         // async (email, password) => { data, error }
  register,      // async (email, nickname, password) => { data, error }
  logout,        // async () => void
  checkAuth,     // async () => void
  isAuthenticated, // boolean — status === 'authenticated' 的语法糖
  isLoading,       // boolean — status === 'loading' || status === 'idle' 的语法糖
}
```

**使用示例**:

```js
// 在 Screen 或组件中使用
import { useAuth } from '../hooks/use-auth';

function RegisterScreen() {
  const { register, status } = useAuth();
  // ...
}
```

---

### 4.5 用户交互流程

#### 4.5.1 注册流程

```
用户访问 /register
  └─► RegisterScreen 渲染
        ├─► 显示：邮箱输入框、昵称输入框、密码输入框（眼睛图标）、
        │         隐私协议勾选框、"注册"按钮、"已有账号？返回登录"链接
        │
        ├─► 用户填写邮箱 → onBlur → 格式验证（正则）
        │     ├─► 格式无效：AuthFormInput 显示红色错误文字"请输入有效的邮箱地址"
        │     └─► 格式有效：清除错误状态
        │
        ├─► 用户填写昵称 → onBlur → 长度验证（2-20 字符）
        │     ├─► 不符合：显示"昵称长度为 2-20 个字符"
        │     └─► 符合：清除错误状态；输入超过 20 字符时 maxLength 直接阻止继续输入
        │
        ├─► 用户填写密码 → onBlur → 长度验证（8-20 字符）
        │     ├─► 不符合：PasswordInput 显示"密码长度至少为 8 个字符"
        │     └─► 符合：清除错误状态
        │
        ├─► 用户勾选隐私协议 → PrivacyCheckbox checked=true
        │
        ├─► 用户点击"注册"按钮
        │     ├─► 前端整体校验（若有字段未填或存在错误，显示对应错误，阻止提交）
        │     ├─► 未勾选隐私协议：PrivacyCheckbox 高亮红色 + 错误提示
        │     └─► 全部校验通过：
        │           ├─► SubmitButton loading=true（文字变"注册中..."，禁用）
        │           ├─► 所有输入框 disabled=true
        │           ├─► 调用 AuthContext.register(email, nickname, password)
        │           │     └─► POST /api/auth/register
        │           ├─► 成功（201）：
        │           │     ├─► dispatch AUTH_SUCCESS({ user })
        │           │     └─► router.replace('/') → 重定向到 Memo 列表
        │           └─► 失败：
        │                 ├─► SubmitButton loading=false（恢复可点击）
        │                 ├─► 所有输入框恢复可编辑
        │                 └─► FormErrorBanner 展示服务端 error 字段内容
        │
        └─► 用户点击"返回登录"链接
              └─► 清空所有表单状态 → router.push('/login')
```

#### 4.5.2 登录流程

```
用户访问 /login（或未登录状态下被路由守卫重定向至此）
  └─► LoginScreen 渲染
        ├─► 显示：邮箱输入框、密码输入框（眼睛图标）、
        │         "登录"按钮、"没有账号？立即注册"链接
        │
        ├─► 用户填写邮箱、密码（仅提交时验证，无 onBlur 验证）
        │
        ├─► 用户点击"登录"按钮
        │     ├─► SubmitButton loading=true（文字变"登录中..."，禁用）
        │     ├─► 所有输入框 disabled=true
        │     ├─► 调用 AuthContext.login(email, password)
        │     │     └─► POST /api/auth/login
        │     ├─► 成功（200）：
        │     │     ├─► dispatch AUTH_SUCCESS({ user })
        │     │     └─► router.replace('/') → 重定向到 Memo 列表
        │     └─► 失败（401）：
        │           ├─► SubmitButton loading=false（恢复可点击）
        │           ├─► 邮箱输入框保持原内容
        │           ├─► 密码输入框内容清空（value 置空）
        │           ├─► 所有输入框恢复可编辑
        │           └─► FormErrorBanner 展示"邮箱或密码错误，请重试"
        │
        └─► 用户点击"立即注册"链接
              └─► 清空所有表单状态 → router.push('/register')
```

#### 4.5.3 Session 恢复流程（应用启动）

```
应用启动 → _layout.jsx 中 AuthProvider 初始化
  └─► useEffect → checkAuth()
        ├─► dispatch AUTH_LOADING（status = 'loading'）
        ├─► GET /api/auth/me
        ├─► 成功（200，有 Cookie）：
        │     ├─► dispatch AUTH_SUCCESS({ user })
        │     └─► 路由守卫允许访问业务页面
        └─► 失败（401，无有效 Session）：
              ├─► dispatch AUTH_FAILURE（status = 'unauthenticated'）
              └─► 路由守卫将用户重定向到 /login
```

#### 4.5.4 Session 过期处理

```
用户在已登录状态下操作任意业务接口
  └─► API Client 收到 401 响应
        ├─► dispatch AUTH_LOGOUT / AUTH_FAILURE
        └─► 提示"登录已过期，请重新登录"
              └─► router.replace('/login')
```

---

### 4.6 调用的 API 端点

以下端点由前端 `apps/mobile/lib/api-client.js` 中的函数封装并调用，路径遵循 REST 惯例，与 architect 数据模型一致。

#### `POST /api/auth/register` — 用户注册

**调用时机**: 注册页面表单校验通过后

**请求 Body**:
```json
{
  "email": "user@example.com",
  "nickname": "张三",
  "password": "mypassword123"
}
```

**响应 — 成功 (201)**:
```json
{
  "data": {
    "user": {
      "id": "uuid-string",
      "email": "user@example.com",
      "nickname": "张三"
    }
  },
  "message": "注册成功"
}
```

**响应 — 失败 (409，邮箱重复)**:
```json
{
  "data": null,
  "error": "该邮箱已被注册",
  "message": "注册失败"
}
```

**响应 — 失败 (400，参数校验失败)**:
```json
{
  "data": null,
  "error": "请输入有效的邮箱地址",
  "message": "参数错误"
}
```

**前端处理**: 成功后 Session Cookie 由浏览器自动保存（`httpOnly`），前端从 `data.user` 取用户信息写入 `AuthContext`。

---

#### `POST /api/auth/login` — 用户登录

**调用时机**: 登录页面点击"登录"按钮后

**请求 Body**:
```json
{
  "email": "user@example.com",
  "password": "mypassword123"
}
```

**响应 — 成功 (200)**:
```json
{
  "data": {
    "user": {
      "id": "uuid-string",
      "email": "user@example.com",
      "nickname": "张三"
    }
  },
  "message": "登录成功"
}
```

**响应 — 失败 (401)**:
```json
{
  "data": null,
  "error": "邮箱或密码错误，请重试",
  "message": "登录失败"
}
```

**前端处理**: 失败时密码输入框清空，`FormErrorBanner` 展示 `error` 字段内容。

---

#### `POST /api/auth/logout` — 用户登出

**调用时机**: 用户点击登出按钮（业务页面，后续迭代实现）

**请求 Body**: 无

**响应 — 成功 (200)**:
```json
{
  "data": null,
  "message": "已退出登录"
}
```

**前端处理**: 成功后 dispatch `AUTH_LOGOUT`，`router.replace('/login')`。

---

#### `GET /api/auth/me` — 获取当前登录用户信息

**调用时机**: 应用启动时（`AuthProvider` 的 `useEffect` 中），用于恢复 Session 登录状态

**请求 Body**: 无（通过 Cookie 自动携带 Session ID）

**响应 — 成功 (200，有有效 Session)**:
```json
{
  "data": {
    "user": {
      "id": "uuid-string",
      "email": "user@example.com",
      "nickname": "张三"
    }
  },
  "message": "ok"
}
```

**响应 — 失败 (401，无有效 Session)**:
```json
{
  "data": null,
  "error": "未登录",
  "message": "请先登录"
}
```

**前端处理**: 401 时触发 `AUTH_FAILURE`，路由守卫将用户重定向到 `/login`。

---

### 4.7 文件新增汇总

| 类型 | 文件路径 | 说明 |
|------|---------|------|
| Screen | `apps/mobile/app/index.jsx` | 根路由守卫（按认证状态重定向） |
| Screen | `apps/mobile/app/login.jsx` | 登录页面 |
| Screen | `apps/mobile/app/register.jsx` | 注册页面 |
| Screen | `apps/mobile/app/_layout.jsx` | 根布局，挂载 AuthProvider |
| Component | `apps/mobile/components/AuthFormInput.jsx` | 通用表单输入框 |
| Component | `apps/mobile/components/PasswordInput.jsx` | 密码输入框（含明密文切换） |
| Component | `apps/mobile/components/FormErrorBanner.jsx` | 表单顶部全局错误提示 |
| Component | `apps/mobile/components/PrivacyCheckbox.jsx` | 隐私协议勾选控件 |
| Component | `apps/mobile/components/SubmitButton.jsx` | 表单提交按钮（含加载状态） |
| Context | `apps/mobile/context/auth-context.js` | 全局认证状态 Context + Reducer |
| Hook | `apps/mobile/hooks/use-auth.js` | AuthContext 消费 Hook |
| API Client | `apps/mobile/lib/api-client.js` | HTTP 请求封装（若已存在则新增 auth 相关函数） |

---

### 4.8 设计决策与注意事项

1. **路由守卫实现方式**: 使用 Expo Router 的 `app/index.jsx` + `useAuth().status` 实现路由守卫，`status === 'loading' || status === 'idle'` 时渲染全屏 Loading 占位（`ActivityIndicator`），避免路由重定向闪烁（FOUC）。

2. **API Client 的 401 全局拦截**: `apps/mobile/lib/api-client.js` 中封装 `fetchWithAuth` 函数，统一处理 401 响应 — 捕获后 dispatch `AUTH_FAILURE` 并跳转登录页，覆盖 Session 过期场景。

3. **表单状态隔离**: 注册页和登录页各自独立维护本地表单状态（`useState`），不写入全局 Context。全局 Context 只存储认证结果（user + status），表单中间状态不共享。

4. **昵称最大长度限制**: `AuthFormInput` 的 `maxLength` prop 传 `20`，由 React Native `TextInput` 在 UI 层直接阻止超长输入，配合 `onBlur` 提示形成双重保护。

5. **Cookie 跨域配置**: Web 平台下，`api-client.js` 的 `fetch` 调用需设置 `credentials: 'include'`，以确保 `httpOnly` Session Cookie 随请求自动发送。Native 平台（Android/iOS）依赖 Expo 的 Cookie 支持，由 `@react-native-cookies/cookies` 或 Expo 内置机制处理（MVP 阶段以 Web 为主要目标平台）。

6. **密码不进入 AuthContext**: 密码字段仅存在于页面本地 `useState`，提交后立即丢弃，绝不写入 Context 或持久化存储，防止内存中的敏感数据泄露。

---

*本文件由 frontend-developer subagent 自动生成，内容以 spec 文档和 architect 输出为准。如有歧义请在 Issue #43 中补充说明。*
