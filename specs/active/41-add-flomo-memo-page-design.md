# 技术方案：Flomo 笔记页面（Issue #41）

**关联 Spec**: `specs/active/41-add-flomo-memo-page.md`
**生成日期**: 2026-03-11
**状态**: 待审核

---

## §1 功能概述

### 核心目标

打通"输入 → 存储 → 回看"全闭环：实现 Flomo 风格的笔记主页，支持快速创建笔记（含标签自动解析、图片/链接附件）、多维筛选浏览（类型筛选 + 标签树）、全文搜索、软删除与回收站、用户统计热力图、以及 Pro 功能占位引导。

### 系统定位

本次功能构成整个 MVP 的核心主路径，是用户登录后的默认落地页（路由 `/memo`）。涉及以下新增系统交互：

| 维度 | 说明 |
|------|------|
| 后端路由 | 新增 `apps/server/src/routes/memos.js`、`tags.js`、`stats.js`、`auth.js` 全量实现 |
| 数据表 | 新增 `users`、`memos`、`tags`、`memo_tags`、`attachments` 五张表（从零构建） |
| 前端路由 | 新增 `app/(app)/memo/index.jsx`（主列表）、`app/(app)/memo/trash.jsx`（回收站）、`app/(app)/memo/search.jsx`（搜索）、`app/(auth)/login.jsx`、`app/(auth)/register.jsx` |
| Context | 新增 `AuthContext.jsx`（用户会话）、`MemoContext.jsx`（笔记列表、筛选状态） |
| API client | `lib/api-client.js`（统一 fetch 封装，携带 Session Cookie） |

现有已有文件：仅 E2E 测试文件（`apps/tests/*.spec.js`）。后端 `apps/server/src/` 和前端 `apps/mobile/` 目录均为空，属于全量新建。

### 用户价值

| 问题 | 解决方案 |
|------|---------|
| 无法快速记录想法 | 主页顶部输入框，支持一键发送，`#标签名` 自动解析 |
| 笔记多了难以定位 | 左侧筛选面板（类型 + 标签树），按维度秒级过滤 |
| 误删笔记无法找回 | 软删除 + 回收站，30 天内可恢复 |
| 不清楚自己记录了多少 | 统计区（总数 / 有标签数 / 使用天数）+ 热力图直观展示 |
| 关键词找笔记慢 | 全文搜索（`LIKE` 模糊匹配），300ms 防抖，1 秒内返回 |

---

## §2 数据模型变更

本次为全量新建，无任何现有表需要修改。以下是完整 Drizzle schema，可直接写入 `apps/server/src/db/schema.js`。

### 2.1 完整 Schema 代码

```js
// apps/server/src/db/schema.js
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─────────────────────────────────────────
// users — 用户表
// ─────────────────────────────────────────
export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  nickname: text('nickname').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

// ─────────────────────────────────────────
// memos — 笔记表（含软删除字段）
// ─────────────────────────────────────────
export const memos = sqliteTable('memos', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  content: text('content').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  // 类型标志位（0 = 无，1 = 有）
  hasImage: integer('has_image').notNull().default(0),
  hasLink: integer('has_link').notNull().default(0),
  // 软删除：null 表示正常，非 null 表示已删除（进入回收站）
  deletedAt: text('deleted_at').default(null),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

// ─────────────────────────────────────────
// tags — 标签表（每个用户的标签独立）
// ─────────────────────────────────────────
export const tags = sqliteTable('tags', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

// ─────────────────────────────────────────
// memo_tags — 笔记与标签的多对多关联表
// ─────────────────────────────────────────
export const memoTags = sqliteTable('memo_tags', {
  memoId: text('memo_id')
    .notNull()
    .references(() => memos.id, { onDelete: 'cascade' }),
  tagId: text('tag_id')
    .notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
});

// ─────────────────────────────────────────
// attachments — 笔记附件表（图片文件元数据）
// ─────────────────────────────────────────
export const attachments = sqliteTable('attachments', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  memoId: text('memo_id')
    .notNull()
    .references(() => memos.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),       // 文件存储路径（服务器本地路径或 URL）
  mimeType: text('mime_type').notNull(), // image/jpeg, image/png, image/gif
  sizeBytes: integer('size_bytes').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});
```

