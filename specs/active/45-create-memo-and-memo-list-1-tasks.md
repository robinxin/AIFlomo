# 任务清单: 创建笔记与笔记列表(第一版)

**来源 Spec**: `specs/active/45-create-memo-and-memo-list-1.md`
**技术方案**: `specs/active/45-create-memo-and-memo-list-1-design.md`
**生成日期**: 2026-03-12
**状态**: 待执行

---

## 阶段一: 基础准备（Monorepo 根目录 & 后端包结构）

> 从零搭建 apps/server 和 apps/mobile 子包骨架，配置 Monorepo workspace，建立数据库 Schema 并生成迁移产物。所有后续阶段均依赖本阶段完成。

- [x] T001 [P] 初始化 Monorepo 根配置及 apps/server 子包骨架：更新 `pnpm-workspace.yaml`（新增 apps/server、apps/mobile）、根目录 `package.json`（含 dev/build/lint 脚本）、`.env`（新增 DB_PATH、SESSION_SECRET、CORS_ORIGIN、EXPO_PUBLIC_API_URL 四个变量）；创建 `apps/server/package.json`（含 dev/build/lint/prod/db:generate/db:migrate 六条脚本，依赖 fastify、drizzle-orm、better-sqlite3、@fastify/session、@fastify/cookie、@fastify/cors、@fastify/multipart）及 `apps/server/drizzle.config.js`（Drizzle Kit 配置，指向 DB_PATH SQLite 文件）

- [x] T002 定义 Drizzle Schema 并初始化数据库实例：按 design §2 在 `apps/server/src/db/schema.js` 中完整实现 users、memos、tags、memo_tags、memo_images 五张表（含外键 onDelete cascade、crypto.randomUUID() 主键、`sql\`(CURRENT_TIMESTAMP)\`` 时间戳）；在 `apps/server/src/db/index.js` 中导出 Drizzle 实例（better-sqlite3 驱动，读取 DB_PATH 环境变量）；执行 `pnpm db:generate -w apps/server` 生成迁移文件

---

## 阶段二: 用户故事 1 - 快速创建纯文本笔记（优先级: P1）

**目标**: 实现后端核心服务层——错误类、鉴权中间件、Session/CORS 插件、Memo API 路由，使 POST /api/memos 和 GET /api/memos 端点可正常工作并通过单元测试。

- [x] T003 [P] 实现后端共享基础设施（插件 & 错误类）：在 `apps/server/src/lib/errors.js` 中定义 AppError、NotFoundError、ForbiddenError 三个错误类；在 `apps/server/src/plugins/session.js` 中配置 @fastify/cookie + @fastify/session（httpOnly: true、sameSite: 'strict'、生产环境 secure: true、SQLite session store）；在 `apps/server/src/plugins/cors.js` 中配置 @fastify/cors（CORS_ORIGIN 环境变量白名单）；在 `apps/server/src/plugins/auth.js` 中实现 requireAuth preHandler（检查 request.session.userId，未登录返回 401 及统一错误格式）

- [ ] T004 实现 Memo 路由及 Fastify 应用入口：在 `apps/server/src/routes/memos.js` 中实现 POST /api/memos（创建笔记含自动创建/复用标签逻辑、memo_tags 关联写入、memo_images 元数据写入，JSON Schema 校验 content 1-10000 字符、tagNames 格式 pattern 中英文数字下划线、imageUrls maxItems 9）、GET /api/memos（分页列表，filter=all/tagged/with-images 及 tagId 参数，LEFT JOIN 聚合 tags 和 images 避免 N+1，返回 data.memos/total/page/limit）、DELETE /api/memos/:id（校验笔记归属后执行删除，cascade 自动清理关联表）；在 `apps/server/src/index.js` 中注册所有 Plugin、路由（prefix: /api）、全局 setErrorHandler

- [ ] T005 [P] 编写后端 Memo 路由单元测试：在 `apps/server/tests/memos.test.js` 中使用 Jest 覆盖 POST /api/memos（空内容 400、content 超 10000 字符 400、tagNames 格式非法 400、未登录 401、正常创建 201 含 tags 和 images 字段）、GET /api/memos（filter 枚举值校验、page/limit 默认值与边界、tagId 覆盖 filter 逻辑）、DELETE /api/memos/:id（笔记不存在 404、笔记属于他人 403、正常删除 204）；覆盖率达 80%（行/分支/函数/语句）

---

## 阶段三: 用户故事 2 & 4 - 带标签笔记 & 分类列表（优先级: P2）

**目标**: 实现 Tag API 路由（GET /api/tags 实时聚合计数、GET /api/tags/:tagId/memos 按标签筛选），使标签相关功能后端完整可用并通过单元测试。

- [ ] T006 实现 Tag 路由及单元测试：在 `apps/server/src/routes/tags.js` 中实现 GET /api/tags（COUNT + LEFT JOIN memo_tags 聚合每个标签的 memoCount，支持 sortBy=name/createdAt/memoCount，memoCount 为 0 的空标签仍返回，不自动过滤）和 GET /api/tags/:tagId/memos（验证标签存在且归属当前用户 userId，分页返回关联笔记含完整 tags/images 字段）；在 `apps/server/src/index.js` 中注册 tag 路由（prefix: /api/tags）；在 `apps/server/tests/tags.test.js` 中编写 Jest 单元测试（GET /api/tags 的 401、空列表、memoCount 聚合准确性；GET /api/tags/:tagId/memos 的 404、403、分页）；覆盖率达 80%

---

## 阶段四: 前端基础设施（优先级: P1 前置）

