# §4 前端页面与组件设计

> 功能：账号注册与登录（Issue #43）
> 生成日期：2026-03-11
> 生成者：frontend-developer subagent
> 依据：specs/active/43-feature-account-registration-login-3.md + docs/standards/code-standards-frontend.md

---

## 4.1 需要新增的 Screen

所有认证相关页面放在 `(auth)` 路由分组下，避免影响主应用路由组 `(app)/`。

| 文件路径 | URL 路径 | 职责 |
|---------|---------|------|
| `apps/mobile/app/(auth)/_layout.jsx` | — | 认证路由组布局，Stack 导航，无 header，统一背景色 |
| `apps/mobile/app/(auth)/login.jsx` | `/login` | 登录页面 Screen，组合 LoginForm 组件，处理登录成功后跳转 |
| `apps/mobile/app/(auth)/register.jsx` | `/register` | 注册页面 Screen，组合 RegisterForm 组件，处理注册成功后跳转 |
| `apps/mobile/app/index.jsx` | `/` | 入口页，检查认证状态后自动重定向：已登录跳转 `/memo`，未登录跳转 `/login` |
| `apps/mobile/app/_layout.jsx` | — | 根布局，注入 `AuthProvider`，Stack 导航 |

### 各 Screen 说明

**`app/index.jsx`**
- 渲染一个空白加载占位（`ActivityIndicator`）
- 挂载后读取 `AuthContext` 的 `state.user`
- 若 `state.isLoading` 为 `true`，继续显示加载态
- 若 `state.user` 存在，调用 `router.replace('/(app)/memo')` （路由由 memo 功能后续实现）
- 若 `state.user` 为 null，调用 `router.replace('/(auth)/login')`

**`app/(auth)/_layout.jsx`**
- 使用 `Stack` 导航，`screenOptions={{ headerShown: false }}`
- 统一设置白色背景，使认证页面与主应用页面视觉隔离

**`app/(auth)/login.jsx`**
- 页面标题区：显示 "欢迎回来" 标题 + 副标题文案
- 渲染 `<LoginForm />` 组件
- 登录成功回调：`router.replace('/(app)/memo')`
- 底部提供 "立即注册" 链接，点击后调用 `router.replace('/(auth)/register')`

**`app/(auth)/register.jsx`**
- 页面标题区：显示 "创建账号" 标题 + 副标题文案
- 渲染 `<RegisterForm />` 组件
- 注册成功回调：`router.replace('/(app)/memo')`
- 底部提供 "返回登录" 链接，点击后调用 `router.replace('/(auth)/login')`

---

## 4.2 需要新增的组件

所有组件放在 `apps/mobile/components/` 下，使用具名 export，PascalCase 文件名。

---

### 4.2.1 `components/AuthFormError.jsx`

**职责**：在表单顶部展示服务端返回的错误信息（如"邮箱已被注册"、"邮箱或密码错误"），可主动关闭。

**Props**：

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `message` | `string \| null` | 是 | 错误信息文本；为 `null` 或空字符串时组件不渲染 |
| `onDismiss` | `() => void` | 否 | 点击关闭按钮的回调，若不传则不显示关闭按钮 |

**用户交互**：
- `message` 有值时，显示红色背景的错误提示框（含警告图标 + 文字）
- `message` 为 null 时，返回 `null`，不占用布局空间
- 若传入 `onDismiss`，右侧显示 × 按钮，点击触发 `onDismiss`

---

### 4.2.2 `components/FormField.jsx`

**职责**：统一封装带标签、输入框、错误提示的表单字段，避免在 LoginForm/RegisterForm 中重复编写相同的布局结构。

**Props**：

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `label` | `string` | 是 | 字段标签文字（如"邮箱"） |
| `value` | `string` | 是 | 输入框当前值（受控） |
| `onChangeText` | `(text: string) => void` | 是 | 文本变化回调 |
| `onBlur` | `() => void` | 否 | 失焦回调，用于触发字段验证 |
| `error` | `string \| null` | 否 | 字段级错误文本；有值时输入框红色边框 + 下方红色文字 |
| `placeholder` | `string` | 否 | 输入框占位文字 |
| `secureTextEntry` | `boolean` | 否 | 是否密文输入，默认 `false` |
| `rightIcon` | `ReactNode` | 否 | 输入框右侧图标插槽（用于密码显示/隐藏切换） |
| `keyboardType` | `string` | 否 | 键盘类型，默认 `'default'`；邮箱字段传 `'email-address'` |
| `maxLength` | `number` | 否 | 最大输入字符数 |
| `editable` | `boolean` | 否 | 是否可编辑，默认 `true`；提交中时传 `false` |
| `autoCapitalize` | `string` | 否 | 首字母大写策略，邮箱字段传 `'none'` |

