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
