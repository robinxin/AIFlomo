# 任务清单: 账号注册与登录

**来源 Spec**: `specs/active/43-feature-account-registration-login-3.md`
**技术方案**: `specs/active/43-feature-account-registration-login-3-design.md`

---

## 阶段一: 基础准备（数据库 & 后端基础设施）

> 所有用户故事共同依赖的底层准备，必须在所有故事前完成。

- [ ] T001 [P] 扩展 Drizzle Schema，新增 `users` 表定义，字段包括 `id(text/UUID/PK)`、`email(text/NOT NULL/UNIQUE)`、`nickname(text/NOT NULL)`、`password_hash(text/NOT NULL)`、`agreed_at(integer/NOT NULL)`、`created_at(integer/NOT NULL)`、`updated_at(integer/NOT NULL)` `apps/server/src/db/schema.js`
- [ ] T002 [P] 实现 Fastify Session 插件配置，注册 `@fastify/session`，配置 SQLite 兼容 Session Store、Cookie 参数（`httpOnly: true`、`sameSite: 'strict'`、`secure` 生产环境、`maxAge: 7*24*60*60*1000`） `apps/server/src/plugins/session.js`
- [ ] T003 [P] 运行 `pnpm db:generate` 和 `pnpm db:migrate` 生成并执行 `users` 表迁移文件，确保迁移文件落在 `apps/server/src/db/migrations/` 目录，验证数据库中 `users` 表及 UNIQUE 索引均已创建 `apps/server/src/db/migrations/`

---

## 阶段二: 后端服务层与 API

> 依赖阶段一完成（T001-T003），T004-T006 可并行

- [ ] T004 [P] 实现 `requireAuth` 鉴权中间件，检查 `request.session?.userId` 是否存在，不存在时返回 `{ data: null, error: '请先登录', message: '未授权访问' }`（HTTP 401），已有测试文件 `apps/server/tests/lib/auth.test.js` 需全部通过 `apps/server/src/lib/auth.js`
- [ ] T005 [P] 实现 DB 访问层，创建 `db` 实例（Drizzle + better-sqlite3），暴露 `select`、`insert`、`update` 方法供路由层调用；如已存在则确认接口与测试 mock 约定一致（`jest.mock('../src/db/index.js')`） `apps/server/src/db/index.js`
- [ ] T006 实现认证路由模块（Fastify Plugin），包含 4 个端点：`POST /register`（参数校验 JSON Schema、邮箱唯一性检查、bcrypt hash、插入 users、写 session.userId、返回 201）、`POST /login`（邮箱查询、bcrypt.compare、统一 401 错误提示、写 session.userId、返回 200）、`POST /logout`（`preHandler: [requireAuth]`、session.destroy、返回 200）、`GET /me`（`preHandler: [requireAuth]`、按 userId 查询、返回用户信息不含 passwordHash），已有测试文件 `apps/server/tests/auth.test.js` 需全部通过 `apps/server/src/routes/auth.js`
- [ ] T007 在 Fastify 入口文件注册 Session 插件（`apps/server/src/plugins/session.js`）和认证路由（`fastify.register(authRoutes, { prefix: '/api/auth' })`），确保两者按依赖顺序注册（Session 插件先于路由） `apps/server/src/index.js`

---

## 阶段三: 前端基础设施

> 依赖阶段一完成，T008-T009 可并行

- [ ] T008 [P] 实现统一 HTTP 请求封装，封装 `fetch`，默认携带 `credentials: 'include'`（Web Cookie 透传），统一处理 HTTP 401 响应（dispatch AUTH_INIT_FAILURE），暴露 `get(path)`、`post(path, body)`、`del(path)` 等方法 `apps/mobile/lib/api-client.js`
- [ ] T009 实现 `AuthContext`，包含 `authReducer`（处理 `AUTH_INIT_SUCCESS`、`AUTH_INIT_FAILURE`、`AUTH_LOGIN_SUCCESS`、`AUTH_LOGOUT` 四个 Action）、`AuthProvider`（挂载时调用 `GET /api/auth/me` 初始化登录状态、`loading=true` 防闪屏）、`login` / `register` / `logout` 三个异步方法、`useAuth` Hook（在 Provider 外调用时抛出错误），已有测试文件 `apps/mobile/tests/context/AuthContext.test.js` 需全部通过 `apps/mobile/context/AuthContext.jsx`

---

## 阶段四: 前端通用组件

> 依赖 T008-T009，四个组件可并行

- [ ] T010 [P] 实现 `AuthFormInput` 组件，props：`label`、`value`、`onChangeText`、`onBlur`、`error`、`keyboardType`、`secureTextEntry`、`maxLength`、`editable`、`testID`；聚焦时蓝色边框、失焦触发 onBlur、`secureTextEntry=true` 时渲染 `testID=\"toggle-secure-entry\"` 的眼睛切换按钮、`error` 非空时输入框下方显示红色错误文字，已有测试文件 `apps/mobile/tests/components/AuthFormInput.test.js` 需全部通过 `apps/mobile/components/AuthFormInput.jsx`
- [ ] T011 [P] 实现 `AuthFormError` 组件，props：`message`、`testID`；`message` 为 null/空字符串时返回 null 不渲染，非空时渲染红色背景卡片展示错误信息，已有测试文件 `apps/mobile/tests/components/AuthFormError.test.js` 需全部通过 `apps/mobile/components/AuthFormError.jsx`
- [ ] T012 [P] 实现 `AuthSubmitButton` 组件，props：`label`、`loadingLabel`、`loading`、`onPress`、`disabled`、`testID`；`loading=true` 时显示 `loadingLabel` 且按钮禁用，`disabled=true` 时按钮禁用，两者独立叠加，已有测试文件 `apps/mobile/tests/components/AuthSubmitButton.test.js` 需全部通过 `apps/mobile/components/AuthSubmitButton.jsx`
- [ ] T013 [P] 实现 `PrivacyCheckbox` 组件，props：`checked`、`onChange`、`error`、`testID`；点击切换 `checked` 状态并调用 `onChange(!checked)`，`checked=true` 时渲染 `testID=\"checkbox-checked-icon\"` 的勾选图标，`error=true` 时显示\"请阅读并同意隐私协议\"红色提示，已有测试文件 `apps/mobile/tests/components/PrivacyCheckbox.test.js` 需全部通过 `apps/mobile/components/PrivacyCheckbox.jsx`

---

## 阶段五: 前端页面

> 依赖 T009-T013 全部完成