### 2.2 字段设计说明

#### users 表

| 字段 | 类型 | 说明 |
|------|------|------|
| `nickname` | `text NOT NULL` | 新增字段（相比代码规范示例）。E2E 测试中注册接口返回 `nickname`，登录后页面显示昵称（`data-testid="user-nickname"`），`/api/auth/register` 接受 `nickname` 参数。 |

#### memos 表

| 字段 | 类型 | 说明 |
|------|------|------|
| `hasImage` | `integer DEFAULT 0` | 布尔标志位，用整型存储（SQLite 无原生 boolean）。创建笔记时若含附件则置 1。E2E 测试断言 `memo.hasImage === 1`（`/api/memos?type=image`）。 |
| `hasLink` | `integer DEFAULT 0` | 同上。后端解析 content 中的 URL（正则匹配 `https?://`）时置 1。 |
| `deletedAt` | `text DEFAULT NULL` | 软删除时间戳。`DELETE /api/memos/:id` 仅更新此字段为当前时间（不物理删除）。E2E 测试断言回收站列表中每条 memo 的 `deletedAt` 不为 null。30 天过期后可由定时任务物理清除（MVP 阶段可手动处理）。 |
| `userId` `.references(() => users.id, { onDelete: 'cascade' })` | — | 用户删除时级联删除所有笔记，防止孤儿数据。 |

#### tags 表

- `name` + `userId` 应在业务层保证唯一（创建笔记时，若标签名已存在则复用，不插入重复行）。未在 schema 层加联合唯一索引，以简化 MVP 实现；若并发量大可后续迁移添加。
- `userId` 使用 `onDelete: 'cascade'`：用户注销时标签随之清除，防止孤儿标签。

#### memo_tags 表

- `memoId` 和 `tagId` 均使用 `onDelete: 'cascade'`：
  - 笔记软删除后进入回收站，`memo_tags` 记录保留（恢复时仍能还原标签关联）。
  - 笔记永久删除（`DELETE /api/memos/:id/permanent`）时，物理删除 memo 行，`memo_tags` 由级联自动清理。
  - 若某 tag 因所有关联 memo 被永久删除而成为孤儿标签，由 `GET /api/tags` 的 count 查询过滤掉（`count = 0` 时不返回或由前端过滤），保持标签树整洁。

#### attachments 表

- 独立存储图片元数据，与 memos 一对多关联。
- `onDelete: 'cascade'`：永久删除 memo 时附件元数据自动清除（物理文件由服务层同步删除）。
- `memoId` + `sizeBytes` 分离存储：后端接收 `multipart/form-data` 上传后，将文件写入服务器本地磁盘（`data/uploads/`），将路径写入 `url` 字段，并将 `memos.hasImage` 置 1。
- MVP 阶段图片以本地文件系统存储；`url` 字段设计为字符串，后续可无缝切换为 CDN URL，不需要迁移。

### 2.3 不需要独立的 Trash 表

回收站的数据实体（Spec 中称"回收站条目"）直接通过 `memos.deletedAt IS NOT NULL` 查询实现，无需新增独立表。E2E 测试中 `GET /api/memos/trash` 返回的每条记录包含 `deletedAt` 字段，`POST /api/memos/:id/restore` 将该字段重置为 `null`。这一设计：

- 减少表数量，降低 join 复杂度
- 恢复操作简单（单字段更新，无需跨表数据迁移）
- 统计 `trashCount`（`/api/stats` 响应字段）直接通过 `count(*)` where `deletedAt IS NOT NULL` 计算

### 2.4 统计数据（User Stats）

E2E 测试期望 `GET /api/stats` 返回：

