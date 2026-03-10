# 任务清单：Flomo 笔记页面

**关联 Spec**: specs/active/41-add-flomo-memo-page.md
**关联设计文档**: specs/active/41-add-flomo-memo-page-design.md
**生成日期**: 2026-03-10

---

## 阶段 1：数据库 Schema

- [ ] T001 [DB] 在 `apps/server/src/db/schema.js` 中定义 `users` 表（含 id/email/nickname/passwordHash/createdAt）
- [ ] T002 [DB] 在 `apps/server/src/db/schema.js` 中定义 `memos` 表（含 id/content/userId/hasImage/hasLink/deletedAt/createdAt/updatedAt）
- [ ] T003 [DB] 在 `apps/server/src/db/schema.js` 中定义 `tags` 表（含 id/name/userId/createdAt，并配置 uniqueIndex(name, userId)）
- [ ] T004 [DB] 在 `apps/server/src/db/schema.js` 中定义 `memo_tags` 关联表（含 memoId/tagId，配置级联删除）
- [ ] T005 [DB] 在 `apps/server/src/db/schema.js` 中定义 `memo_attachments` 表（含 id/memoId/type/url/createdAt）
- [ ] T006 [DB] 在 `apps/server/src/db/schema.js` 中定义 `sessions` 表（含 sid/sess/expired）
- [ ] T007 [DB] 创建 `apps/server/src/db/index.js` 并导出 Drizzle 数据库实例
- [ ] T008 [DB] 配置 `apps/server/drizzle.config.js` 文件（指定 schema 路径和迁移目录）
- [ ] T009 [DB] 执行 `pnpm db:generate` 生成迁移文件
- [ ] T010 [DB] 执行 `pnpm db:migrate` 应用数据库迁移

## 阶段 2：服务层

- [ ] T011 [Service] 创建 `apps/server/src/lib/errors.js` 定义自定义错误类（AppError/NotFoundError/ForbiddenError）
- [ ] T012 [Service] 创建 `apps/server/src/lib/password.js` 实现 bcrypt 密码哈希和验证工具函数
- [ ] T013 [Service] 创建 `apps/server/src/plugins/session.js` 配置 @fastify/session 和 SQLite session store
- [ ] T014 [Service] 创建 `apps/server/src/plugins/cors.js` 配置 @fastify/cors 白名单
- [ ] T015 [Service] 创建 `apps/server/src/plugins/auth.js` 实现 `requireAuth` preHandler 中间件

## 阶段 3：API 路由

- [ ] T016 [API] 创建 `apps/server/src/routes/auth.js` 并实现 `POST /api/auth/register` 端点（注册用户）
- [ ] T017 [API] 在 `apps/server/src/routes/auth.js` 中实现 `POST /api/auth/login` 端点（用户登录）
- [ ] T018 [API] 在 `apps/server/src/routes/auth.js` 中实现 `POST /api/auth/logout` 端点（用户登出）
- [ ] T019 [API] 在 `apps/server/src/routes/auth.js` 中实现 `GET /api/auth/me` 端点（获取当前用户信息）
- [ ] T020 [API] 创建 `apps/server/src/routes/memos.js` 并实现 `GET /api/memos` 端点（获取笔记列表，支持筛选、搜索、分页）
- [ ] T021 [API] 在 `apps/server/src/routes/memos.js` 中实现 `POST /api/memos` 端点（创建笔记，含标签解析和附件处理）
- [ ] T022 [API] 在 `apps/server/src/routes/memos.js` 中实现 `PUT /api/memos/:id` 端点（更新笔记）
- [ ] T023 [API] 在 `apps/server/src/routes/memos.js` 中实现 `DELETE /api/memos/:id` 端点（软删除笔记到回收站）
- [ ] T024 [API] 在 `apps/server/src/routes/memos.js` 中实现 `GET /api/memos/trash` 端点（获取回收站列表）
- [ ] T025 [API] 在 `apps/server/src/routes/memos.js` 中实现 `POST /api/memos/:id/restore` 端点（从回收站恢复笔记）
- [ ] T026 [API] 在 `apps/server/src/routes/memos.js` 中实现 `DELETE /api/memos/:id/permanent` 端点（永久删除笔记）
- [ ] T027 [API] 创建 `apps/server/src/routes/tags.js` 并实现 `GET /api/tags` 端点（获取标签列表，含笔记计数）
- [ ] T028 [API] 创建 `apps/server/src/routes/stats.js` 并实现 `GET /api/stats` 端点（获取统计数据和热力图）
- [ ] T029 [API] 在 `apps/server/src/index.js` 中注册所有插件（session/cors/auth）
- [ ] T030 [API] 在 `apps/server/src/index.js` 中注册所有路由（auth/memos/tags/stats）