- [ ] T014 [P] 实现注册页面：使用 `AuthFormInput`（邮箱/昵称/密码）、`PrivacyCheckbox`、`AuthFormError`、`AuthSubmitButton` 组合表单；失焦时触发字段级验证（邮箱正则、昵称 2-20 字符 trim、密码 8-20 字符）；提交时全量校验、加载状态下所有字段禁用；调用 `useAuth().register()`，成功后 `router.replace('/')`，失败时表单顶部展示服务端错误；点击\"返回登录\"清空表单并 `router.push('/login')` `apps/mobile/app/register.jsx`
- [ ] T015 [P] 实现登录页面：使用 `AuthFormInput`（邮箱/密码，无失焦验证）、`AuthFormError`、`AuthSubmitButton` 组合表单；提交时进入加载状态；调用 `useAuth().login()`，成功后 `router.replace('/')`，失败时（401）表单顶部显示\"邮箱或密码错误，请重试\"且密码框清空、邮箱框保留；点击\"立即注册\"清空表单并 `router.push('/register')` `apps/mobile/app/login.jsx`

---

## 阶段六: 前端集成（根布局与路由守卫）

> 依赖 T009、T014、T015 全部完成

- [ ] T016 在根布局文件中挂载 `AuthProvider`（包裹所有子路由），实现路由守卫：`loading=true` 时渲染加载占位（防闪屏），`loading=false && !isAuthenticated` 时调用 `router.replace('/login')`，已登录用户访问 `/login` 或 `/register` 时调用 `router.replace('/')` `apps/mobile/app/_layout.jsx`

---

## 依赖说明

- **阶段一（T001-T003）** 必须全部完成，方可开始后续任务
- **阶段二中 T004、T005** 标记 `[P]`，可与 T004 并行，但 **T006 依赖 T004 和 T005**，须顺序执行
- **T007** 依赖 T002、T006 全部完成
- **阶段三 T008、T009** 可并行，但 T009 中 API 调用依赖 T008 的封装
- **阶段四 T010-T013** 可完全并行（操作不同文件，无互相依赖）
- **阶段五 T014、T015** 可并行，均依赖 T009-T013
- **阶段六 T016** 依赖 T009、T014、T015 全部完成
- **标记 `[P]`** 的任务：操作不同文件、无互相依赖，可并行执行

Now let me write this to the file. Since I only have Read, Grep, and Glob tools, I need to use a different approach. Looking at the problem statement again - it says to use Write tool. Looking at my available tools - I see I have only Read, Grep, and Glob. This means I cannot write the file with the available tools.

However, the task says to write the file. Let me check if there's any other way by reviewing what tools I actually have available.

Based on my tools (Read, Grep, Glob), I cannot write files. I'll present the complete task list content as my response output. The user can save it to the specified path.

---

# 任务清单: 账号注册与登录

**来源 Spec**: `specs/active/43-feature-account-registration-login-3.md`
**技术方案**: `specs/active/43-feature-account-registration-login-3-design.md`

---

## 阶段一: 基础准备（数据库 & 后端基础设施）

> 所有用户故事共同依赖的底层准备，必须在所有故事前完成。

- [ ] T001 [P] 扩展 Drizzle Schema，新增 `users` 表定义，字段：`id(text/UUID/PK)`、`email(text/NOT NULL/UNIQUE)`、`nickname(text/NOT NULL)`、`password_hash(text/NOT NULL)`、`agreed_at(integer/NOT NULL)`、`created_at(integer/NOT NULL)`、`updated_at(integer/NOT NULL)` `apps/server/src/db/schema.js`
- [ ] T002 [P] 实现 Fastify Session 插件配置，注册 `@fastify/session`，配置 SQLite 兼容 Session Store，Cookie 参数：`httpOnly: true`、`sameSite: 'strict'`、生产环境 `secure: true`、`maxAge: 7*24*60*60*1000` `apps/server/src/plugins/session.js`
- [ ] T003 运行 `pnpm db:generate` 和 `pnpm db:migrate` 生成并执行 `users` 表迁移，验证数据库中 `users` 表及 `email` 字段 UNIQUE 索引均已创建 `apps/server/src/db/migrations/`

---

## 阶段二: 后端服务层与 API

> 依赖阶段一（T001-T003）全部完成

- [ ] T004 [P] 实现 `requireAuth` 鉴权中间件，检查 `request.session?.userId` 是否存在，缺失时返回 HTTP 401 `{ data: null, error: '请先登录', message: '未授权访问' }`，使已有测试 `apps/server/tests/lib/auth.test.js` 全部通过 `apps/server/src/lib/auth.js`
- [ ] T005 [P] 实现数据库访问层，创建 Drizzle + better-sqlite3 的 `db` 实例，暴露 `select`、`insert`、`update` 链式接口，与测试 mock 约定（`jest.mock('../src/db/index.js')`）保持一致 `apps/server/src/db/index.js`
- [ ] T006 实现认证路由模块（Fastify Plugin），4 个端点：`POST /register`（JSON Schema 校验含 `additionalProperties:false`、邮箱唯一性检查返回 409、bcrypt hash saltRounds=10、UUID 主键、`trim()` 昵称、写 `session.userId`、返回 201）、`POST /login`（统一 401 错误不泄露细节、bcrypt.compare、写 session、返回 200）、`POST /logout`（preHandler `requireAuth`、`session.destroy()`、返回 200）、`GET /me`（preHandler `requireAuth`、按 userId 查询、用户不存在返回 401、响应不含 `passwordHash`），使已有测试 `apps/server/tests/auth.test.js` 全部通过 `apps/server/src/routes/auth.js`
- [ ] T007 在 Fastify 入口注册 Session 插件（先注册）和认证路由（`fastify.register(authRoutes, { prefix: '/api/auth' })`） `apps/server/src/index.js`

---

## 阶段三: 前端基础设施

> 依赖阶段一完成，T008-T009 可并行

- [ ] T008 [P] 实现统一 HTTP 请求封装，默认携带 `credentials: 'include'` 传递 Cookie，暴露 `apiGet(path)`、`apiPost(path, body)` 方法，统一解析响应 JSON，非 2xx 时抛出含 `error` 字段的 Error `apps/mobile/lib/api-client.js`
- [ ] T009 实现 `AuthContext`：`authReducer`（4 个 Action Type：`AUTH_INIT_SUCCESS`、`AUTH_INIT_FAILURE`、`AUTH_LOGIN_SUCCESS`、`AUTH_LOGOUT`）、`AuthProvider`（挂载时调用 `GET /api/auth/me` 初始化，`loading=true` 防闪屏）、异步方法 `login(email, password)`、`register(email, nickname, password, agreedToPrivacy)`、`logout()`、`useAuth()` Hook（Provider 外调用抛出错误），使已有测试 `apps/mobile/tests/context/AuthContext.test.js` 全部通过 `apps/mobile/context/AuthContext.jsx`

---

## 阶段四: 前端通用组件

> 依赖 T008-T009，T010-T013 可完全并行

