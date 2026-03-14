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
- **未标记 `[P]`** 的任务：依赖上一个任务的输出，须顺序执行
- T006 依赖 T004（requireAuth 中间件）和 T005（db 实例），须顺序执行
- T009 的 API 调用依赖 T008 的封装约定，建议先完成 T008