# Frontend Output: 账号注册与登录 — §4 前端页面与组件设计

**关联 Spec**: specs/active/43-feature-account-registration-login-3.md
**生成日期**: 2026-03-13
**生成 Agent**: frontend-developer subagent

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

#### 4.6.1 `POST /api/auth/register` — 用户注册

**调用时机**：用户点击注册按钮且前端验证全部通过

**请求**：

```json
{
  "email": "user@example.com",
  "nickname": "小明",
  "password": "mypassword123",
  "agreedAt": 1741824000000
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `email` | string | 用户邮箱，前端已做格式验证 |
| `nickname` | string | 用户昵称，前端已做长度验证（2-20 字符，trim 后） |
| `password` | string | 明文密码，前端已做长度验证（8-20 字符），后端负责哈希 |
| `agreedAt` | number | 用户勾选隐私协议时的 Unix 毫秒时间戳，由前端在提交时赋值 `Date.now()` |

**成功响应** (`HTTP 200`)：

```json
{
  "data": {
    "id": "uuid-string",
    "email": "user@example.com",
    "nickname": "小明"
  },
  "message": "注册成功"
}
```

**失败响应**：

| HTTP 状态码 | `error` 字段 | 场景 |
|------------|-------------|------|
| 409 | `"EMAIL_ALREADY_EXISTS"` | 邮箱已被注册 |
| 400 | `"VALIDATION_ERROR"` | 请求参数格式非法（后端兜底） |
| 500 | `"INTERNAL_ERROR"` | 服务端内部错误 |

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
    "nickname": "小明"
  },
  "message": "登录成功"
}
```

**失败响应**：

| HTTP 状态码 | `error` 字段 | 场景 |
|------------|-------------|------|
| 401 | `"INVALID_CREDENTIALS"` | 邮箱或密码错误（不区分具体哪个，防止用户枚举） |
| 400 | `"VALIDATION_ERROR"` | 请求参数格式非法 |

---

#### 4.6.3 `POST /api/auth/logout` — 用户登出

**调用时机**：用户主动点击登出（在未来的用户设置/个人中心页面使用；本次不实现登出入口，但 `AuthContext` 已预留 `logout` 方法）

**请求**：无 Body（通过 Cookie 中的 Session ID 识别用户）

**成功响应** (`HTTP 200`)：

```json
{
  "data": null,
  "message": "已登出"
}
```

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
    "nickname": "小明"
  },
  "message": "ok"
}
```

**失败响应**：

| HTTP 状态码 | `error` 字段 | 场景 |
|------------|-------------|------|
| 401 | `"UNAUTHORIZED"` | 未登录或 Session 已过期 |

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