```js
{
  data: {
    totalMemos: number,      // 正常笔记总数（deletedAt IS NULL）
    taggedMemos: number,     // 有标签的正常笔记数
    usageDays: number,       // 首条笔记 createdAt 到今天的天数差（含今天为 1 天）
    trashCount: number,      // 回收站笔记数（deletedAt IS NOT NULL）
    heatmap: [               // 最近 90 天每日笔记分布
      { day: 'YYYY-MM-DD', count: number },
      ...
    ]
  },
  message: 'ok'
}
```

这些字段均通过对 `memos` 表的聚合查询计算得出，不需要单独的统计表。`usageDays` 计算逻辑：取该用户最早一条笔记（`deletedAt IS NULL OR deletedAt IS NOT NULL` 均计入，含已删除）的 `createdAt`，与当日日期差 + 1。

---

## §3 API 端点设计

### 3.1 总览

本节覆盖以下 4 个路由文件的全量 API 设计：

| 文件路径 | 路由前缀 | 主要职责 |
|---------|---------|---------|
| `apps/server/src/routes/auth.js` | `/api/auth` | 注册 / 登录 / 登出 / 当前用户信息 |
| `apps/server/src/routes/memos.js` | `/api/memos` | 笔记 CRUD、筛选、搜索、软删除、回收站、恢复、永久删除 |
| `apps/server/src/routes/tags.js` | `/api/tags` | 标签列表（含笔记计数） |
| `apps/server/src/routes/stats.js` | `/api/stats` | 用户统计数据 + 热力图 |

统一响应格式（遵循 CLAUDE.md）：

```js
// 成功
{ data: value, message: string }

// 失败
{ data: null, error: string, message: string }
```

### 3.2 完整端点速查表

| 方法 | 路径 | 文件 | 鉴权 | 功能 |
|-----|------|------|------|------|
| POST | `/api/auth/register` | `routes/auth.js` | 否 | 注册新用户 |
| POST | `/api/auth/login` | `routes/auth.js` | 否 | 用户登录 |
| POST | `/api/auth/logout` | `routes/auth.js` | 否 | 用户登出 |
| GET | `/api/auth/me` | `routes/auth.js` | 是 | 获取当前用户信息 |
| GET | `/api/memos` | `routes/memos.js` | 是 | 获取笔记列表（支持 type / tagId / q 筛选） |
| POST | `/api/memos` | `routes/memos.js` | 是 | 创建新笔记 |
| GET | `/api/memos/trash` | `routes/memos.js` | 是 | 获取回收站列表 |
| DELETE | `/api/memos/:id` | `routes/memos.js` | 是 | 软删除笔记（移入回收站） |
| POST | `/api/memos/:id/restore` | `routes/memos.js` | 是 | 从回收站恢复笔记 |
| DELETE | `/api/memos/:id/permanent` | `routes/memos.js` | 是 | 永久删除笔记 |
| POST | `/api/memos/:id/attachments` | `routes/memos.js` | 是 | 上传笔记图片附件 |
| GET | `/api/tags` | `routes/tags.js` | 是 | 获取标签列表（含笔记计数） |
| GET | `/api/stats` | `routes/stats.js` | 是 | 获取统计数据和热力图 |

详细设计见 `specs/active/41-add-flomo-memo-page-design.md.backend.md`（临时文件，实现后删除）。

---

## §4 前端页面与组件

### 4.1 新增 Screen（路由页面）

所有页面文件位于 `apps/mobile/app/` 下，遵循 Expo Router 文件路由约定。

#### 根布局

| 文件路径 | URL 路径 | 说明 |
|---------|---------|------|
| `apps/mobile/app/_layout.jsx` | — | 根布局，挂载 `AuthProvider` 和 `MemoProvider`，使用 `Stack` 导航 |
| `apps/mobile/app/index.jsx` | `/` | 入口重定向：已登录跳转 `/memo`，未登录跳转 `/login` |

#### 认证路由组 `(auth)/`

| 文件路径 | URL 路径 | 说明 |
|---------|---------|------|
| `apps/mobile/app/(auth)/_layout.jsx` | — | 认证组布局，已登录用户自动重定向到 `/memo` |
| `apps/mobile/app/(auth)/login.jsx` | `/login` | 登录页：邮箱 + 密码表单，登录成功跳转 `/memo` |
| `apps/mobile/app/(auth)/register.jsx` | `/register` | 注册页：邮箱 + 昵称 + 密码表单，注册成功自动登录跳转 `/memo` |