**用户交互**：
- 聚焦时输入框边框变蓝（`#4f8ef7`）
- 失焦且 `error` 有值时边框变红（`#e53935`），`error` 文字显示在输入框下方
- `editable` 为 `false` 时输入框背景变灰，用户无法编辑
- `maxLength` 到达上限时阻止继续输入（由 React Native TextInput 原生支持）

---

### 4.2.3 `components/PasswordField.jsx`

**职责**：在 `FormField` 基础上封装密码输入字段，内置密码明文/密文切换逻辑（眼睛图标）。

**Props**：

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `label` | `string` | 是 | 字段标签，默认显示"密码" |
| `value` | `string` | 是 | 输入框当前值（受控） |
| `onChangeText` | `(text: string) => void` | 是 | 文本变化回调 |
| `onBlur` | `() => void` | 否 | 失焦回调 |
| `error` | `string \| null` | 否 | 字段级错误文本 |
| `placeholder` | `string` | 否 | 占位文字 |
| `editable` | `boolean` | 否 | 是否可编辑 |

**用户交互**：
- 组件内部维护 `showPassword` 状态（`useState(false)`）
- 右侧渲染眼睛图标（睁眼/闭眼切换），点击时 `showPassword` 取反
- 内部将 `secureTextEntry={!showPassword}` 传给 `FormField`
- 图标使用 Text 字符模拟（"👁" / "🙈"）或 Expo 内置 icon，不引入新 npm 包

---

### 4.2.4 `components/PrivacyCheckbox.jsx`

**职责**：隐私协议勾选框，包含勾选框 + "我已阅读并同意《隐私协议》"文字，未勾选时可高亮错误状态。

**Props**：

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `checked` | `boolean` | 是 | 当前勾选状态（受控） |
| `onToggle` | `() => void` | 是 | 点击切换状态的回调 |
| `error` | `boolean` | 否 | 是否显示错误状态（边框高亮），默认 `false` |
| `disabled` | `boolean` | 否 | 是否禁用点击，默认 `false` |

**用户交互**：
- 点击整行（勾选框 + 文字区域）均可触发 `onToggle`
- `checked` 为 `true` 时，显示绿色勾选框 + 勾选图标
- `error` 为 `true` 时，勾选框边框变红，下方显示"请阅读并同意隐私协议"红色文字
- `disabled` 为 `true` 时，点击无效，视觉变灰

---

### 4.2.5 `components/AuthSubmitButton.jsx`

**职责**：统一封装注册/登录的提交按钮，支持加载状态（文字变化 + 禁用 + 视觉反馈）。

**Props**：

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `label` | `string` | 是 | 按钮正常状态文字（如"注册"、"登录"） |
| `loadingLabel` | `string` | 是 | 加载状态文字（如"注册中..."、"登录中..."） |
| `isLoading` | `boolean` | 是 | 是否处于加载状态 |
| `onPress` | `() => void` | 是 | 点击回调 |
| `disabled` | `boolean` | 否 | 额外的禁用控制，默认 `false` |

**用户交互**：
- `isLoading` 为 `true` 时：显示 `loadingLabel`，按钮不可点击，背景色变浅（透明度 0.6），显示 `ActivityIndicator`
- `isLoading` 为 `false` 且 `disabled` 为 `false` 时：显示 `label`，正常可点击，绿色背景（`#4caf50`）
- 点击时有按压反馈（`Pressable` 的 `android_ripple` 或 iOS 的透明度变化）

---

### 4.2.6 `components/LoginForm.jsx`

**职责**：登录表单完整实现，包含邮箱输入、密码输入、提交按钮、错误提示区，调用登录 API 并通过 `onSuccess` 回调通知父级。

**Props**：

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `onSuccess` | `() => void` | 是 | 登录成功后的回调（由 Screen 处理跳转） |

**用户交互**：
1. 渲染邮箱 `FormField`（`keyboardType='email-address'`，`autoCapitalize='none'`）
2. 渲染 `PasswordField`
3. 渲染 `AuthSubmitButton`（label="登录"，loadingLabel="登录中..."）
4. 渲染 `AuthFormError`（显示服务端错误）
5. 点击"登录"按钮：先做基础非空校验（邮箱/密码不为空），若不通过显示表单级错误
6. 通过校验后：`dispatch({ type: 'AUTH_LOGIN_START' })`，调用 `POST /api/auth/login`
7. 成功：`dispatch({ type: 'AUTH_LOGIN_SUCCESS', payload: user })`，调用 `onSuccess()`
8. 失败：`dispatch({ type: 'AUTH_LOGIN_ERROR', payload: errorMessage })`，通过 `AuthFormError` 展示
9. 登录失败后，密码输入框自动清空，邮箱保持原内容（符合 spec FR-007）

