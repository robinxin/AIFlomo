# 任务清单: 账号注册与登录

**来源 Spec**: `specs/active/28-feature-account-registration-login-2.md`
**技术方案**: `specs/active/28-feature-account-registration-login-2-design.md`

---

## 阶段一: 基础准备（数据库 & 公共模块）

> 所有用户故事共同依赖的底层准备，必须在所有故事前完成。

- [ ] T001 [P] 定义 users 和 sessions 数据表 Schema `apps/server/src/db/schema.js`
- [ ] T002 [P] 创建 Drizzle 实例导出文件 `apps/server/src/db/index.js`
- [ ] T003 [P] 配置 Drizzle Kit `apps/server/drizzle.config.js`
- [ ] T004 [P] 实现密码哈希工具函数（bcrypt.hash 和 bcrypt.compare） `apps/server/src/lib/password.js`
- [ ] T005 [P] 定义自定义错误类（AppError、UnauthorizedError、ConflictError） `apps/server/src/lib/errors.js`
- [ ] T006 [P] 配置 Session 插件（@fastify/session + SQLite store） `apps/server/src/plugins/session.js`
- [ ] T007 [P] 配置 CORS 插件（@fastify/cors） `apps/server/src/plugins/cors.js`
- [ ] T008 实现 requireAuth 认证中间件（校验 Session 有效性） `apps/server/src/plugins/auth.js`

---

## 阶段二: 用户故事 1 - 用户注册（优先级: P1）

**目标**: 新用户可通过邮箱、昵称、密码完成注册，同意隐私协议后创建账号并自动登录

- [ ] T009 实现注册 API 端点（POST /api/auth/register，包含参数校验、邮箱唯一性检查、密码哈希、Session 创建） `apps/server/src/routes/auth.js`
- [ ] T010 实现 Fastify 应用入口，注册全局插件（session、cors）和路由，配置全局错误处理 `apps/server/src/index.js`
- [ ] T011 创建统一 API Client（fetch 封装，支持 credentials: 'include'） `apps/mobile/lib/api-client.js`
- [ ] T012 创建 AuthContext（包含 user 状态、Reducer、Provider、useAuth Hook） `apps/mobile/context/AuthContext.jsx`
- [ ] T013 创建 use-auth Hook，封装 register 方法（调用 API + dispatch action） `apps/mobile/hooks/use-auth.js`
- [ ] T014 [P] 创建 TextInput 通用组件（支持邮箱、密码、错误提示） `apps/mobile/components/TextInput.jsx`
- [ ] T015 [P] 创建 Button 通用组件（支持加载状态、禁用状态） `apps/mobile/components/Button.jsx`
- [ ] T016 [P] 创建 PolicyCheckbox 隐私协议复选框组件 `apps/mobile/components/PolicyCheckbox.jsx`
- [ ] T017 创建认证路由组布局（Stack 导航，无 header） `apps/mobile/app/(auth)/_layout.jsx`
- [ ] T018 实现注册页面（表单、前端校验、提交逻辑、跳转） `apps/mobile/app/(auth)/register.jsx`
- [ ] T019 更新根布局，包裹 AuthProvider `apps/mobile/app/_layout.jsx`

---

## 阶段三: 用户故事 2 - 用户登录（优先级: P1）

**目标**: 已注册用户通过邮箱和密码登录系统，成功后进入主页面

- [ ] T020 实现登录 API 端点（POST /api/auth/login，包含参数校验、bcrypt 验证、Session 创建） `apps/server/src/routes/auth.js`
- [ ] T021 实现登出 API 端点（POST /api/auth/logout，删除 Session） `apps/server/src/routes/auth.js`
- [ ] T022 实现获取当前用户信息 API 端点（GET /api/auth/me，需 requireAuth） `apps/server/src/routes/auth.js`
- [ ] T023 在 use-auth Hook 中新增 login、logout、fetchCurrentUser 方法 `apps/mobile/hooks/use-auth.js`
- [ ] T024 实现登录页面（表单、前端校验、提交逻辑、跳转到主页面） `apps/mobile/app/(auth)/login.jsx`

---

## 阶段四: 用户故事 3 - 注册和登录页面导航切换（优先级: P2）

**目标**: 用户可在注册页面和登录页面之间自由切换

- [ ] T025 在注册页面添加"返回登录"链接，点击跳转到 /login `apps/mobile/app/(auth)/register.jsx`
- [ ] T026 在登录页面添加"立即注册"链接，点击跳转到 /register `apps/mobile/app/(auth)/login.jsx`

---

## 阶段五: 用户故事 4 - 密码安全性（优先级: P2）

**目标**: 系统对用户密码进行基本强度验证，确保账号安全性

- [ ] T027 在注册页面前端校验密码长度（最少 6 位，最多 128 位），显示友好提示 `apps/mobile/app/(auth)/register.jsx`
- [ ] T028 在登录和注册页面设置密码输入框为 secureTextEntry 模式（掩码显示） `apps/mobile/app/(auth)/login.jsx` `apps/mobile/app/(auth)/register.jsx`

---

## 依赖说明

- **阶段一** 必须全部完成，方可开始任何用户故事
- **标记 [P]** 的任务：操作不同文件、无互相依赖，可并行执行
- **未标记 [P]** 的任务：依赖上一个任务的输出，须顺序执行
- 不同用户故事阶段之间可并行（由不同开发者同时进行）