#### 主应用路由组 `(app)/`

| 文件路径 | URL 路径 | 说明 |
|---------|---------|------|
| `apps/mobile/app/(app)/_layout.jsx` | — | 主应用布局，未登录用户自动重定向到 `/login` |
| `apps/mobile/app/(app)/memo/index.jsx` | `/memo` | 笔记主页（核心落地页）：左侧筛选面板 + 右侧笔记列表 + 顶部输入区 |
| `apps/mobile/app/(app)/memo/search.jsx` | `/memo/search` | 搜索页：搜索框 + 实时搜索结果列表（300ms 防抖） |
| `apps/mobile/app/(app)/memo/trash.jsx` | `/memo/trash` | 回收站页：已软删除笔记列表，支持恢复和永久删除 |

### 4.2 新增组件（20 个）

所有通用组件位于 `apps/mobile/components/` 下，使用具名 `export`，遵循 PascalCase 命名。

详细列表见 `specs/active/41-add-flomo-memo-page-design.md.frontend.md`（临时文件，实现后删除）。

### 4.3 Context / Reducer

| 文件路径 | 导出名 | 职责 |
|---------|-------|------|
| `apps/mobile/context/AuthContext.jsx` | `AuthProvider`, `useAuth()` | 用户认证状态管理，5 个 action types（`AUTH_INIT_*`, `LOGIN_SUCCESS`, `LOGOUT`） |
| `apps/mobile/context/MemoContext.jsx` | `MemoProvider`, `useMemoContext()` | 笔记列表、筛选、回收站、标签、统计状态管理，11 个 action types |

### 4.4 自定义 Hook（7 个）

| 文件路径 | 职责 |
|---------|------|
| `apps/mobile/hooks/use-auth.js` | 封装登录/注册/登出/会话检查逻辑 |
| `apps/mobile/hooks/use-memos.js` | 根据筛选条件加载笔记列表 |
| `apps/mobile/hooks/use-create-memo.js` | 创建笔记（含前端校验 + 图片上传） |
| `apps/mobile/hooks/use-tags.js` | 加载标签树 |
| `apps/mobile/hooks/use-stats.js` | 加载统计数据和热力图 |
| `apps/mobile/hooks/use-trash.js` | 回收站列表 + 恢复 + 永久删除 |
| `apps/mobile/hooks/use-search.js` | 搜索（300ms 防抖） |

详细交互流程和 data-testid 见 `specs/active/41-add-flomo-memo-page-design.md.frontend.md`（临时文件，实现后删除）。

---

## §5 改动文件清单

### 新增（后端）

```
apps/server/
├── src/
│   ├── index.js                        # Fastify 应用入口（注册插件 + 路由）
│   ├── plugins/
│   │   ├── session.js                  # @fastify/session 配置（SQLite session store）
│   │   ├── cors.js                     # @fastify/cors 配置
│   │   └── auth.js                     # requireAuth preHandler
│   ├── routes/
│   │   ├── auth.js                     # POST /api/auth/register, /login, /logout; GET /api/auth/me
│   │   ├── memos.js                    # GET/POST /api/memos, GET /trash, DELETE /:id, POST /:id/restore, DELETE /:id/permanent, POST /:id/attachments
│   │   ├── tags.js                     # GET /api/tags（含 count）
│   │   └── stats.js                    # GET /api/stats（totalMemos, taggedMemos, usageDays, trashCount, heatmap）
│   ├── db/
│   │   ├── schema.js                   # Drizzle 表定义：users, memos, tags, memo_tags, attachments（见 §2）
│   │   ├── index.js                    # Drizzle 实例导出
│   │   └── migrations/                 # 自动生成（由 drizzle-kit 创建）
│   └── lib/
│       ├── errors.js                   # 新增 ConflictError, BusinessError（EMAIL_EXISTS, TOO_MANY_TAGS, FILE_TOO_LARGE, INVALID_FILE_TYPE）
│       └── password.js                 # bcrypt 密码哈希工具（hash + compare）
├── drizzle.config.js                   # Drizzle Kit 配置（dialect: sqlite, schema: ./src/db/schema.js, out: ./src/db/migrations）
└── package.json                        # 新增依赖：fastify, @fastify/session, @fastify/cookie, @fastify/cors, @fastify/multipart, drizzle-orm, drizzle-kit, bcrypt, better-sqlite3
```