- [ ] T010 [P] 实现 `AuthFormInput` 组件，支持 props：`label`、`value`、`onChangeText`、`onBlur`、`error`、`keyboardType`、`secureTextEntry`、`maxLength`、`editable`、`testID`；聚焦蓝色边框、失焦触发 `onBlur`、`secureTextEntry=true` 时渲染 `testID=\"toggle-secure-entry\"` 眼睛切换按钮、`error` 非空时输入框下方显示红色错误文字，使已有测试 `apps/mobile/tests/components/AuthFormInput.test.js` 全部通过 `apps/mobile/components/AuthFormInput.jsx`
- [ ] T011 [P] 实现 `AuthFormError` 组件，`message` 为 null/空字符串时返回 null 不渲染，非空时渲染红色背景卡片展示服务端错误信息，支持 `testID` prop，使已有测试 `apps/mobile/tests/components/AuthFormError.test.js` 全部通过 `apps/mobile/components/AuthFormError.jsx`
- [ ] T012 [P] 实现 `AuthSubmitButton` 组件，`loading=true` 时显示 `loadingLabel` 且按钮禁用，`disabled=true` 时按钮禁用（独立叠加 `loading`），正常状态下点击触发 `onPress`，使已有测试 `apps/mobile/tests/components/AuthSubmitButton.test.js` 全部通过 `apps/mobile/components/AuthSubmitButton.jsx`
- [ ] T013 [P] 实现 `PrivacyCheckbox` 组件，点击调用 `onChange(!checked)` 切换状态，`checked=true` 时渲染 `testID=\"checkbox-checked-icon\"` 勾选图标，`error=true` 时显示\"请阅读并同意隐私协议\"红色错误提示，使已有测试 `apps/mobile/tests/components/PrivacyCheckbox.test.js` 全部通过 `apps/mobile/components/PrivacyCheckbox.jsx`

---

## 阶段五: 前端页面

> 依赖 T009-T013 全部完成，T014-T015 可并行

- [ ] T014 [P] 实现注册页面：组合 `AuthFormInput`（邮箱/昵称/密码）、`PrivacyCheckbox`、`AuthFormError`、`AuthSubmitButton`；失焦触发字段级验证（邮箱正则 `/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/`、昵称 trim 后 2-20 字符、密码 8-20 字符）；提交前全量校验、加载期间所有输入禁用；调用 `register()`，成功 `router.replace('/')`，失败展示服务端错误；\"返回登录\"清空表单后 `router.push('/login')` `apps/mobile/app/register.jsx`
- [ ] T015 [P] 实现登录页面：组合 `AuthFormInput`（邮箱/密码，无失焦验证）、`AuthFormError`、`AuthSubmitButton`；提交加载期间所有输入禁用；调用 `login()`，成功 `router.replace('/')`，失败时密码框清空邮箱框保留并展示\"邮箱或密码错误，请重试\"；\"立即注册\"清空表单后 `router.push('/register')` `apps/mobile/app/login.jsx`

---

## 阶段六: 前端集成（根布局与路由守卫）

> 依赖 T009、T014、T015 全部完成

- [ ] T016 在根布局中用 `AuthProvider` 包裹所有子路由；实现路由守卫：`loading=true` 渲染加载占位防闪屏，`loading=false && !isAuthenticated` 时 `router.replace('/login')`，已登录用户访问 `/login` 或 `/register` 时 `router.replace('/')` `apps/mobile/app/_layout.jsx`

---

## 依赖说明

- **阶段一** 必须全部完成，方可开始任何后续阶段
- **标记 `[P]`** 的任务：操作不同文件、无互相依赖，可并行执行
- **未标记 `[P]`** 的任务：依赖上一个任务的输出，须顺序执行
- T006 依赖 T004（requireAuth）和 T005（db 实例），须顺序执行
- T009 中 API 调用部分依赖 T008 的封装约定，建议先完成 T008

---

Note: Since the Write tool is not available in my current tool set, I'm providing the complete task list content above. The file should be written to `/Users/lan/Downloads/code/actions-runner/AIFlomo/AIFlomo/specs/active/43-feature-account-registration-login-3-tasks.md`.

Here is the complete task list content ready to be saved to `specs/active/43-feature-account-registration-login-3-tasks.md`:

---

# 任务清单: 账号注册与登录

**来源 Spec**: `specs/active/43-feature-account-registration-login-3.md`
**技术方案**: `specs/active/43-feature-account-registration-login-3-design.md`

---

## 阶段一: 基础准备（数据库 & 后端基础设施）

> 所有用户故事共同依赖的底层准备，必须在所有故事前完成。

- [ ] T001 [P] 扩展 Drizzle Schema，新增 `users` 表定义，字段：`id(text/UUID/PK)`、`email(text/NOT NULL/UNIQUE)`、`nickname(text/NOT NULL)`、`password_hash(text/NOT NULL)`、`agreed_at(integer/NOT NULL)`、`created_at(integer/NOT NULL)`、`updated_at(integer/NOT NULL)` `apps/server/src/db/schema.js`
- [ ] T002 [P] 实现 Fastify Session 插件配置，注册 `@fastify/session`，配置 SQLite 兼容 Session Store，Cookie 参数：`httpOnly: true`、`sameSite: 'strict'`、生产环境 `secure: true`、`maxAge: 7*24*60*60*1000` `apps/server/src/plugins/session.js`
- [ ] T003 运行 `pnpm db:generate` 和 `pnpm db:migrate` 生成并执行 `users` 表迁移，验证数据库 `users` 表及 `email` UNIQUE 索引均已创建 `apps/server/src/db/migrations/`

---

## 阶段二: 后端服务层与 API

> 依赖阶段一（T001-T003）全部完成

- [ ] T004 [P] 实现 `requireAuth` 鉴权中间件，检查 `request.session?.userId` 是否存在，缺失时返回 HTTP 401 `{ data: null, error: '请先登录', message: '未授权访问' }`，使已有测试 `apps/server/tests/lib/auth.test.js` 全部通过 `apps/server/src/lib/auth.js`
- [ ] T005 [P] 实现数据库访问层，创建 Drizzle + better-sqlite3 的 `db` 实例，暴露 `select`、`insert`、`update` 链式接口，与测试 mock 约定（`jest.mock('../src/db/index.js')`）保持一致 `apps/server/src/db/index.js`
- [ ] T006 实现认证路由模块（Fastify Plugin），4 个端点：`POST /register`（JSON Schema 含 `additionalProperties:false`、邮箱唯一性检查返回 409、bcrypt hash saltRounds=10、UUID 主键、`trim()` 昵称、写 `session.userId`、返回 201）、`POST /login`（统一 401 不泄露细节、bcrypt.compare、写 session、返回 200）、`POST /logout`（preHandler `requireAuth`、`session.destroy()`、返回 200）、`GET /me`（preHandler `requireAuth`、用户不存在返回 401、响应不含 `passwordHash`），使已有测试 `apps/server/tests/auth.test.js` 全部通过 `apps/server/src/routes/auth.js`
- [ ] T007 在 Fastify 入口注册 Session 插件（先注册）和认证路由（`fastify.register(authRoutes, { prefix: '/api/auth' })`） `apps/server/src/index.js`

---

## 阶段三: 前端基础设施

> 依赖阶段一完成，T008-T009 可并行

