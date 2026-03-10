# 任务清单：Flomo 笔记页面实现

**关联 Spec**: specs/active/41-add-flomo-memo-page.md
**关联设计文档**: specs/active/41-add-flomo-memo-page-design.md
**生成日期**: 2026-03-10
**Feature Branch**: feat/41-flomo-memo-page

---

## 阶段 1：基础架构与数据模型（后端）

### 数据库 Schema 与迁移

- [ ] T001 创建 Drizzle Schema 文件 `apps/server/src/db/schema.js`，定义 6 张表（users、memos、tags、memo_tags、memo_attachments、sessions）
- [ ] T002 在 schema 中实现 users 表，包含 id、email、nickname、passwordHash、createdAt 字段
- [ ] T003 在 schema 中实现 memos 表，包含软删除字段 deletedAt 和类型标志位 hasImage/hasLink
- [ ] T004 在 schema 中实现 tags 表，并创建 (name, userId) 联合唯一索引
- [ ] T005 在 schema 中实现 memo_tags 多对多关联表，设置级联删除
- [ ] T006 在 schema 中实现 memo_attachments 表，支持 type='image'|'link'
- [ ] T007 在 schema 中声明 sessions 表（供 @fastify/session 使用）
- [ ] T008 创建 Drizzle 实例导出文件 `apps/server/src/db/index.js`
- [ ] T009 配置 `drizzle.config.js`，设置迁移文件路径和数据库连接
- [ ] T010 执行 `pnpm db:generate` 生成首次迁移文件
- [ ] T011 执行 `pnpm db:migrate` 应用迁移，创建数据库表结构

### 后端插件与中间件

- [ ] T012 创建 Session 插件 `apps/server/src/plugins/session.js`，配置 SQLite session store 和 Cookie 安全选项
- [ ] T013 创建 CORS 插件 `apps/server/src/plugins/cors.js`，设置白名单域名和 credentials
- [ ] T014 创建认证中间件 `apps/server/src/plugins/auth.js`，实现 requireAuth preHandler
- [ ] T015 创建错误类文件 `apps/server/src/lib/errors.js`，定义 AppError、NotFoundError、ForbiddenError
- [ ] T016 创建密码工具文件 `apps/server/src/lib/password.js`，封装 bcrypt 哈希和校验函数

---

## 阶段 2：认证功能（后端 + 前端）

### 后端认证路由

- [ ] T017 创建认证路由文件 `apps/server/src/routes/auth.js`
- [ ] T018 实现 POST `/api/auth/register` 端点，包含 email、password、nickname 校验
- [ ] T019 实现 POST `/api/auth/login` 端点，验证密码并创建 Session
- [ ] T020 实现 POST `/api/auth/logout` 端点，清除 Session
- [ ] T021 实现 GET `/api/auth/me` 端点，返回当前登录用户信息（需认证）

### 前端认证模块

- [ ] T022 创建 API Client 工具 `apps/mobile/lib/api-client.js`，封装 fetch 并配置 credentials
- [ ] T023 创建 AuthContext `apps/mobile/context/AuthContext.jsx`，定义 initialState 和 4 个 action types
- [ ] T024 创建 useAuth Hook `apps/mobile/hooks/use-auth.js`，封装 login/logout/register/checkSession
- [ ] T025 创建 AuthForm 组件 `apps/mobile/components/AuthForm.jsx`，复用于登录和注册
- [ ] T026 创建认证路由布局 `apps/mobile/app/(auth)/_layout.jsx`（Stack 布局）
- [ ] T027 创建登录页面 `apps/mobile/app/(auth)/login.jsx`
- [ ] T028 创建注册页面 `apps/mobile/app/(auth)/register.jsx`
- [ ] T029 创建根布局 `apps/mobile/app/_layout.jsx`，挂载 AuthProvider
- [ ] T030 创建重定向入口页 `apps/mobile/app/index.jsx`（已登录→/memo，未登录→/login）

---

## 阶段 3：笔记核心功能（后端 CRUD）

### 笔记路由端点