### 新增（前端）

```
apps/mobile/
├── app/
│   ├── _layout.jsx                     # 根布局（AuthProvider + MemoProvider + Stack）
│   ├── index.jsx                       # 入口重定向（/ → /memo 或 /login）
│   ├── (auth)/
│   │   ├── _layout.jsx                 # 认证组布局（已登录重定向到 /memo）
│   │   ├── login.jsx                   # 登录页（邮箱 + 密码表单，调用 useAuth().login）
│   │   └── register.jsx                # 注册页（邮箱 + 昵称 + 密码表单，调用 useAuth().register）
│   └── (app)/
│       ├── _layout.jsx                 # 主应用布局（未登录重定向到 /login）
│       └── memo/
│           ├── index.jsx               # 笔记主页（MemoInput + FilterPanel + TagList + MemoList + StatsBar + Heatmap）
│           ├── search.jsx              # 搜索页（SearchBar + 搜索结果 MemoList）
│           └── trash.jsx               # 回收站页（TrashMemoCard 列表 + 恢复/永久删除按钮）
├── components/
│   ├── AuthForm.jsx                    # 通用认证表单容器（邮箱/昵称/密码字段 + 前端校验）
│   ├── MemoInput.jsx                   # 笔记输入区（多行文本框 + 工具栏按钮 + 前端校验：长度/标签数/图片大小）
│   ├── AttachmentPreview.jsx           # 图片附件预览（缩略图 + 删除按钮）
│   ├── MemoList.jsx                    # 笔记列表容器（FlatList + 加载状态 + 空状态）
│   ├── MemoCard.jsx                    # 单条笔记卡片（内容 + 标签 + 图片缩略图 + 时间戳 + 菜单按钮，data-testid="memo-card"）
│   ├── MemoMenu.jsx                    # 笔记操作菜单（浮动，含「删除」选项）
│   ├── FilterPanel.jsx                 # 类型筛选面板（全部/有标签/无标签/有图片/有链接，点击切换高亮）
│   ├── TagList.jsx                     # 标签树列表（标签名 + 笔记计数 `标签名 (N)`）
│   ├── TagBadge.jsx                    # 单个标签徽章（绿色 `#标签名` 文本）
│   ├── StatsBar.jsx                    # 统计信息条（昵称 + 全部笔记 + 有标签 + 使用天数，data-testid="stats-bar"）
│   ├── Heatmap.jsx                     # 热力图（90 天日历格子矩阵，颜色深浅反映笔记数，悬停/长按显示工具提示）
│   ├── TrashMemoCard.jsx               # 回收站笔记卡片（内容 + 删除时间 + 「恢复」和「永久删除」按钮）
│   ├── ConfirmDialog.jsx               # 通用二次确认对话框（标题 + 说明 + 「确认」/「取消」按钮，data-testid="confirm-dialog"）
│   ├── ProUpgradeModal.jsx             # Pro 升级引导浮窗（购买 Pro 会员，data-testid="pro-upgrade-modal"）
│   ├── Toast.jsx                       # 轻提示组件（成功/错误，2 秒后自动消失）
│   ├── UserMenu.jsx                    # 用户头像/昵称下拉菜单（含「登出」选项）
│   ├── SearchBar.jsx                   # 搜索框（带清空按钮，300ms 防抖）
│   ├── EmptyState.jsx                  # 空状态占位（暂无笔记/未找到/回收站为空）
│   ├── Sidebar.jsx                     # 左侧筛选面板容器（类型筛选 + 标签树 + 回收站入口 + 用户信息）
│   └── MainLayout.jsx                  # 主页双栏布局（Web 侧边栏 + 内容区，移动端底部 Tab）
├── context/
│   ├── AuthContext.jsx                 # 用户认证 Context（user, isLoading, error；action types: AUTH_INIT_*, LOGIN_SUCCESS, LOGOUT）
│   └── MemoContext.jsx                 # 笔记列表 Context（memos, tags, stats, trashMemos, activeFilter, isLoading, error；11 个 action types）
├── hooks/
│   ├── use-auth.js                     # 封装登录/注册/登出/会话检查（调用 AuthContext）
│   ├── use-memos.js                    # 根据 activeFilter 加载笔记列表（调用 GET /api/memos）
│   ├── use-create-memo.js              # 创建笔记（前端校验 → 上传图片 → POST /api/memos → 更新 Context）
│   ├── use-tags.js                     # 加载标签树（GET /api/tags）
│   ├── use-stats.js                    # 加载统计数据（GET /api/stats）
│   ├── use-trash.js                    # 回收站列表 + 恢复/永久删除方法
│   └── use-search.js                   # 搜索（本地 query state + 300ms 防抖 → GET /api/memos?q=）
├── lib/
│   ├── api-client.js                   # 统一 fetch 封装（携带 credentials: 'include'，统一错误处理，返回 json.data）
│   └── parse-tags.js                   # 工具函数：从笔记内容提取标签名列表（正则 `/#([^\s#]+)/g`）
└── package.json                        # 新增依赖：expo, expo-router, react-native, react, babel-plugin-module-resolver
```

### 修改（现有文件）

无。本次为全量新建，不修改任何现有代码文件。

---

## §6 技术约束与风险

### 6.1 输入校验

**前端校验**（在提交前阻止，提升用户体验）：
- 邮箱格式：`/.+@.+\..+/`，实时校验
- 密码长度：≥ 8 字符
- 笔记内容：非空字符串、长度 ≤ 10,000 字符
- 标签数量：每条笔记最多 10 个标签（通过 `parseTags(content)` 预校验）
- 图片大小：≤ 5MB（5 * 1024 * 1024 字节）
- 图片格式：MIME 类型白名单（`image/jpeg`, `image/png`, `image/gif`）

**后端校验**（防止绕过前端校验的恶意请求，强制约束）：
- 所有前端校验规则在后端再次执行（使用 Fastify JSON Schema 或业务逻辑检查）
- 额外校验：
  - `nickname` 长度 1–50 字符
  - 标签名长度 1–20 字符（正则提取后校验）
  - 文件 MIME 类型（检查 `Content-Type` 头）
  - 路径参数 `:id` 存在性和归属权（防止越权操作）

### 6.2 安全

| 威胁 | 防护措施 |
|------|---------|
| XSS | 笔记内容纯文本渲染（React Native `Text` 组件自动转义；Web 端不使用 `dangerouslySetInnerHTML`） |
| SQL 注入 | 严格使用 Drizzle 参数化查询（禁止原生 SQL 字符串拼接，CONSTITUTION.md 绝对禁止项） |
| CSRF | Cookie 设置 `sameSite: 'strict'`（Fastify session plugin 配置） |
| Session 劫持 | Cookie `httpOnly: true`（禁止 JS 访问），生产环境 `secure: true`（仅 HTTPS 传输） |
| 文件上传攻击 | 白名单 MIME 类型、大小限制、随机文件名（防止目录遍历）、存储在 `data/uploads/` 外部不可执行路径 |
| 认证边界 | 所有受保护路由必须使用 `preHandler: [requireAuth]`，禁止在 handler 内手动检查 session |
| 密码存储 | bcrypt 哈希（默认 10 轮 salt），响应中禁止返回 `passwordHash` 字段 |

### 6.3 性能

| 风险点 | 优化方案 |
|--------|---------|
| N+1 查询（标签 + 附件） | 使用 Drizzle 关联查询（JOIN 或批量加载），单次 `GET /api/memos` 返回嵌套的 `tags[]` 和 `attachments[]` |
| 热力图查询（90 天聚合） | 缓存到 Redis（后续优化）；MVP 阶段直接聚合查询，用户量小时可接受 |
| 分页缺失 | MVP 不做分页（预期单用户 < 1000 条笔记），若实际数据量大则前端实现虚拟滚动或后端加 `LIMIT`/`OFFSET` |
| 图片加载慢 | 前端显示缩略图时使用懒加载（`loading="lazy"`），后续可加 CDN 和图片压缩 |
| 搜索防抖不足 | 前端 300ms 防抖已足够（用户停止输入后才触发请求），后端 `LIKE` 查询在 SQLite 全表扫描（< 1000 条可接受） |

### 6.4 兼容性

| 场景 | 处理方式 |
|------|---------|
| Web 与移动端差异 | 热力图 hover（Web）vs 长按（移动端）通过 `Platform.OS` 区分；图片上传 Web 用 `input[type="file"]`，移动端用 `expo-image-picker`（MVP 阶段 Web 优先，移动端图片上传为后续迭代） |
| SQLite 无 boolean 类型 | 使用 `integer` 存储（0/1）并在业务层映射，E2E 测试中直接断言数值 |
| 时区问题 | `createdAt` 统一存储 ISO 8601 格式（UTC），前端展示时转换为用户本地时区 |
| 软删除与永久删除混淆 | 所有查询（除回收站外）必须加 `WHERE deletedAt IS NULL`；前端保持 API 路径命名清晰（`/memos/:id` 软删除，`/memos/:id/permanent` 永久删除） |

---

## §7 不包含（范围边界）

本次设计**不涉及**以下功能，防止范围蔓延：

1. **Pro 会员实际功能实现**
   仅实现占位 UI（Pro 升级浮窗 + 「功能开发中」提示）。微信输入、每日回顾、AI 洞察、随机漫步的真实业务逻辑属于后续 Spec。

2. **笔记编辑功能**
   本次只支持创建和删除，不支持编辑已存在笔记的 `content`。E2E 测试中无 `PUT /api/memos/:id` 断言，后续若需编辑需单独设计（如版本控制、编辑历史）。

3. **标签管理功能**
   不支持手动创建、删除、重命名标签。标签仅通过笔记内容中的 `#标签名` 自动创建，孤儿标签（`count = 0`）由前端过滤或后端不返回。