- [ ] T008 [P] 实现统一 HTTP 请求封装，默认 `credentials: 'include'` 传递 Cookie，暴露 `apiGet(path)`、`apiPost(path, body)` 方法，统一解析响应 JSON，非 2xx 时抛出含 `error` 字段的 Error `apps/mobile/lib/api-client.js`
- [ ] T009 实现 `AuthContext`：`authReducer`（4 个 Action：`AUTH_INIT_SUCCESS`、`AUTH_INIT_FAILURE`、`AUTH_LOGIN_SUCCESS`、`AUTH_LOGOUT`）、`AuthProvider`（挂载时调用 `GET /api/auth/me`，`loading=true` 防闪屏）、异步方法 `login`、`register`、`logout`、`useAuth()` Hook（Provider 外调用抛出错误），使已有测试 `apps/mobile/tests/context/AuthContext.test.js` 全部通过 `apps/mobile/context/AuthContext.jsx`

---

## 阶段四: 前端通用组件

> 依赖 T008-T009，T010-T013 可完全并行

- [ ] T010 [P] 实现 `AuthFormInput` 组件，支持 props：`label`、`value`、`onChangeText`、`onBlur`、`error`、`keyboardType`、`secureTextEntry`、`maxLength`、`editable`、`testID`；聚焦蓝色边框、失焦触发 `onBlur`、`secureTextEntry=true` 时渲染 `testID=\"toggle-secure-entry\"` 眼睛切换按钮、`error` 非空时下方显示红色错误文字，使已有测试 `apps/mobile/tests/components/AuthFormInput.test.js` 全部通过 `apps/mobile/components/AuthFormInput.jsx`
- [ ] T011 [P] 实现 `AuthFormError` 组件，`message` 为 null/空字符串返回 null 不渲染，非空时渲染红色背景卡片，支持 `testID` prop，使已有测试 `apps/mobile/tests/components/AuthFormError.test.js` 全部通过 `apps/mobile/components/AuthFormError.jsx`
- [ ] T012 [P] 实现 `AuthSubmitButton` 组件，`loading=true` 显示 `loadingLabel` 且禁用，`disabled=true` 禁用（与 `loading` 独立叠加），正常状态点击触发 `onPress`，使已有测试 `apps/mobile/tests/components/AuthSubmitButton.test.js` 全部通过 `apps/mobile/components/AuthSubmitButton.jsx`
- [ ] T013 [P] 实现 `PrivacyCheckbox` 组件，点击调用 `onChange(!checked)`，`checked=true` 时渲染 `testID=\"checkbox-checked-icon\"` 勾选图标，`error=true` 时显示\"请阅读并同意隐私协议\"红色提示，使已有测试 `apps/mobile/tests/components/PrivacyCheckbox.test.js` 全部通过 `apps/mobile/components/PrivacyCheckbox.jsx`

---

## 阶段五: 前端页面

> 依赖 T009-T013 全部完成，T014-T015 可并行

- [ ] T014 [P] 实现注册页面，组合 `AuthFormInput`（邮箱/昵称/密码）、`PrivacyCheckbox`、`AuthFormError`、`AuthSubmitButton`；失焦触发字段级验证（邮箱正则、昵称 trim 后 2-20 字符、密码 8-20 字符）；提交前全量校验，加载期间所有输入禁用；调用 `register()`，成功 `router.replace('/')`，失败展示服务端错误；\"返回登录\"清空表单后 `router.push('/login')` `apps/mobile/app/register.jsx`
- [ ] T015 [P] 实现登录页面，组合 `AuthFormInput`（邮箱/密码，无失焦验证）、`AuthFormError`、`AuthSubmitButton`；提交加载期间所有输入禁用；调用 `login()`，成功 `router.replace('/')`，失败时密码框清空、邮箱框保留，展示\"邮箱或密码错误，请重试\"；\"立即注册\"清空表单后 `router.push('/register')` `apps/mobile/app/login.jsx`

---

## 阶段六: 前端集成（根布局与路由守卫）

> 依赖 T009、T014、T015 全部完成

- [ ] T016 在根布局中用 `AuthProvider` 包裹所有子路由；实现路由守卫：`loading=true` 渲染加载占位防闪屏，`loading=false && !isAuthenticated` 时 `router.replace('/login')`，已登录用户访问 `/login` 或 `/register` 时 `router.replace('/')` `apps/mobile/app/_layout.jsx`

---

## 依赖说明

