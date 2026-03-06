# 任务清单: 账号注册与登录

**来源 Spec**: `specs/active/28-feature-account-registration-login-2.md`
**技术方案**: `specs/active/28-feature-account-registration-login-2-design.md`

---

## 阶段一: 基础准备（数据库 & 公共模块）

> 所有用户故事共同依赖的底层准备,必须在所有故事前完成。

- [ ] T001 [P] 配置 Drizzle ORM,新增 `users` 和 `sessions` 表 Schema `apps/server/src/db/schema.js`
- [ ] T002 [P] 创建 Drizzle 实例并导出数据库连接 `apps/server/src/db/index.js`
- [ ] T003 [P] 配置 Drizzle Kit 迁移工具 `apps/server/drizzle.config.js`
- [ ] T004 [P] 实现密码哈希工具(bcrypt),封装 hash 和 compare 方法 `apps/server/src/lib/password.js`
- [ ] T005 [P] 定义统一错误类(AppError、UnauthorizedError、ConflictError) `apps/server/src/lib/errors.js`
- [ ] T006 [P] 配置 Session 插件(@fastify/session + SQLite store) `apps/server/src/plugins/session.js`
- [ ] T007 [P] 配置 CORS 插件(@fastify/cors) `apps/server/src/plugins/cors.js`
- [ ] T008 实现认证中间件 requireAuth,校验 Session 有效性 `apps/server/src/plugins/auth.js`
- [ ] T009 创建后端应用入口,注册插件和全局错误处理 `apps/server/src/index.js`
- [ ] T010 [P] 配置后端 package.json,添加 Fastify、Drizzle、bcrypt 等依赖及标准脚本 `apps/server/package.json`

---

## 阶段二: 用户故事 1 - 用户注册（优先级: P1）

**目标**: 新用户可通过邮箱、昵称、密码完成注册,同意隐私协议后创建账号并自动登录

- [ ] T011 实现注册接口 POST /api/auth/register,含参数校验、邮箱唯一性检查、密码哈希、自动创建 Session `apps/server/src/routes/auth.js`
- [ ] T012 实现注册页面,包含表单输入、前端校验、错误提示、跳转逻辑 `apps/mobile/app/(auth)/register.jsx`
- [ ] T013 [P] 实现通用文本输入框组件,支持错误提示、密码掩码、邮箱键盘类型 `apps/mobile/components/TextInput.jsx`
- [ ] T014 [P] 实现通用按钮组件,支持加载状态、禁用状态、主次样式变体 `apps/mobile/components/Button.jsx`
- [ ] T015 [P] 实现隐私协议复选框组件,展示勾选框和协议文本 `apps/mobile/components/PolicyCheckbox.jsx`

---

## 阶段三: 用户故事 2 - 用户登录（优先级: P1）

**目标**: 已注册用户通过邮箱和密码登录,成功后进入主页面并维持 Session 状态

- [ ] T016 实现登录接口 POST /api/auth/login,含参数校验、密码验证、Session 创建、Cookie 写入 `apps/server/src/routes/auth.js`
- [ ] T017 实现登出接口 POST /api/auth/logout,删除 Session 并清除 Cookie `apps/server/src/routes/auth.js`
- [ ] T018 实现获取当前用户接口 GET /api/auth/me,返回登录用户信息 `apps/server/src/routes/auth.js`
- [ ] T019 实现登录页面,包含表单输入、前端校验、错误提示、跳转逻辑 `apps/mobile/app/(auth)/login.jsx`
- [ ] T020 [P] 创建 AuthContext,管理用户登录状态(user、isLoading、error) `apps/mobile/context/AuthContext.jsx`
- [ ] T021 [P] 封装认证操作 Hook,提供 login、register、logout、fetchCurrentUser 方法 `apps/mobile/hooks/use-auth.js`
- [ ] T022 [P] 实现统一 API Client,封装 fetch 请求(带 credentials: 'include') `apps/mobile/lib/api-client.js`

---

## 阶段四: 用户故事 3 - 注册和登录页面导航切换（优先级: P2）

**目标**: 用户可在登录和注册页面之间自由切换,表单数据不保留

- [ ] T023 创建认证路由组布局,配置 Stack 导航(无 header) `apps/mobile/app/(auth)/_layout.jsx`
- [ ] T024 在登录页面添加"立即注册"链接,点击跳转到注册页面 `apps/mobile/app/(auth)/login.jsx`
- [ ] T025 在注册页面添加"返回登录"链接,点击跳转到登录页面 `apps/mobile/app/(auth)/register.jsx`

---

## 阶段五: 用户故事 4 - 密码安全性（优先级: P2）

**目标**: 系统对密码进行基本强度验证,确保账号安全

- [ ] T026 在注册和登录页面前端校验密码长度(6-128字符),显示即时错误提示 `apps/mobile/app/(auth)/register.jsx` `apps/mobile/app/(auth)/login.jsx`
- [ ] T027 在后端 JSON Schema 中强制验证密码长度,拒绝不合规请求 `apps/server/src/routes/auth.js`

---

## 阶段六: 集成与配置

**目标**: 将认证模块集成到应用根布局,配置环境变量

- [ ] T028 在根布局中包裹 AuthProvider,使全局可访问认证状态 `apps/mobile/app/_layout.jsx`
- [ ] T029 [P] 配置 Babel 路径别名,支持 @/components、@/lib、@/context、@/hooks 等导入 `apps/mobile/babel.config.js`
- [ ] T030 [P] 配置前端 package.json,添加 Expo 依赖及标准脚本 `apps/mobile/package.json`
- [ ] T031 [P] 配置根目录环境变量(.env),添加 SESSION_SECRET、DB_PATH、EXPO_PUBLIC_API_URL 等 `.env`
- [ ] T032 [P] 配置根目录 workspace,管理 apps/server 和 apps/mobile 子包 `package.json`

---

## 依赖说明

- **阶段一** 必须全部完成,方可开始任何用户故事
- **标记 [P]** 的任务:操作不同文件、无互相依赖,可并行执行
- **未标记 [P]** 的任务:依赖上一个任务的输出,须顺序执行
- **阶段二至阶段五** 之间可并行(由不同开发者同时进行)
- **阶段六** 需在阶段二和阶段三完成后执行(集成前后端模块)