- [ ] T031 创建笔记路由文件 `apps/server/src/routes/memos.js`
- [ ] T032 实现 GET `/api/memos` 端点，支持筛选（type、tagId）、搜索（q）、分页（page、limit）参数
- [ ] T033 在 GET `/api/memos` 中实现标签和附件的关联查询，避免 N+1 问题
- [ ] T034 实现 POST `/api/memos` 端点，支持创建笔记并解析 #标签名
- [ ] T035 在 POST `/api/memos` 中实现标签自动创建逻辑（同名标签复用而非新建）
- [ ] T036 在 POST `/api/memos` 中实现附件处理，同步更新 hasImage/hasLink 标志位
- [ ] T037 实现标签数量校验（≤10 个），超过时抛出 TOO_MANY_TAGS 错误
- [ ] T038 实现 PUT `/api/memos/:id` 端点，支持编辑笔记内容、标签和附件
- [ ] T039 在 PUT 端点中实现笔记所有权校验（memo.userId === session.userId）
- [ ] T040 实现 DELETE `/api/memos/:id` 端点，执行软删除（设置 deletedAt）
- [ ] T041 实现 GET `/api/memos/trash` 端点，返回回收站笔记列表
- [ ] T042 实现 POST `/api/memos/:id/restore` 端点，将 deletedAt 置为 NULL
- [ ] T043 实现 DELETE `/api/memos/:id/permanent` 端点，执行物理删除

### 标签与统计路由

- [ ] T044 创建标签路由文件 `apps/server/src/routes/tags.js`
- [ ] T045 实现 GET `/api/tags` 端点，返回标签列表并附带每个标签的笔记数量（GROUP BY）
- [ ] T046 创建统计路由文件 `apps/server/src/routes/stats.js`
- [ ] T047 实现 GET `/api/stats` 端点，返回全部笔记数、有标签笔记数、使用天数、回收站数量
- [ ] T048 在 GET `/api/stats` 中实现热力图数据查询（最近 90 天每日笔记数）

---

## 阶段 4：笔记核心功能（前端 UI）

### 前端状态管理

- [ ] T049 创建 MemoContext `apps/mobile/context/MemoContext.jsx`，定义 initialState 和 15 个 action types
- [ ] T050 创建 useMemos Hook `apps/mobile/hooks/use-memos.js`，封装笔记 CRUD 和筛选逻辑
- [ ] T051 创建 useTags Hook `apps/mobile/hooks/use-tags.js`，封装标签列表获取
- [ ] T052 创建 useStats Hook `apps/mobile/hooks/use-stats.js`，封装统计数据和热力图获取
- [ ] T053 创建 useSearch Hook `apps/mobile/hooks/use-search.js`，实现防抖搜索（300ms）
- [ ] T054 创建 useTrash Hook `apps/mobile/hooks/use-trash.js`，封装回收站操作
- [ ] T055 在根布局 `app/_layout.jsx` 中挂载 MemoProvider

### 笔记主页组件

- [ ] T056 创建笔记输入组件 `apps/mobile/components/MemoInput.jsx`，支持文本、标签、图片、链接
- [ ] T057 在 MemoInput 中实现输入长度校验（≤10,000 字符）和标签数量校验（≤10 个）
- [ ] T058 在 MemoInput 中实现图片选择功能（expo-image-picker），校验文件大小≤5MB
- [ ] T059 创建附件预览组件 `apps/mobile/components/AttachmentPreview.jsx`，显示缩略图和删除按钮
- [ ] T060 创建笔记卡片组件 `apps/mobile/components/MemoCard.jsx`，显示内容、标签、操作菜单
- [ ] T061 创建笔记列表组件 `apps/mobile/components/MemoList.jsx`，使用 FlatList 渲染
- [ ] T062 创建侧边筛选组件 `apps/mobile/components/SidebarFilter.jsx`，包含类型筛选和标签树
- [ ] T063 创建标签树组件 `apps/mobile/components/TagList.jsx`，显示标签及笔记数量
- [ ] T064 创建统计信息条组件 `apps/mobile/components/StatsBar.jsx`，显示昵称、总数、使用天数
- [ ] T065 创建热力图组件 `apps/mobile/components/Heatmap.jsx`，渲染最近 90 天笔记分布网格
- [ ] T066 创建空状态组件 `apps/mobile/components/EmptyState.jsx`，用于无笔记时的占位提示
- [ ] T067 创建确认对话框组件 `apps/mobile/components/ConfirmDialog.jsx`，用于删除确认
- [ ] T068 创建主应用布局 `apps/mobile/app/(app)/_layout.jsx`（Tabs：记录/搜索/我的）
- [ ] T069 创建笔记主页 `apps/mobile/app/(app)/memo/index.jsx`，集成以上所有组件