---

### 4.2.7 `components/RegisterForm.jsx`

**职责**：注册表单完整实现，包含邮箱、昵称、密码输入、隐私协议勾选、提交按钮、错误提示，调用注册 API 并通过 `onSuccess` 回调通知父级。

**Props**：

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `onSuccess` | `() => void` | 是 | 注册成功后的回调（由 Screen 处理跳转） |

**用户交互**：
1. 渲染邮箱 `FormField`（`keyboardType='email-address'`，`autoCapitalize='none'`，`onBlur` 触发邮箱格式验证）
2. 渲染昵称 `FormField`（`maxLength=20`，`onBlur` 触发长度验证）
3. 渲染 `PasswordField`（`onBlur` 触发密码长度验证）
4. 渲染 `PrivacyCheckbox`
5. 渲染 `AuthFormError`（显示服务端错误）
6. 渲染 `AuthSubmitButton`（label="注册"，loadingLabel="注册中..."）
7. 点击"注册"按钮：执行完整表单验证（格式 + 隐私协议勾选），任意字段有误则阻止提交并显示字段级错误
8. 验证通过：`dispatch({ type: 'AUTH_REGISTER_START' })`，调用 `POST /api/auth/register`
9. 成功：`dispatch({ type: 'AUTH_REGISTER_SUCCESS', payload: user })`，调用 `onSuccess()`
10. 失败：`dispatch({ type: 'AUTH_REGISTER_ERROR', payload: errorMessage })`，展示 `AuthFormError`

**失焦验证规则（blur 触发，≤ 200ms 延迟）**：

| 字段 | 验证规则 | 错误提示 |
|------|---------|---------|
| 邮箱 | 正则 `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` | "请输入有效的邮箱地址" |
| 昵称 | 长度 2–20 字符 | "昵称长度为 2-20 个字符" |
| 密码 | 长度 8–20 字符 | "密码长度为 8-20 个字符" |

---

## 4.3 Context / Reducer 变更

### 新增文件：`apps/mobile/context/AuthContext.jsx`

**影响范围**：新增文件，不修改现有 Context。

**state 结构**：

```js
const initialState = {
  user: null,           // { id, email, nickname, createdAt } | null
  isLoading: false,     // 认证操作（登录/注册/初始化检查）是否进行中
  error: null,          // string | null，认证操作的错误信息
};
```

**新增 Action Types**：

| Action Type | payload | 触发时机 | state 变更 |
|-------------|---------|---------|-----------|
| `AUTH_INIT_START` | — | 应用启动，检查 session 是否有效 | `isLoading: true, error: null` |
| `AUTH_INIT_SUCCESS` | `user \| null` | session 检查完成 | `isLoading: false, user: payload` |
| `AUTH_INIT_ERROR` | — | session 检查失败（网络错误等） | `isLoading: false, user: null` |
| `AUTH_LOGIN_START` | — | 用户点击登录按钮，请求发出前 | `isLoading: true, error: null` |
| `AUTH_LOGIN_SUCCESS` | `user` | 登录 API 成功响应 | `isLoading: false, user: payload, error: null` |
| `AUTH_LOGIN_ERROR` | `errorMessage` | 登录 API 失败响应 | `isLoading: false, error: payload` |
| `AUTH_REGISTER_START` | — | 用户点击注册按钮，请求发出前 | `isLoading: true, error: null` |
| `AUTH_REGISTER_SUCCESS` | `user` | 注册 API 成功响应（自动登录） | `isLoading: false, user: payload, error: null` |
| `AUTH_REGISTER_ERROR` | `errorMessage` | 注册 API 失败响应 | `isLoading: false, error: payload` |
| `AUTH_LOGOUT` | — | 用户主动登出或 Session 过期检测 | `user: null, isLoading: false, error: null` |
| `AUTH_CLEAR_ERROR` | — | 组件 unmount 或用户关闭错误提示 | `error: null` |

**Context 导出**：
- `AuthProvider` — 包裹整个应用，置于 `app/_layout.jsx` 最外层
- `useAuth()` — 统一访问 Hook，返回 `{ state, dispatch }`

**`app/_layout.jsx` 变更**：
- 新增 `AuthProvider` 包裹 `<Stack>`
- 示例结构：