## 阶段 4：页面

- [ ] T031 [Page] 创建 `apps/mobile/app/_layout.jsx` 根布局（挂载 AuthProvider 和 MemoProvider）
- [ ] T032 [Page] 创建 `apps/mobile/app/index.jsx` 重定向入口（已登录 → /memo，未登录 → /login）
- [ ] T033 [Page] 创建 `apps/mobile/app/(auth)/_layout.jsx` 认证组布局（Stack 导航）
- [ ] T034 [Page] 创建 `apps/mobile/app/(auth)/login.jsx` 登录页
- [ ] T035 [Page] 创建 `apps/mobile/app/(auth)/register.jsx` 注册页
- [ ] T036 [Page] 创建 `apps/mobile/app/(app)/_layout.jsx` 主应用 Tabs 布局（记录/搜索/我的）
- [ ] T037 [Page] 创建 `apps/mobile/app/(app)/memo/index.jsx` 笔记主页（列表 + 侧边筛选 + 输入框）
- [ ] T038 [Page] 创建 `apps/mobile/app/(app)/memo/search.jsx` 全文搜索结果页
- [ ] T039 [Page] 创建 `apps/mobile/app/(app)/memo/trash.jsx` 回收站页

## 阶段 5：组件

- [ ] T040 [Component] 创建 `apps/mobile/lib/api-client.js` 封装 API 请求函数（fetch + credentials）
- [ ] T041 [Component] 创建 `apps/mobile/context/AuthContext.jsx` 认证 Context（含 4 个 action types）
- [ ] T042 [Component] 创建 `apps/mobile/context/MemoContext.jsx` 笔记 Context（含 15 个 action types）
- [ ] T043 [Component] 创建 `apps/mobile/hooks/use-auth.js` 封装认证操作（login/logout/register/checkSession）
- [ ] T044 [Component] 创建 `apps/mobile/hooks/use-memos.js` 封装笔记 CRUD 和筛选逻辑
- [ ] T045 [Component] 创建 `apps/mobile/hooks/use-tags.js` 封装标签列表获取逻辑
- [ ] T046 [Component] 创建 `apps/mobile/hooks/use-stats.js` 封装统计数据和热力图获取逻辑
- [ ] T047 [Component] 创建 `apps/mobile/hooks/use-search.js` 封装搜索功能（防抖 300ms）
- [ ] T048 [Component] 创建 `apps/mobile/hooks/use-trash.js` 封装回收站操作逻辑
- [ ] T049 [Component] 创建 `apps/mobile/components/AuthForm.jsx` 登录/注册表单通用组件
- [ ] T050 [Component] 创建 `apps/mobile/components/MemoInput.jsx` 常驻顶部笔记输入区组件
- [ ] T051 [Component] 创建 `apps/mobile/components/AttachmentPreview.jsx` 附件预览行组件（缩略图 + 删除）
- [ ] T052 [Component] 创建 `apps/mobile/components/MemoList.jsx` 笔记列表渲染组件（FlatList）
- [ ] T053 [Component] 创建 `apps/mobile/components/MemoCard.jsx` 单条笔记卡片组件（内容 + 标签 + 操作菜单）
- [ ] T054 [Component] 创建 `apps/mobile/components/TrashMemoCard.jsx` 回收站笔记卡片组件（恢复/永久删除）
- [ ] T055 [Component] 创建 `apps/mobile/components/SidebarFilter.jsx` 左侧筛选面板组件（类型 + 标签树）
- [ ] T056 [Component] 创建 `apps/mobile/components/TagList.jsx` 标签树列表组件
- [ ] T057 [Component] 创建 `apps/mobile/components/StatsBar.jsx` 用户统计信息条组件
- [ ] T058 [Component] 创建 `apps/mobile/components/Heatmap.jsx` 热力图网格组件（最近 90 天）
- [ ] T059 [Component] 创建 `apps/mobile/components/SearchBar.jsx` 搜索输入框组件（防抖 300ms）
- [ ] T060 [Component] 创建 `apps/mobile/components/EmptyState.jsx` 空状态占位组件
- [ ] T061 [Component] 创建 `apps/mobile/components/ConfirmDialog.jsx` 确认对话框组件
- [ ] T062 [Component] 创建 `apps/mobile/components/ProUpgradeModal.jsx` Pro 会员购买引导浮窗组件