4. **笔记分享 / 导出功能**
   不支持生成笔记分享链接、导出为 PDF/Markdown 等格式。

5. **多用户协作 / 权限管理**
   每个用户只能访问自己的笔记，不支持笔记共享、团队空间、角色权限等。

6. **回收站自动清理**
   软删除笔记在回收站中无限期保留（Spec 推断 30 天后自动清除，但 MVP 不实现定时任务，需手动永久删除）。

7. **图片编辑 / 裁剪**
   上传图片直接存储原图，不支持前端裁剪、压缩、添加滤镜等。

8. **语音笔记功能**
   Spec 中的「有语音」类型筛选项仅作为 UI 占位（点击提示「功能开发中」），不实现语音录制/转文字/播放。

9. **实时同步 / 离线缓存**
   MVP 依赖网络连接，离线状态下创建的笔记不会暂存到本地（Spec 推断离线同步，但本次不实现 Service Worker / AsyncStorage）。

10. **笔记内容富文本编辑**
    笔记内容为纯文本（`text` 类型），不支持加粗、斜体、代码块等 Markdown/富文本格式。`#标签名` 和 URL 仅做文本高亮，不支持点击跳转。

---

## 附录：临时文件引用

本文档由 Orchestrator 合并以下三个临时文件生成：

- `specs/active/41-add-flomo-memo-page-design.md.architect.md` — §1 功能概述 + §2 数据模型
- `specs/active/41-add-flomo-memo-page-design.md.backend.md` — §3 API 端点设计（完整版）
- `specs/active/41-add-flomo-memo-page-design.md.frontend.md` — §4 前端页面与组件（完整版）

实现时请参考对应临时文件的详细设计（含 JSON Schema、交互流程、data-testid 映射表等）。实现完成后删除临时文件。