**目标**: 初始化 apps/mobile 包，实现 API Client 封装、全局状态管理层（MemoContext + TagContext）和三个业务 Hook，为页面和组件提供完整数据层。

- [ ] T007 [P] 初始化 apps/mobile 包及 API Client：创建 `apps/mobile/package.json`（含 dev/build/lint/prod 四条脚本，依赖 expo、expo-router、expo-image-picker、react、react-native、@expo/metro-config）；创建 `apps/mobile/babel.config.js`（Expo 预设配置）；在 `apps/mobile/lib/api-client.js` 中实现统一 fetch 封装（baseURL 读取 EXPO_PUBLIC_API_URL 环境变量、credentials: 'include'、统一解析 `{ data, message, error }` 响应格式、网络异常统一抛出含用户友好消息的 Error）

- [ ] T008 实现全局 Context/Reducer 及业务 Hooks：在 `apps/mobile/context/MemoContext.jsx` 中实现 MemoProvider 和 useMemoContext（useReducer 管理 memos/activeFilter/isLoading/isLoadingMore/isSubmitting/error/submitError/hasMore/currentPage，Reducer 不可变更新处理全部 Action Types：FETCH_MEMOS_START/SUCCESS/ERROR、LOAD_MORE_START/SUCCESS/ERROR、SET_FILTER 重置分页、ADD_MEMO 插入列表顶部、SUBMIT_START/SUCCESS/ERROR）；在 `apps/mobile/context/TagContext.jsx` 中实现 TagProvider 和 useTagContext（FETCH_TAGS_START/SUCCESS/ERROR、ADD_TAG_LOCAL）；在 `apps/mobile/hooks/use-memos.js` 中封装 fetchMemos/loadMore/setFilter/createMemo/clearSubmitError；在 `apps/mobile/hooks/use-tags.js` 封装 fetchTags；在 `apps/mobile/hooks/use-tag-memos.js` 封装 loadMore/refetch 分页逻辑（接收 tagId 参数）

---

## 阶段五: 前端核心功能（用户故事 1 & 2 & 3 & 4 & 5）

**目标**: 实现所有 UI 组件和页面，完成"输入→存储→回看"完整闭环，涵盖空状态、错误状态、字数统计、标签选择、图片选择（P3）、分类 Tab 切换、无限滚动分页等所有交互细节。

- [ ] T009 [P] 实现全部通用 UI 组件：在 `apps/mobile/components/MemoCard.jsx` 中实现笔记卡片（纯文本展示 content、tags 标签芯片列表、images 缩略图网格、createdAt 时间，使用 Text 组件避免 XSS）；在 `apps/mobile/components/EmptyState.jsx` 中实现通用空状态（接收 message、actionLabel、onAction props，覆盖三种空态文案）；在 `apps/mobile/components/ErrorState.jsx` 中实现错误状态（message + 重试按钮）；在 `apps/mobile/components/TagPicker.jsx` 中实现标签选择弹层（列表展示已有标签、新增输入框实时过滤非中英文数字下划线字符、2-20 字符长度校验、多选勾选逻辑）；在 `apps/mobile/components/ImagePickerInput.jsx` 中实现图片选择预览组件（expo-image-picker 调用、格式白名单 JPG/PNG/GIF 校验、单张 ≤5MB 校验、最多 9 张校验、缩略图 + 删除按钮）

- [ ] T010 实现 Expo Router 页面布局、全部页面及前端单元测试：在 `apps/mobile/app/_layout.jsx` 中挂载 MemoProvider 和 TagProvider；在 `apps/mobile/app/(app)/_layout.jsx` 中实现已登录区域布局；在 `apps/mobile/app/(app)/index.jsx` 中实现主界面（顶部导航栏标题"AIFlomo"+ 分类 Tab 栏"全部笔记/有标签/有图片" + FlatList 笔记列表含无限滚动 onEndReached/下拉刷新 onRefresh/EmptyState/ErrorState + 固定底部输入区含字数统计实时显示"n/10000"超限文字变红阻止输入、发布按钮空内容禁用、TagPicker 弹层、ImagePickerInput 组件、网络失败保留输入内容）；在 `apps/mobile/app/(app)/tags/index.jsx` 中实现全部标签列表页；在 `apps/mobile/app/(app)/tags/[id].jsx` 中实现特定标签笔记列表页（use-tag-memos 驱动，无限滚动、EmptyState、ErrorState）；在 `apps/mobile/tests/` 中编写 Vitest 单元测试覆盖 MemoContext reducer 各 Action、TagContext reducer、use-memos Hook 调用序列、MemoCard 组件渲染，覆盖率达 80%

---

## 依赖说明

- **阶段一（T001、T002）** 必须全部完成，方可开始任何后续阶段
- **标记 [P]** 的任务（T001、T003、T005、T007、T009）：操作不同文件、无互相依赖，可并行执行
- **T002** 依赖 T001（需要 apps/server/package.json 和 drizzle.config.js 已存在）
- **T003 和 T007** 可在 T002 完成后并行：分别操作后端插件库和前端配置，文件无重叠
- **T004** 依赖 T002（db 实例）和 T003（requireAuth、errors.js）
- **T005** 标记 [P]：可在 T004 完成后与 T006 并行
- **T006** 依赖 T004（需在同一 index.js 注册路由）
- **T008** 依赖 T007（需要 api-client.js）
- **T009** 标记 [P]：纯 UI 组件无数据层依赖，可在 T007 完成后与 T008 并行启动
- **T010** 依赖 T008（Context/Hooks）和 T009（MemoCard、EmptyState 等组件）
