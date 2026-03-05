# 任务清单: 账号注册与登录

**来源 Spec**: `specs/active/25-feature-user-registration-login.md`
**技术方案**: `specs/active/25-feature-user-registration-login-design.md`

---

## 阶段一: 基础准备（数据库 & 公共模块）

> 所有用户故事共同依赖的底层准备，必须在所有故事前完成。

- [ ] T001 [P] 扩展 Drizzle Schema，新增 users 表定义 `apps/server/src/db/schema.js`
- [ ] T002 [P] 创建密码工具函数，封装 bcrypt 哈希和验证逻辑 `apps/server/src/lib/password.js`
- [ ] T003 [P] 实现 Fastify session 插件配置，集成 SQLite session store `apps/server/src/plugins/session.js`
- [ ] T004 创建 requireAuth preHandler，用于保护需登录的路由 `apps/server/src/plugins/auth.js`

---

## 阶段二: 用户故事 1 - 邮箱密码登录（优先级: P1）

**目标**: 用户可通过邮箱和密码登录，验证成功后创建 Session 并跳转到主应用

- [ ] T005 [P] 实现 POST /api/auth/login 路由，包含 JSON Schema 验证、bcrypt 密码验证、Session 创建、lastLoginAt 更新 `apps/server/src/routes/auth.js`
- [ ] T006 [P] 实现 POST /api/auth/logout 路由，销毁 Session 并返回 204 `apps/server/src/routes/auth.js`
- [ ] T007 [P] 实现 GET /api/auth/me 路由，返回当前登录用户信息 `apps/server/src/routes/auth.js`
- [ ] T008 创建 AuthContext，使用 useReducer 管理登录状态（user、isAuthenticated、isLoading） `apps/mobile/context/AuthContext.jsx`
- [ ] T009 创建 useCheckAuth Hook，应用启动时调用 GET /api/auth/me 检测登录状态 `apps/mobile/hooks/use-check-auth.js`
- [ ] T010 创建登录页面，包含邮箱密码输入框、前端校验、调用登录 API、跳转逻辑 `apps/mobile/app/(auth)/login.jsx`
- [ ] T011 创建认证路由组布局，使用 Stack 模式（无 Tab 导航） `apps/mobile/app/(auth)/_layout.jsx`
- [ ] T012 修改根布局，集成 AuthProvider、调用 useCheckAuth、根据登录状态控制路由重定向 `apps/mobile/app/_layout.jsx`

---

## 阶段三: 用户故事 2 - 新用户注册（优先级: P2）

**目标**: 新用户可注册账号并自动登录进入主应用

- [ ] T013 实现 POST /api/auth/register 路由，包含 JSON Schema 验证、邮箱唯一性校验、密码哈希、自动登录 `apps/server/src/routes/auth.js`
- [ ] T014 创建注册页面，包含邮箱昵称密码输入框、隐私协议勾选框、前端校验、调用注册 API `apps/mobile/app/(auth)/register.jsx`

---

## 阶段四: 用户故事 3 - 页面间跳转（优先级: P3）

**目标**: 用户可在登录页和注册页之间自由切换

- [ ] T015 在登录页添加"立即注册"链接，跳转到 /register `apps/mobile/app/(auth)/login.jsx`
- [ ] T016 在注册页添加"返回登录"链接，跳转到 /login `apps/mobile/app/(auth)/register.jsx`

---

## 阶段五: 集成与配置

**目标**: 完成后端插件注册、环境变量配置、数据库迁移

- [ ] T017 在 Fastify 主文件中注册 sessionPlugin 和 authRoutes，确保正确加载顺序 `apps/server/src/index.js`
- [ ] T018 修改 API Client，确保所有请求携带 credentials: 'include' 以传递 Session Cookie `apps/mobile/lib/api-client.js`
- [ ] T019 [P] 执行数据库迁移命令生成 users 表 `npm run db:generate && npm run db:migrate`
- [ ] T020 [P] 在 .env 中添加 SESSION_SECRET 环境变量（32+ 字符随机字符串）

---

## 依赖说明

- **阶段一** 必须全部完成，方可开始阶段二和阶段三
- **标记 [P]** 的任务：操作不同文件、无互相依赖，可并行执行
- **未标记 [P]** 的任务：依赖上一个任务的输出或同一文件的前序任务，须顺序执行
- 阶段二（登录）和阶段三（注册）可并行开发（不同开发者同时进行）
- 阶段四（页面跳转）依赖阶段二和阶段三的页面文件已创建
- 阶段五（集成）依赖所有前序阶段完成，作为最终验证步骤