```jsx
// app/_layout.jsx
import { Stack } from 'expo-router';
import { AuthProvider } from '@/context/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
```

---

## 4.4 自定义 Hook 变更

### 新增：`apps/mobile/hooks/use-auth.js`

**职责**：封装认证相关的业务逻辑（初始化 session 检查、登录、注册、登出），避免在组件中直接调用 API 和 dispatch。

**入参**：无（内部通过 `useAuth()` 访问 Context）

**返回值**：

```js
{
  user,          // state.user — 当前登录用户对象或 null
  isLoading,     // state.isLoading — 认证操作是否进行中
  error,         // state.error — 认证错误信息
  initSession,   // async () => void — 初始化时检查 session 有效性
  login,         // async ({ email, password }) => boolean — 登录，成功返回 true
  register,      // async ({ email, nickname, password }) => boolean — 注册，成功返回 true
  logout,        // async () => void — 登出
  clearError,    // () => void — 清除错误状态
}
```

**`initSession` 逻辑**：
1. `dispatch({ type: 'AUTH_INIT_START' })`
2. 调用 `GET /api/auth/me`
3. 成功：`dispatch({ type: 'AUTH_INIT_SUCCESS', payload: user })`
4. 失败（401 或网络错误）：`dispatch({ type: 'AUTH_INIT_SUCCESS', payload: null })`（非异常，正常未登录态）

**`login` 逻辑**：
1. `dispatch({ type: 'AUTH_LOGIN_START' })`
2. 调用 `POST /api/auth/login` with `{ email, password }`
3. 成功：`dispatch({ type: 'AUTH_LOGIN_SUCCESS', payload: user })`，返回 `true`
4. 失败：`dispatch({ type: 'AUTH_LOGIN_ERROR', payload: err.message })`，返回 `false`

**`register` 逻辑**：
1. `dispatch({ type: 'AUTH_REGISTER_START' })`
2. 调用 `POST /api/auth/register` with `{ email, nickname, password }`
3. 成功：`dispatch({ type: 'AUTH_REGISTER_SUCCESS', payload: user })`，返回 `true`
4. 失败：`dispatch({ type: 'AUTH_REGISTER_ERROR', payload: err.message })`，返回 `false`

**`logout` 逻辑**：
1. 调用 `POST /api/auth/logout`（无论成功失败）
2. `dispatch({ type: 'AUTH_LOGOUT' })`

---

## 4.5 用户交互流程

### 注册流程

```
用户访问 /register
  → 看到：标题"创建账号"、邮箱/昵称/密码输入框（均为空）、
           未勾选的隐私协议勾选框、绿色"注册"按钮、底部"返回登录"链接

用户填写邮箱（如 "test@"）
  → 失焦时：邮箱输入框边框变红 + 下方显示"请输入有效的邮箱地址"
  → 修正为合法邮箱后再次失焦：错误消失，边框恢复默认

用户填写昵称
  → 输入超过 20 字符时：被阻止继续输入（maxLength）
  → 失焦且昵称 < 2 字符：显示"昵称长度为 2-20 个字符"

用户填写密码
  → 点击右侧眼睛图标：密码切换明文显示
  → 失焦且密码 < 8 字符：显示"密码长度为 8-20 个字符"

用户未勾选隐私协议就点击"注册"
  → 勾选框边框变红 + 下方显示"请阅读并同意隐私协议"
  → 表单不提交

用户勾选隐私协议后点击"注册"（所有字段合法）
  → 按钮文字变为"注册中..."，所有输入框和按钮禁用（防重复提交）
  → 请求发出 → 后端处理

  [成功路径]
  → 页面自动跳转至 /(app)/memo，不停留在注册页

  [失败路径 — 邮箱已被注册]
  → 表单顶部出现红色错误框："该邮箱已被注册"
  → 所有输入框和按钮恢复可用，表单内容保持不变，用户可修改邮箱重试

  [失败路径 — 网络异常]
  → 表单顶部出现红色错误框："网络连接失败，请稍后重试"
  → 所有输入框和按钮恢复可用

用户点击"返回登录"链接
  → 跳转至 /login，当前注册表单内容清空（不传递到登录页）
```

### 登录流程

