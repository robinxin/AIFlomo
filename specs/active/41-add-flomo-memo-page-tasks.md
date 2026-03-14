# 任务清单: Flomo 笔记主页面

**来源 Spec**: specs/active/41-add-flomo-memo-page.md
**技术方案**: specs/active/41-add-flomo-memo-page-design.md

---

## 阶段一: 基础准备（数据库 & 公共模块）

> 所有用户故事共同依赖的底层准备，必须在所有故事前完成。

- [ ] T001 [P] 扩展 Drizzle Schema，新增 `memos`、`tags`、`memo_tags`、`attachments` 四张表（含外键、布尔字段、唯一索引），执行 `pnpm db:generate` 和 `pnpm db:migrate` 生成并应用迁移 `apps/server/src/db/schema.js`
- [ ] T002 [P] 在 `apps/server/src/lib/errors.js` 新增 `NotFoundError`（404）和 `ForbiddenError`（403）错误类；在 `apps/mobile/lib/api-client.js` 新增 `upload(path, formData)` 方法支持 multipart 上传；在 `apps/server/package.json` 添加 `@fastify/multipart` 和 `@fastify/static` 依赖

---

## 阶段二: 用户故事 1 — 新建笔记（优先级: P1）

**目标**: 用户能在主页面创建笔记，标签自动解析存储，笔记即时出现在列表顶部

- [ ] T003 [P] 实现笔记路由，按静态优先顺序注册 `GET /stats`、`GET /heatmap`、`GET /trash`、`GET /`（列表，含 tag/type/keyword/分页筛选）、`POST /`（创建，含 `#` 标签解析和 hasLink 检测）、`DELETE /:id`（软删除，校验归属权） `apps/server/src/routes/memos.js`
- [ ] T004 [P] 实现标签路由 `GET /api/tags`（LEFT JOIN memo_tags 聚合 memoCount，过滤已删除笔记）`apps/server/src/routes/tags.js`；实现图片上传路由 `POST /api/attachments/upload`（MIME 白名单 + 5MB 校验，uuid 文件名写入 uploads/ 目录，INSERT attachments，有 memoId 时更新 memos.has_image）`apps/server/src/routes/attachments.js`
- [ ] T005 在 `apps/server/src/index.js` 注册 memos（前缀 `/api/memos`）、tags（前缀 `/api/tags`）、attachments（前缀 `/api/attachments`）路由插件，注册 `@fastify/static` 插件服务 `uploads/` 目录，启动时自动创建 `uploads/` 目录

---

## 阶段三: 用户故事 2 — 查看列表与筛选（优先级: P1）

**目标**: 用户能按时间倒序查看所有笔记，通过类型筛选器和标签过滤列表

- [ ] T006 新增 `apps/mobile/context/MemoContext.jsx`，定义完整 `initialState`（memos、allMemos、tags、stats、heatmap、activeFilter、keyword、page、hasMore、isLoading、isSubmitting、error）、`memoReducer`（实现全部 11 个 action type，不可变更新）和 `MemoProvider` 组件
- [ ] T007 新增 `apps/mobile/hooks/use-memos.js`，封装 MemoContext，实现 `fetchMemos`（分页加载 + 重置）、`loadMore`（追加下一页）、`createMemo`（POST /api/memos + 乐观更新列表顶部）、`deleteMemo`（DELETE /api/memos/:id + 移除列表项）、`fetchTags`、`fetchStats`、`fetchHeatmap`、`setFilter`（重置列表并重新加载）、`setKeyword`（前端实时过滤 allMemos）

---

## 阶段四: 用户故事 3 — 搜索（优先级: P2）

**目标**: 用户输入关键字时前端实时过滤 allMemos，无匹配时显示空状态提示

- [ ] T008 [P] 实现展示型组件：`apps/mobile/components/MemoCard.jsx`（标签高亮 #4caf50、长按删除确认）、`apps/mobile/components/MemoList.jsx`（FlatList + 骨架屏 + 空状态 + 错误重试 + onEndReached 分页）、`apps/mobile/components/StatsBar.jsx`（昵称 + 三项统计 + 登出按钮）、`apps/mobile/components/HeatmapCalendar.jsx`（近90天格子，颜色 #e8f5e9→#1b5e20 映射 0→≥5 条）
- [ ] T009 [P] 实现交互型组件：`apps/mobile/components/SearchBar.jsx`（受控输入 + 清空）、`apps/mobile/components/ProModal.jsx`（遮罩浮窗 + 关闭，无支付逻辑）、`apps/mobile/components/SideNav.jsx`（三种筛选器高亮切换 + 标签列表超5条折叠 + Pro 入口弹出 ProModal + 回收站角标 trashCount）、`apps/mobile/components/MemoInput.jsx`（单行展开 + `#` 标签联想 + 图片上传 + 空内容发送置灰用 `!!content`）

---

## 阶段五: 用户故事 4 — 账号信息与集成（优先级: P2）

**目标**: 主页面完整组装所有组件，回收站展示已删除笔记，登出清除 Session 跳转登录页

- [ ] T010 完整实现 `apps/mobile/app/memo.jsx`（SideNav 左侧 + 右侧垂直排列 StatsBar/SearchBar/MemoInput/HeatmapCalendar/MemoList，挂载时并行调用 fetchMemos/fetchTags/fetchStats/fetchHeatmap）；新增 `apps/mobile/app/trash.jsx`（GET /api/memos/trash，FlatList + 分页 + 空状态）；更新 `apps/mobile/app/_layout.jsx` 在 `AuthProvider` 内侧包裹 `MemoProvider`

---

## 依赖说明

- **T001、T002** 标记 [P]：操作不同文件，可并行执行；后续所有任务依赖两者全部完成
- **T003、T004** 标记 [P]：操作不同路由文件，可并行执行；均依赖 T001、T002
- **T005** 依赖 T003 和 T004（注册时需导入已实现的路由模块）
- **T006** 依赖 T005（Context 中 API 调用路径以注册后的路由为准）
- **T007** 依赖 T006（Hook 依赖 Context dispatch 和 state）
- **T008、T009** 标记 [P]：操作不同组件文件，可并行执行；均依赖 T007
- **T010** 依赖 T008 和 T009（页面需导入所有子组件）