---

## 阶段 5：搜索与回收站功能（P2）

### 搜索页面

- [ ] T070 创建搜索输入组件 `apps/mobile/components/SearchBar.jsx`，实现防抖输入（300ms）
- [ ] T071 创建搜索结果页 `apps/mobile/app/(app)/memo/search.jsx`，显示匹配笔记列表
- [ ] T072 在搜索结果页中实现关键词高亮显示功能
- [ ] T073 在搜索结果页中实现「未找到相关笔记」空状态提示

### 回收站页面

- [ ] T074 创建回收站卡片组件 `apps/mobile/components/TrashMemoCard.jsx`，包含恢复和永久删除按钮
- [ ] T075 创建回收站页面 `apps/mobile/app/(app)/memo/trash.jsx`，显示已删除笔记列表
- [ ] T076 在回收站页面中实现恢复笔记功能（二次确认）
- [ ] T077 在回收站页面中实现永久删除功能（二次确认）
- [ ] T078 在回收站页面中实现「回收站为空」空状态提示

---

## 阶段 6：Pro 功能引导（P3）

- [ ] T079 创建 Pro 购买引导浮窗组件 `apps/mobile/components/ProUpgradeModal.jsx`
- [ ] T080 在浮窗中实现「立即购买」按钮跳转到占位页面逻辑
- [ ] T081 在笔记主页中添加微信输入、每日回顾、AI 洞察、随机漫步功能入口（仅 UI，点击弹出浮窗）

---

## 阶段 7：后端服务集成与测试

### Fastify 应用入口

- [ ] T082 创建 Fastify 应用入口 `apps/server/src/index.js`，注册所有插件和路由
- [ ] T083 在入口文件中配置全局错误处理器，返回统一格式的错误响应
- [ ] T084 在入口文件中配置日志插件（可选，生产环境需要）
- [ ] T085 配置 package.json 的 dev/build/lint/prod 脚本，确保符合 CLAUDE.md 规范

### 后端单元测试

- [ ] T086 创建 Jest 配置文件 `apps/server/jest.config.js`
- [ ] T087 编写 `/api/auth` 路由单元测试（注册、登录、登出、获取当前用户）
- [ ] T088 编写 `/api/memos` 路由单元测试（创建、列表、筛选、搜索、软删除）
- [ ] T089 编写 `/api/memos/trash` 路由单元测试（回收站列表、恢复、永久删除）
- [ ] T090 编写 `/api/tags` 路由单元测试（标签列表及计数）
- [ ] T091 编写 `/api/stats` 路由单元测试（统计数据和热力图）
- [ ] T092 确保后端单元测试覆盖率达到 80% 以上

---

## 阶段 8：前端单元测试与 E2E 测试

### 前端单元测试

- [ ] T093 创建 Vitest 配置文件 `apps/mobile/vitest.config.js`
- [ ] T094 编写 AuthContext 和 useAuth Hook 的单元测试
- [ ] T095 编写 MemoContext 和 useMemos Hook 的单元测试
- [ ] T096 编写 MemoInput 组件的单元测试（输入校验、标签解析、附件处理）
- [ ] T097 编写 MemoCard 和 MemoList 组件的单元测试
- [ ] T098 编写 SidebarFilter 和 TagList 组件的单元测试
- [ ] T099 编写 Heatmap 和 StatsBar 组件的单元测试
- [ ] T100 确保前端单元测试覆盖率达到 80% 以上

### E2E 测试

- [ ] T101 创建 Playwright 配置文件 `playwright.config.js`，配置测试服务器 URL
- [ ] T102 编写用户故事 1 的 E2E 测试（快速浏览和筛选笔记）
- [ ] T103 编写用户故事 2 的 E2E 测试（创建和编辑笔记）
- [ ] T104 编写用户故事 3 的 E2E 测试（搜索笔记）
- [ ] T105 编写用户故事 4 的 E2E 测试（管理删除的笔记）
- [ ] T106 编写用户故事 5 的 E2E 测试（查看笔记热力图和统计）
- [ ] T107 编写用户故事 6 的 E2E 测试（Pro 功能引导）
- [ ] T108 编写边界场景测试（回收站清空、搜索结果分页、标签数量限制、图片大小校验）

---