```
用户访问 /login
  → 看到：标题"欢迎回来"、邮箱/密码输入框（均为空）、
           绿色"登录"按钮、底部"立即注册"链接

用户填写邮箱和密码后点击"登录"
  → 按钮文字变为"登录中..."，输入框和按钮全部禁用

  [成功路径]
  → 页面自动跳转至 /(app)/memo

  [失败路径 — 邮箱或密码错误]
  → 表单顶部出现红色错误框："邮箱或密码错误，请重试"
  → 密码输入框自动清空，邮箱输入框保持原内容
  → 按钮和输入框恢复可用

  [失败路径 — 网络异常]
  → 表单顶部出现红色错误框："网络连接失败，请稍后重试"
  → 邮箱和密码内容均保留，恢复可用

用户点击"立即注册"链接
  → 跳转至 /register，当前登录表单内容清空

Session 过期场景（来自其他已登录页面）
  → API 请求返回 401
  → 调用 logout()（dispatch AUTH_LOGOUT）
  → 跳转 /login，显示提示："登录已过期，请重新登录"（由 AuthFormError 展示）
```

### 应用启动 Session 检查流程

```
用户打开应用，进入 /（index.jsx）
  → 看到空白加载占位（ActivityIndicator）
  → useEffect 触发 initSession()
  → GET /api/auth/me

  [有效 Session] → 跳转 /(app)/memo
  [无效 Session 或未登录] → 跳转 /login
```

---

## 4.6 调用的 API 端点

以下端点根据数据模型（User + Session）和 REST 惯例推断，遵循项目统一响应格式 `{ data, message }` / `{ data: null, error, message }`。

### POST /api/auth/register — 注册新账号

**请求体**：
```json
{
  "email": "user@example.com",
  "nickname": "用户昵称",
  "password": "password123"
}
```

**成功响应（201）**：
```json
{
  "data": {
    "id": 1,
    "email": "user@example.com",
    "nickname": "用户昵称",
    "createdAt": "2026-03-11T10:00:00.000Z"
  },
  "message": "注册成功"
}
```

**失败响应（409 — 邮箱已存在）**：
```json
{
  "data": null,
  "error": "EMAIL_ALREADY_EXISTS",
  "message": "该邮箱已被注册"
}
```

**失败响应（400 — 参数格式错误）**：
```json
{
  "data": null,
  "error": "VALIDATION_ERROR",
  "message": "请输入有效的邮箱地址"
}
```

---

### POST /api/auth/login — 用户登录

**请求体**：
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
    "id": 1,
    "email": "user@example.com",
    "nickname": "用户昵称",
    "createdAt": "2026-03-11T10:00:00.000Z"
  },
  "message": "登录成功"
}
```
> 后端同时设置 `Set-Cookie: session=...; HttpOnly; SameSite=Strict`

**失败响应（401 — 邮箱或密码错误）**：
```json
{
  "data": null,
  "error": "INVALID_CREDENTIALS",
  "message": "邮箱或密码错误，请重试"
}
```

---

### POST /api/auth/logout — 登出

**请求体**：无

**成功响应（200）**：
```json
{
  "data": null,
  "message": "已退出登录"
}
```
> 后端清除 Session，`Set-Cookie` 置空

---

### GET /api/auth/me — 获取当前登录用户信息（Session 检查）

**请求体**：无（依赖 Cookie 传递 Session）

**成功响应（200 — Session 有效）**：
```json
{
  "data": {
    "id": 1,
    "email": "user@example.com",
    "nickname": "用户昵称",
    "createdAt": "2026-03-11T10:00:00.000Z"
  },
  "message": "ok"
}
```

**失败响应（401 — 未登录或 Session 过期）**：
```json
{
  "data": null,
  "error": "UNAUTHORIZED",
  "message": "请先登录"
}
```

---

## 4.7 文件清单总览

```
apps/mobile/
├── app/
│   ├── _layout.jsx                    # 根布局（新增 AuthProvider）
│   ├── index.jsx                      # 入口 — Session 检查 + 重定向
│   └── (auth)/
│       ├── _layout.jsx                # 认证路由组布局
│       ├── login.jsx                  # 登录页 Screen
│       └── register.jsx               # 注册页 Screen
├── components/
│   ├── AuthFormError.jsx              # 表单级错误提示组件
│   ├── FormField.jsx                  # 通用表单字段组件
│   ├── PasswordField.jsx              # 密码字段（含明文切换）
│   ├── PrivacyCheckbox.jsx            # 隐私协议勾选框
│   ├── AuthSubmitButton.jsx           # 认证提交按钮
│   ├── LoginForm.jsx                  # 登录表单（组合组件）
│   └── RegisterForm.jsx               # 注册表单（组合组件）
├── context/
│   └── AuthContext.jsx                # Auth Context + Reducer + Provider + useAuth Hook
└── hooks/
    └── use-auth.js                    # 认证业务 Hook（API 调用封装）
```