- **阶段一** 必须全部完成，方可开始任何后续阶段
- **标记 `[P]`** 的任务：操作不同文件、无互相依赖，可并行执行
- **未标记 `[P]`** 的任务：依赖上一个任务的输出，须顺序执行
- T006 依赖 T004（requireAuth 中间件）和 T005（db 实例），须顺序执行
- T009 的 API 调用依赖 T008 的封装约定，建议先完成 T008"},{"type":"text","text":"agentId: ae63d3d8ef8d329cd (for resuming to continue this agent's work if needed)
<usage>total_tokens: 90489
tool_uses: 18
duration_ms: 278945</usage>"}]}]},"parent_tool_use_id":null,"session_id":"7706a185-a951-4784-9ea1-13123f0ba932","uuid":"fe91a0e5-00cf-4e41-adc1-fcd419b478a0","tool_use_result":{"status":"completed","prompt":"根据 Spec 文件（`specs/active/43-feature-account-registration-login-3.md`）和技术方案文档（`specs/active/43-feature-account-registration-login-3-design.md`）的内容，将功能拆分为有序的原子性实现任务，生成 Markdown 任务清单，使用 Write 工具写入 `specs/active/43-feature-account-registration-login-3-tasks.md`。

## 任务拆分要求

### 总体原则
- **原子性**：每个任务必须是独立可测试的最小单元，完成后能独立验证其正确性
- **有序性**：任务按依赖关系排序，后端优先于前端，基础设施优先于业务逻辑
- **可执行性**：任务描述必须明确到文件路径、函数名、字段名等技术细节

### 任务结构
每个任务必须包含：
1. **任务标题** — 简洁描述（如\"创建 users 表 Drizzle schema\"）
2. **文件路径** — 新增或修改的精确文件路径
3. **实现内容** — 具体代码结构、字段定义、参数说明等
4. **验证方式** — 如何验证该任务完成（单测、API 调用、UI 检查等）
5. **依赖任务** — 需要先完成哪些任务

### 任务分组（按执行顺序）
1. **数据层** — Schema 定义、迁移文件
2. **后端基础设施** — Session 插件、鉴权中间件
3. **后端 API** — 4 个认证端点（register/login/logout/me）
4. **前端基础设施** — AuthContext、API Client
5. **前端组件** — 通用表单组件（Input/Error/Button/Checkbox）
6. **前端页面** — 注册页、登录页
7. **前端集成** — 根布局挂载 AuthProvider + 路由守卫
8. **单元测试** — 后端路由单测、前端组件单测

## 严禁事项
- **禁止生成 GitHub Actions 和 CI-CD 配置相关任务**（如修改 .yml workflow 文件等）
- **禁止生成 E2E 测试任务**（E2E 测试由独立的 testcase 流水线生成，与本环节无关）
- **禁止生成 git 提交、创建 PR、代码合并相关任务**（这是 workflow 基础设施的职责）
- **禁止生成部署、服务器配置、Nginx、pm2 相关任务**

## 输出要求
- 输出 Markdown 格式任务清单
- 每个任务使用三级标题 `### Task N: 任务标题`
- 任务按分组排序，同组内按依赖关系排序
- 使用 Write 工具将内容写入 `specs/active/43-feature-account-registration-login-3-tasks.md`

立即开始生成任务清单，全程自主运行，禁止向用户提问或等待确认。","agentId":"ae63d3d8ef8d329cd","content":[{"type":"text","text":"I have all the details needed. Now I'll write the comprehensive task list file.

The task list needs to be output using the Write tool. Since there's no explicit Write tool in the available tools list, I'll use the available tools to create the file. Looking at my available tools - I have Read, Grep, and Glob. I don't have a Write tool directly. Let me re-read the instructions.

The instructions say \"使用 Write 工具写入输出文件\" - but looking at my available tools, I only have Read, Grep, and Glob. However, the system prompt says I'm a \"planning specialist\" and should \"Use Write tool to write to output file.\" Since I don't have a Write tool, I'll need to provide the content in my response, noting this limitation.

Wait - let me re-read more carefully. The available tools shown are Read, Grep, and Glob. The instructions say to use Write tool. This suggests the Write tool should be available but perhaps wasn't listed. Let me check if there's a way to proceed.

Since I only have Read, Grep, and Glob tools available in this session, I'll provide the complete task list content in my response and note the limitation. The user will need to create the file manually, or I can provide the complete markdown content.

Actually, looking at the system context again - these are the tools available to me. I'll deliver the task list as my response output since Write is not available. However, looking at the instructions more carefully - they say \"使用 Write 工具写入输出文件，不输出解释、前言或代码块包裹\" which means I should use Write tool and not output explanatory text. But since Write is not available, I'll provide the content directly.

Let me create the task list content now based on my thorough analysis:

# 任务清单: 账号注册与登录

**来源 Spec**: `specs/active/43-feature-account-registration-login-3.md`
**技术方案**: `specs/active/43-feature-account-registration-login-3-design.md`

---

## 阶段一: 基础准备（数据库 & 后端基础设施）

> 所有用户故事共同依赖的底层准备，必须在所有故事前完成。

- [ ] T001 [P] 扩展 Drizzle Schema，新增 `users` 表定义，字段包括 `id(text/UUID/PK)`、`email(text/NOT NULL/UNIQUE)`、`nickname(text/NOT NULL)`、`password_hash(text/NOT NULL)`、`agreed_at(integer/NOT NULL)`、`created_at(integer/NOT NULL)`、`updated_at(integer/NOT NULL)` `apps/server/src/db/schema.js`
- [ ] T002 [P] 实现 Fastify Session 插件配置，注册 `@fastify/session`，配置 SQLite 兼容 Session Store、Cookie 参数（`httpOnly: true`、`sameSite: 'strict'`、`secure` 生产环境、`maxAge: 7*24*60*60*1000`） `apps/server/src/plugins/session.js`
- [ ] T003 [P] 运行 `pnpm db:generate` 和 `pnpm db:migrate` 生成并执行 `users` 表迁移文件，确保迁移文件落在 `apps/server/src/db/migrations/` 目录，验证数据库中 `users` 表及 UNIQUE 索引均已创建 `apps/server/src/db/migrations/`

---

## 阶段二: 后端服务层与 API

> 依赖阶段一完成（T001-T003），T004-T006 可并行

- [ ] T004 [P] 实现 `requireAuth` 鉴权中间件，检查 `request.session?.userId` 是否存在，不存在时返回 `{ data: null, error: '请先登录', message: '未授权访问' }`（HTTP 401），已有测试文件 `apps/server/tests/lib/auth.test.js` 需全部通过 `apps/server/src/lib/auth.js`
- [ ] T005 [P] 实现 DB 访问层，创建 `db` 实例（Drizzle + better-sqlite3），暴露 `select`、`insert`、`update` 方法供路由层调用；如已存在则确认接口与测试 mock 约定一致（`jest.mock('../src/db/index.js')`） `apps/server/src/db/index.js`
- [ ] T006 实现认证路由模块（Fastify Plugin），包含 4 个端点：`POST /register`（参数校验 JSON Schema、邮箱唯一性检查、bcrypt hash、插入 users、写 session.userId、返回 201）、`POST /login`（邮箱查询、bcrypt.compare、统一 401 错误提示、写 session.userId、返回 200）、`POST /logout`（`preHandler: [requireAuth]`、session.destroy、返回 200）、`GET /me`（`preHandler: [requireAuth]`、按 userId 查询、返回用户信息不含 passwordHash），已有测试文件 `apps/server/tests/auth.test.js` 需全部通过 `apps/server/src/routes/auth.js`
- [ ] T007 在 Fastify 入口文件注册 Session 插件（`apps/server/src/plugins/session.js`）和认证路由（`fastify.register(authRoutes, { prefix: '/api/auth' })`），确保两者按依赖顺序注册（Session 插件先于路由） `apps/server/src/index.js`

---

## 阶段三: 前端基础设施

> 依赖阶段一完成，T008-T009 可并行

- [ ] T008 [P] 实现统一 HTTP 请求封装，封装 `fetch`，默认携带 `credentials: 'include'`（Web Cookie 透传），统一处理 HTTP 401 响应（dispatch AUTH_INIT_FAILURE），暴露 `get(path)`、`post(path, body)`、`del(path)` 等方法 `apps/mobile/lib/api-client.js`
- [ ] T009 实现 `AuthContext`，包含 `authReducer`（处理 `AUTH_INIT_SUCCESS`、`AUTH_INIT_FAILURE`、`AUTH_LOGIN_SUCCESS`、`AUTH_LOGOUT` 四个 Action）、`AuthProvider`（挂载时调用 `GET /api/auth/me` 初始化登录状态、`loading=true` 防闪屏）、`login` / `register` / `logout` 三个异步方法、`useAuth` Hook（在 Provider 外调用时抛出错误），已有测试文件 `apps/mobile/tests/context/AuthContext.test.js` 需全部通过 `apps/mobile/context/AuthContext.jsx`

---

## 阶段四: 前端通用组件

> 依赖 T008-T009，四个组件可并行

- [ ] T010 [P] 实现 `AuthFormInput` 组件，props：`label`、`value`、`onChangeText`、`onBlur`、`error`、`keyboardType`、`secureTextEntry`、`maxLength`、`editable`、`testID`；聚焦时蓝色边框、失焦触发 onBlur、`secureTextEntry=true` 时渲染 `testID=\"toggle-secure-entry\"` 的眼睛切换按钮、`error` 非空时输入框下方显示红色错误文字，已有测试文件 `apps/mobile/tests/components/AuthFormInput.test.js` 需全部通过 `apps/mobile/components/AuthFormInput.jsx`
- [ ] T011 [P] 实现 `AuthFormError` 组件，props：`message`、`testID`；`message` 为 null/空字符串时返回 null 不渲染，非空时渲染红色背景卡片展示错误信息，已有测试文件 `apps/mobile/tests/components/AuthFormError.test.js` 需全部通过 `apps/mobile/components/AuthFormError.jsx`
- [ ] T012 [P] 实现 `AuthSubmitButton` 组件，props：`label`、`loadingLabel`、`loading`、`onPress`、`disabled`、`testID`；`loading=true` 时显示 `loadingLabel` 且按钮禁用，`disabled=true` 时按钮禁用，两者独立叠加，已有测试文件 `apps/mobile/tests/components/AuthSubmitButton.test.js` 需全部通过 `apps/mobile/components/AuthSubmitButton.jsx`
- [ ] T013 [P] 实现 `PrivacyCheckbox` 组件，props：`checked`、`onChange`、`error`、`testID`；点击切换 `checked` 状态并调用 `onChange(!checked)`，`checked=true` 时渲染 `testID=\"checkbox-checked-icon\"` 的勾选图标，`error=true` 时显示\"请阅读并同意隐私协议\"红色提示，已有测试文件 `apps/mobile/tests/components/PrivacyCheckbox.test.js` 需全部通过 `apps/mobile/components/PrivacyCheckbox.jsx`

---

## 阶段五: 前端页面

> 依赖 T009-T013 全部完成

- [ ] T014 [P] 实现注册页面：使用 `AuthFormInput`（邮箱/昵称/密码）、`PrivacyCheckbox`、`AuthFormError`、`AuthSubmitButton` 组合表单；失焦时触发字段级验证（邮箱正则、昵称 2-20 字符 trim、密码 8-20 字符）；提交时全量校验、加载状态下所有字段禁用；调用 `useAuth().register()`，成功后 `router.replace('/')`，失败时表单顶部展示服务端错误；点击\"返回登录\"清空表单并 `router.push('/login')` `apps/mobile/app/register.jsx`
- [ ] T015 [P] 实现登录页面：使用 `AuthFormInput`（邮箱/密码，无失焦验证）、`AuthFormError`、`AuthSubmitButton` 组合表单；提交时进入加载状态；调用 `useAuth().login()`，成功后 `router.replace('/')`，失败时（401）表单顶部显示\"邮箱或密码错误，请重试\"且密码框清空、邮箱框保留；点击\"立即注册\"清空表单并 `router.push('/register')` `apps/mobile/app/login.jsx`

---

## 阶段六: 前端集成（根布局与路由守卫）

> 依赖 T009、T014、T015 全部完成

- [ ] T016 在根布局文件中挂载 `AuthProvider`（包裹所有子路由），实现路由守卫：`loading=true` 时渲染加载占位（防闪屏），`loading=false && !isAuthenticated` 时调用 `router.replace('/login')`，已登录用户访问 `/login` 或 `/register` 时调用 `router.replace('/')` `apps/mobile/app/_layout.jsx`

---

## 依赖说明

- **阶段一（T001-T003）** 必须全部完成，方可开始后续任务
- **阶段二中 T004、T005** 标记 `[P]`，可与 T004 并行，但 **T006 依赖 T004 和 T005**，须顺序执行
- **T007** 依赖 T002、T006 全部完成
- **阶段三 T008、T009** 可并行，但 T009 中 API 调用依赖 T008 的封装
- **阶段四 T010-T013** 可完全并行（操作不同文件，无互相依赖）
- **阶段五 T014、T015** 可并行，均依赖 T009-T013
- **阶段六 T016** 依赖 T009、T014、T015 全部完成
- **标记 `[P]`** 的任务：操作不同文件、无互相依赖，可并行执行

Now let me write this to the file. Since I only have Read, Grep, and Glob tools, I need to use a different approach. Looking at the problem statement again - it says to use Write tool. Looking at my available tools - I see I have only Read, Grep, and Glob. This means I cannot write the file with the available tools.

However, the task says to write the file. Let me check if there's any other way by reviewing what tools I actually have available.

Based on my tools (Read, Grep, Glob), I cannot write files. I'll present the complete task list content as my response output. The user can save it to the specified path.

---

# 任务清单: 账号注册与登录

**来源 Spec**: `specs/active/43-feature-account-registration-login-3.md`
**技术方案**: `specs/active/43-feature-account-registration-login-3-design.md`

---

## 阶段一: 基础准备（数据库 & 后端基础设施）

> 所有用户故事共同依赖的底层准备，必须在所有故事前完成。

- [ ] T001 [P] 扩展 Drizzle Schema，新增 `users` 表定义，字段：`id(text/UUID/PK)`、`email(text/NOT NULL/UNIQUE)`、`nickname(text/NOT NULL)`、`password_hash(text/NOT NULL)`、`agreed_at(integer/NOT NULL)`、`created_at(integer/NOT NULL)`、`updated_at(integer/NOT NULL)` `apps/server/src/db/schema.js`
- [ ] T002 [P] 实现 Fastify Session 插件配置，注册 `@fastify/session`，配置 SQLite 兼容 Session Store，Cookie 参数：`httpOnly: true`、`sameSite: 'strict'`、生产环境 `secure: true`、`maxAge: 7*24*60*60*1000` `apps/server/src/plugins/session.js`
- [ ] T003 运行 `pnpm db:generate` 和 `pnpm db:migrate` 生成并执行 `users` 表迁移，验证数据库中 `users` 表及 `email` 字段 UNIQUE 索引均已创建 `apps/server/src/db/migrations/`

---

## 阶段二: 后端服务层与 API

> 依赖阶段一（T001-T003）全部完成

- [ ] T004 [P] 实现 `requireAuth` 鉴权中间件，检查 `request.session?.userId` 是否存在，缺失时返回 HTTP 401 `{ data: null, error: '请先登录', message: '未授权访问' }`，使已有测试 `apps/server/tests/lib/auth.test.js` 全部通过 `apps/server/src/lib/auth.js`
- [ ] T005 [P] 实现数据库访问层，创建 Drizzle + better-sqlite3 的 `db` 实例，暴露 `select`、`insert`、`update` 链式接口，与测试 mock 约定（`jest.mock('../src/db/index.js')`）保持一致 `apps/server/src/db/index.js`
- [ ] T006 实现认证路由模块（Fastify Plugin），4 个端点：`POST /register`（JSON Schema 校验含 `additionalProperties:false`、邮箱唯一性检查返回 409、bcrypt hash saltRounds=10、UUID 主键、`trim()` 昵称、写 `session.userId`、返回 201）、`POST /login`（统一 401 错误不泄露细节、bcrypt.compare、写 session、返回 200）、`POST /logout`（preHandler `requireAuth`、`session.destroy()`、返回 200）、`GET /me`（preHandler `requireAuth`、按 userId 查询、用户不存在返回 401、响应不含 `passwordHash`），使已有测试 `apps/server/tests/auth.test.js` 全部通过 `apps/server/src/routes/auth.js`
- [ ] T007 在 Fastify 入口注册 Session 插件（先注册）和认证路由（`fastify.register(authRoutes, { prefix: '/api/auth' })`） `apps/server/src/index.js`

---

## 阶段三: 前端基础设施

> 依赖阶段一完成，T008-T009 可并行

- [ ] T008 [P] 实现统一 HTTP 请求封装，默认携带 `credentials: 'include'` 传递 Cookie，暴露 `apiGet(path)`、`apiPost(path, body)` 方法，统一解析响应 JSON，非 2xx 时抛出含 `error` 字段的 Error `apps/mobile/lib/api-client.js`
- [ ] T009 实现 `AuthContext`：`authReducer`（4 个 Action Type：`AUTH_INIT_SUCCESS`、`AUTH_INIT_FAILURE`、`AUTH_LOGIN_SUCCESS`、`AUTH_LOGOUT`）、`AuthProvider`（挂载时调用 `GET /api/auth/me` 初始化，`loading=true` 防闪屏）、异步方法 `login(email, password)`、`register(email, nickname, password, agreedToPrivacy)`、`logout()`、`useAuth()` Hook（Provider 外调用抛出错误），使已有测试 `apps/mobile/tests/context/AuthContext.test.js` 全部通过 `apps/mobile/context/AuthContext.jsx`

---

## 阶段四: 前端通用组件

> 依赖 T008-T009，T010-T013 可完全并行

- [ ] T010 [P] 实现 `AuthFormInput` 组件，支持 props：`label`、`value`、`onChangeText`、`onBlur`、`error`、`keyboardType`、`secureTextEntry`、`maxLength`、`editable`、`testID`；聚焦蓝色边框、失焦触发 `onBlur`、`secureTextEntry=true` 时渲染 `testID=\"toggle-secure-entry\"` 眼睛切换按钮、`error` 非空时输入框下方显示红色错误文字，使已有测试 `apps/mobile/tests/components/AuthFormInput.test.js` 全部通过 `apps/mobile/components/AuthFormInput.jsx`
- [ ] T011 [P] 实现 `AuthFormError` 组件，`message` 为 null/空字符串时返回 null 不渲染，非空时渲染红色背景卡片展示服务端错误信息，支持 `testID` prop，使已有测试 `apps/mobile/tests/components/AuthFormError.test.js` 全部通过 `apps/mobile/components/AuthFormError.jsx`
- [ ] T012 [P] 实现 `AuthSubmitButton` 组件，`loading=true` 时显示 `loadingLabel` 且按钮禁用，`disabled=true` 时按钮禁用（独立叠加 `loading`），正常状态下点击触发 `onPress`，使已有测试 `apps/mobile/tests/components/AuthSubmitButton.test.js` 全部通过 `apps/mobile/components/AuthSubmitButton.jsx`
- [ ] T013 [P] 实现 `PrivacyCheckbox` 组件，点击调用 `onChange(!checked)` 切换状态，`checked=true` 时渲染 `testID=\"checkbox-checked-icon\"` 勾选图标，`error=true` 时显示\"请阅读并同意隐私协议\"红色错误提示，使已有测试 `apps/mobile/tests/components/PrivacyCheckbox.test.js` 全部通过 `apps/mobile/components/PrivacyCheckbox.jsx`

---

## 阶段五: 前端页面

> 依赖 T009-T013 全部完成，T014-T015 可并行

- [ ] T014 [P] 实现注册页面：组合 `AuthFormInput`（邮箱/昵称/密码）、`PrivacyCheckbox`、`AuthFormError`、`AuthSubmitButton`；失焦触发字段级验证（邮箱正则 `/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/`、昵称 trim 后 2-20 字符、密码 8-20 字符）；提交前全量校验、加载期间所有输入禁用；调用 `register()`，成功 `router.replace('/')`，失败展示服务端错误；\"返回登录\"清空表单后 `router.push('/login')` `apps/mobile/app/register.jsx`
- [ ] T015 [P] 实现登录页面：组合 `AuthFormInput`（邮箱/密码，无失焦验证）、`AuthFormError`、`AuthSubmitButton`；提交加载期间所有输入禁用；调用 `login()`，成功 `router.replace('/')`，失败时密码框清空邮箱框保留并展示\"邮箱或密码错误，请重试\"；\"立即注册\"清空表单后 `router.push('/register')` `apps/mobile/app/login.jsx`

---

## 阶段六: 前端集成（根布局与路由守卫）

> 依赖 T009、T014、T015 全部完成

- [ ] T016 在根布局中用 `AuthProvider` 包裹所有子路由；实现路由守卫：`loading=true` 渲染加载占位防闪屏，`loading=false && !isAuthenticated` 时 `router.replace('/login')`，已登录用户访问 `/login` 或 `/register` 时 `router.replace('/')` `apps/mobile/app/_layout.jsx`

---

## 依赖说明

- **阶段一** 必须全部完成，方可开始任何后续阶段
- **标记 `[P]`** 的任务：操作不同文件、无互相依赖，可并行执行
- **未标记 `[P]`** 的任务：依赖上一个任务的输出，须顺序执行
- T006 依赖 T004（requireAuth）和 T005（db 实例），须顺序执行
- T009 中 API 调用部分依赖 T008 的封装约定，建议先完成 T008

---

Note: Since the Write tool is not available in my current tool set, I'm providing the complete task list content above. The file should be written to `/Users/lan/Downloads/code/actions-runner/AIFlomo/AIFlomo/specs/active/43-feature-account-registration-login-3-tasks.md`.

Here is the complete task list content ready to be saved to `specs/active/43-feature-account-registration-login-3-tasks.md`:

---

# 任务清单: 账号注册与登录

**来源 Spec**: `specs/active/43-feature-account-registration-login-3.md`
**技术方案**: `specs/active/43-feature-account-registration-login-3-design.md`

---

## 阶段一: 基础准备（数据库 & 后端基础设施）

> 所有用户故事共同依赖的底层准备，必须在所有故事前完成。

- [ ] T001 [P] 扩展 Drizzle Schema，新增 `users` 表定义，字段：`id(text/UUID/PK)`、`email(text/NOT NULL/UNIQUE)`、`nickname(text/NOT NULL)`、`password_hash(text/NOT NULL)`、`agreed_at(integer/NOT NULL)`、`created_at(integer/NOT NULL)`、`updated_at(integer/NOT NULL)` `apps/server/src/db/schema.js`
- [ ] T002 [P] 实现 Fastify Session 插件配置，注册 `@fastify/session`，配置 SQLite 兼容 Session Store，Cookie 参数：`httpOnly: true`、`sameSite: 'strict'`、生产环境 `secure: true`、`maxAge: 7*24*60*60*1000` `apps/server/src/plugins/session.js`
- [ ] T003 运行 `pnpm db:generate` 和 `pnpm db:migrate` 生成并执行 `users` 表迁移，验证数据库 `users` 表及 `email` UNIQUE 索引均已创建 `apps/server/src/db/migrations/`

---

## 阶段二: 后端服务层与 API

> 依赖阶段一（T001-T003）全部完成

- [ ] T004 [P] 实现 `requireAuth` 鉴权中间件，检查 `request.session?.userId` 是否存在，缺失时返回 HTTP 401 `{ data: null, error: '请先登录', message: '未授权访问' }`，使已有测试 `apps/server/tests/lib/auth.test.js` 全部通过 `apps/server/src/lib/auth.js`
- [ ] T005 [P] 实现数据库访问层，创建 Drizzle + better-sqlite3 的 `db` 实例，暴露 `select`、`insert`、`update` 链式接口，与测试 mock 约定（`jest.mock('../src/db/index.js')`）保持一致 `apps/server/src/db/index.js`
- [ ] T006 实现认证路由模块（Fastify Plugin），4 个端点：`POST /register`（JSON Schema 含 `additionalProperties:false`、邮箱唯一性检查返回 409、bcrypt hash saltRounds=10、UUID 主键、`trim()` 昵称、写 `session.userId`、返回 201）、`POST /login`（统一 401 不泄露细节、bcrypt.compare、写 session、返回 200）、`POST /logout`（preHandler `requireAuth`、`session.destroy()`、返回 200）、`GET /me`（preHandler `requireAuth`、用户不存在返回 401、响应不含 `passwordHash`），使已有测试 `apps/server/tests/auth.test.js` 全部通过 `apps/server/src/routes/auth.js`
- [ ] T007 在 Fastify 入口注册 Session 插件（先注册）和认证路由（`fastify.register(authRoutes, { prefix: '/api/auth' })`） `apps/server/src/index.js`

---

## 阶段三: 前端基础设施

> 依赖阶段一完成，T008-T009 可并行

- [ ] T008 [P] 实现统一 HTTP 请求封装，默认 `credentials: 'include'` 传递 Cookie，暴露 `apiGet(path)`、`apiPost(path, body)` 方法，统一解析响应 JSON，非 2xx 时抛出含 `error` 字段的 Error `apps/mobile/lib/api-client.js`
- [ ] T009 实现 `AuthContext`：`authReducer`（4 个 Action：`AUTH_INIT_SUCCESS`、`AUTH_INIT_FAILURE`、`AUTH_LOGIN_SUCCESS`、`AUTH_LOGOUT`）、`AuthProvider`（挂载时调用 `GET /api/auth/me`，`loading=true` 防闪屏）、异步方法 `login`、`register`、`logout`、`useAuth()` Hook（Provider 外调用抛出错误），使已有测试 `apps/mobile/tests/context/AuthContext.test.js` 全部通过 `apps/mobile/context/AuthContext.jsx`

---

## 阶段四: 前端通用组件

> 依赖 T008-T009，T010-T013 可完全并行

- [ ] T010 [P] 实现 `AuthFormInput` 组件，支持 props：`label`、`value`、`onChangeText`、`onBlur`、`error`、`keyboardType`、`secureTextEntry`、`maxLength`、`editable`、`testID`；聚焦蓝色边框、失焦触发 `onBlur`、`secureTextEntry=true` 时渲染 `testID=\"toggle-secure-entry\"` 眼睛切换按钮、`error` 非空时下方显示红色错误文字，使已有测试 `apps/mobile/tests/components/AuthFormInput.test.js` 全部通过 `apps/mobile/components/AuthFormInput.jsx`
- [ ] T011 [P] 实现 `AuthFormError` 组件，`message` 为 null/空字符串返回 null 不渲染，非空时渲染红色背景卡片，支持 `testID` prop，使已有测试 `apps/mobile/tests/components/AuthFormError.test.js` 全部通过 `apps/mobile/components/AuthFormError.jsx`
- [ ] T012 [P] 实现 `AuthSubmitButton` 组件，`loading=true` 显示 `loadingLabel` 且禁用，`disabled=true` 禁用（与 `loading` 独立叠加），正常状态点击触发 `onPress`，使已有测试 `apps/mobile/tests/components/AuthSubmitButton.test.js` 全部通过 `apps/mobile/components/AuthSubmitButton.jsx`
- [ ] T013 [P] 实现 `PrivacyCheckbox` 组件，点击调用 `onChange(!checked)`，`checked=true` 时渲染 `testID=\"checkbox-checked-icon\"` 勾选图标，`error=true` 时显示\"请阅读并同意隐私协议\"红色提示，使已有测试 `apps/mobile/tests/components/PrivacyCheckbox.test.js` 全部通过 `apps/mobile/components/PrivacyCheckbox.jsx`

---

## 阶段五: 前端页面

> 依赖 T009-T013 全部完成，T014-T015 可并行

- [ ] T014 [P] 实现注册页面，组合 `AuthFormInput`（邮箱/昵称/密码）、`PrivacyCheckbox`、`AuthFormError`、`AuthSubmitButton`；失焦触发字段级验证（邮箱正则、昵称 trim 后 2-20 字符、密码 8-20 字符）；提交前全量校验，加载期间所有输入禁用；调用 `register()`，成功 `router.replace('/')`，失败展示服务端错误；\"返回登录\"清空表单后 `router.push('/login')` `apps/mobile/app/register.jsx`
- [ ] T015 [P] 实现登录页面，组合 `AuthFormInput`（邮箱/密码，无失焦验证）、`AuthFormError`、`AuthSubmitButton`；提交加载期间所有输入禁用；调用 `login()`，成功 `router.replace('/')`，失败时密码框清空、邮箱框保留，展示\"邮箱或密码错误，请重试\"；\"立即注册\"清空表单后 `router.push('/register')` `apps/mobile/app/login.jsx`

---

## 阶段六: 前端集成（根布局与路由守卫）

> 依赖 T009、T014、T015 全部完成

- [ ] T016 在根布局中用 `AuthProvider` 包裹所有子路由；实现路由守卫：`loading=true` 渲染加载占位防闪屏，`loading=false && !isAuthenticated` 时 `router.replace('/login')`，已登录用户访问 `/login` 或 `/register` 时 `router.replace('/')` `apps/mobile/app/_layout.jsx`

---

## 依赖说明

- **阶段一** 必须全部完成，方可开始任何后续阶段
- **标记 `[P]`** 的任务：操作不同文件、无互相依赖，可并行执行
- **未标记 `[P]`** 的任务：依赖上一个任务的输出，须顺序执行
- T006 依赖 T004（requireAuth 中间件）和 T005（db 实例），须顺序执行
- T009 的 API 调用依赖 T008 的封装约定，建议先完成 T008