## 阶段 9：CI 脚本与部署配置

### CI 脚本

- [ ] T109 更新 `scripts/ci/install.sh`，确保支持前后端依赖安装
- [ ] T110 更新 `scripts/ci/lint.sh`，确保检测前后端代码风格
- [ ] T111 更新 `scripts/ci/build.sh`，确保前后端生产构建成功
- [ ] T112 更新 `scripts/ci/test.sh`，确保执行 E2E 测试
- [ ] T113 更新 `scripts/ci/db-reset.sh`，实现 SQLite 数据库清空（幂等）
- [ ] T114 更新 `scripts/ci/db-setup.sh`，实现 Drizzle schema 生成
- [ ] T115 更新 `scripts/ci/db-migrate.sh`，实现数据库迁移执行
- [ ] T116 更新 `scripts/ci/server-start.sh`，启动后端开发服务器
- [ ] T117 更新 `scripts/ci/server-url.sh`，输出后端健康检查 URL
- [ ] T118 更新 `scripts/ci/fullstack-start.sh`，同时启动前后端服务
- [ ] T119 更新 `scripts/ci/frontend-url.sh`，输出前端健康检查 URL

---

## 阶段 10：文档与验收

### 文档更新

- [ ] T123 更新根目录 README.md，补充项目功能说明和启动指南
- [ ] T124 更新 CLAUDE.md，确保所有新增命令和脚本已记录
- [ ] T125 创建或更新 `docs/api-reference.md`，记录所有 API 端点的请求/响应格式

### 功能验收

- [ ] T126 在本地环境运行完整流程测试（注册 → 登录 → 创建笔记 → 筛选 → 搜索 → 回收站 → 统计）
- [ ] T127 验证所有成功标准（SC-001 至 SC-008）
- [ ] T128 验证所有边界场景（回收站清空、搜索分页、标签数量限制、图片大小校验）
- [ ] T129 在 Chrome、Firefox、Safari 三种浏览器中执行 E2E 测试，确保通过
---

## 阶段 11：优化与收尾

### 性能优化

- [ ] T131 优化 GET `/api/memos` 的 N+1 查询问题（使用 Drizzle 关联查询或 JOIN）
- [ ] T132 为 `memos.created_at` 和 `memos.user_id` 创建数据库索引，提升查询性能
- [ ] T133 优化热力图查询，确保在 2 秒内完成渲染（SC-005）

### 代码质量

- [ ] T134 运行 `pnpm lint` 确保前后端代码无风格错误
- [ ] T135 运行 `pnpm build` 确保前后端生产构建成功
- [ ] T136 确保所有代码符合 `docs/code-standards-frontend.md` 和 `docs/code-standards-backend.md` 规范

---

## 依赖关系说明

- **T001-T011** 必须先于所有后端路由开发完成
- **T012-T016** 必须先于后端路由开发完成
- **T017-T021** 是认证功能的基础，必须先于笔记功能完成
- **T022-T030** 是前端认证的基础，必须先于前端笔记页面完成
- **T031-T048** 是后端笔记功能的核心，必须先于前端笔记 UI 完成
- **T049-T069** 是前端笔记 UI 的核心，依赖后端 API 完成
- **T070-T078** 是 P2 功能，可在 P1 稳定后进行
- **T079-T081** 是 P3 功能，可在 P1/P2 稳定后进行
- **T082-T092** 是后端测试，应与后端开发并行进行
- **T093-T108** 是前端测试，应与前端开发并行进行
- **T109-T122** 是 CI 配置，可在开发中期开始准备
- **T123-T130** 是验收阶段，需在所有开发和测试完成后进行
- **T131-T140** 是收尾阶段，需在验收通过后进行

---

## 风险提示

1. **Session Store 兼容性**: 需确认 Fastify 与 SQLite session store 的兼容性，推荐使用 `better-sqlite3-session-store`
2. **图片上传功能**: 当前设计中图片上传仅记录 URL 占位，实际上传逻辑需后续补充
3. **热力图性能**: 若用户笔记数超过 10,000 条，热力图查询可能变慢，需考虑缓存或限制查询范围
4. **全文搜索性能**: SQLite `LIKE` 查询无索引，当笔记数超过 10,000 条时考虑使用 FTS5 全文索引
5. **回收站自动清理**: 当前未实现定时任务，需后续通过 cron job 或定期脚本补充
