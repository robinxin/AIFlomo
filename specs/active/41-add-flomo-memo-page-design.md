# 技术方案文档：Flomo 笔记页面

**功能规格**: `specs/active/41-add-flomo-memo-page.md`
**Feature Branch**: `feat/41-flomo-memo-page`
**创建日期**: 2026-03-10
**状态**: 设计中

---

## 1. 功能概述

本次实现 AIFlomo 的核心笔记页面，提供完整的双栏交互界面：左侧固定侧边栏（用户信息、统计、热力图、导航、标签列表、回收站）+ 右侧可滚动笔记流（新建笔记输入框 + 笔记卡片列表）。

**核心目标**：打通"输入 → 存储 → 回看"闭环，让用户能够快速记录想法、添加标签/图片/链接，并通过侧边栏过滤、搜索、热力图等功能管理笔记。

**在系统中的定位**：
- 这是首次实现完整的前后端交互功能
- 涉及用户认证、笔记 CRUD、标签管理、统计聚合、全文搜索等核心业务
- 为后续 Pro 功能（微信输入、AI 洞察等）提供数据基础

**用户价值**：
- 最低摩擦记录零散想法（无需复杂表单、多步骤确认）
- 通过标签和时间线快速回顾内容
- 热力图可视化记录习惯，培养持续记录动力

---

## 2. 数据模型变更

### 2.1 新增表结构

需要新增以下 4 张表，完整 schema 如下：

```js
// apps/server/src/db/schema.js
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ── 用户表 ──
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  nickname: text('nickname').notNull(),                     // 用户昵称
  account: text('account').notNull().unique(),              // 登录账号（手机号或邮箱）
  passwordHash: text('password_hash').notNull(),            // 密码哈希
  isPro: integer('is_pro', { mode: 'boolean' }).default(false),  // 是否 Pro 会员
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

// ── 笔记表 ──
export const notes = sqliteTable('notes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),                       // 笔记正文（HTML）
  tags: text('tags', { mode: 'json' }).default([]),         // 标签数组（JSON）
  images: text('images', { mode: 'json' }).default([]),     // 图片路径数组
  audioUrl: text('audio_url'),                              // 语音文件路径（可选）
  links: text('links', { mode: 'json' }).default([]),       // 自动提取的 URL 数组
  refs: text('refs', { mode: 'json' }).default([]),         // @引用的笔记 ID 数组
  deleted: integer('deleted', { mode: 'boolean' }).default(false),  // 软删除标记
  deletedAt: text('deleted_at'),                            // 删除时间
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

// ── Session 表（@fastify/session 需要）──
export const sessions = sqliteTable('sessions', {
  sid: text('sid').primaryKey(),
  sess: text('sess', { mode: 'json' }).notNull(),
  expire: integer('expire').notNull(),
});
```

### 2.2 设计理由

- **`notes.tags` 使用 JSON 字段**：SQLite 场景下简化设计，避免多表 JOIN。后续迁移 PostgreSQL 时可改为独立 `tags` + `note_tags` 多对多关系表
- **`notes.deleted` 软删除**：保留数据支持回收站恢复功能，`onDelete: 'cascade'` 确保用户删除时笔记也级联删除
- **`users.isPro` 字段**：预留 Pro 会员标识，当前默认 `false`
- **`sessions` 表**：@fastify/session 的 SQLite 存储需求，`sid` 为主键

---

## 3. API 端点设计

### 3.1 认证相关

#### `POST /api/auth/register`
- **文件**: `apps/server/src/routes/auth.js`
- **鉴权**: 无
- **请求验证**（JSON Schema）：
  ```js
  {
    body: {
      type: 'object',
      required: ['account', 'password', 'nickname'],
      properties: {
        account: { type: 'string', minLength: 3, maxLength: 100 },
        password: { type: 'string', minLength: 6, maxLength: 100 },
        nickname: { type: 'string', minLength: 1, maxLength: 50 },
      },
    },
  }
  ```
- **成功响应** (201):
  ```json
  {
    "data": {
      "id": "550e8400-...",
      "nickname": "金兰",
      "account": "user@example.com",
      "isPro": false
    },
    "message": "注册成功"
  }
  ```
- **失败响应**:
  - `400` - `{ "data": null, "error": "INVALID_INPUT", "message": "账号已存在" }`

---

#### `POST /api/auth/login`
- **文件**: `apps/server/src/routes/auth.js`
- **鉴权**: 无
- **请求验证**：
  ```js
  {
    body: {
      type: 'object',
      required: ['account', 'password'],
      properties: {
        account: { type: 'string' },
        password: { type: 'string' },
      },
    },
  }
  ```
- **成功响应** (200):
  ```json
  {
    "data": {
      "id": "550e8400-...",
      "nickname": "金兰",
      "isPro": false
    },
    "message": "登录成功"
  }
  ```
  同时在 httpOnly Cookie 中设置 `sessionId`
- **失败响应**:
  - `401` - `{ "data": null, "error": "INVALID_CREDENTIALS", "message": "账号或密码错误" }`

---

#### `POST /api/auth/logout`
- **文件**: `apps/server/src/routes/auth.js`
- **鉴权**: `preHandler: [requireAuth]`
- **请求验证**: 无
- **成功响应** (204): 空 body，清除 session cookie
- **失败响应**:
  - `401` - `{ "data": null, "error": "UNAUTHORIZED", "message": "请先登录" }`

---

### 3.2 笔记相关

#### `GET /api/notes`
- **文件**: `apps/server/src/routes/notes.js`
- **鉴权**: `preHandler: [requireAuth]`
- **Query 参数**:
  - `tag` (string, 可选) - 过滤指定标签的笔记
  - `type` (enum, 可选) - `untagged` | `image` | `link` | `audio`
  - `q` (string, 可选) - 全文搜索关键词
  - `page` (integer, 默认 1)
  - `limit` (integer, 默认 30, 最大 100)
- **请求验证**：
  ```js
  {
    querystring: {
      type: 'object',
      properties: {
        tag: { type: 'string', maxLength: 32 },
        type: { type: 'string', enum: ['untagged', 'image', 'link', 'audio'] },
        q: { type: 'string', maxLength: 200 },
        page: { type: 'integer', minimum: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 100 },
      },
    },
  }
  ```
- **成功响应** (200):
  ```json
  {
    "data": {
      "notes": [
        {
          "id": "550e8400-...",
          "content": "笔记正文...",
          "tags": ["科幻", "工作"],
          "images": ["/uploads/abc.jpg"],
          "audioUrl": null,
          "links": ["https://example.com"],
          "refs": [],
          "createdAt": "2026-02-26T11:04:25.000Z",
          "updatedAt": "2026-02-26T11:04:25.000Z"
        }
      ],
      "total": 6,
      "page": 1,
      "limit": 30
    },
    "message": "ok"
  }
  ```
- **失败响应**:
  - `401` - 未登录

---

#### `POST /api/notes`
- **文件**: `apps/server/src/routes/notes.js`
- **鉴权**: `preHandler: [requireAuth]`
- **请求验证**：
  ```js
  {
    body: {
      type: 'object',
      required: ['content'],
      properties: {
        content: { type: 'string', minLength: 1, maxLength: 10000 },
        tags: { type: 'array', items: { type: 'string', maxLength: 32 }, maxItems: 20 },
        images: { type: 'array', items: { type: 'string' }, maxItems: 9 },
        audioUrl: { type: 'string' },
        links: { type: 'array', items: { type: 'string' } },
        refs: { type: 'array', items: { type: 'string' } },
      },
    },
  }
  ```
- **成功响应** (201):
  ```json
  {
    "data": {
      "id": "550e8400-...",
      "content": "笔记正文...",
      "tags": ["科幻"],
      "images": [],
      "audioUrl": null,
      "links": [],
      "refs": [],
      "deleted": false,
      "createdAt": "2026-03-10T12:00:00.000Z",
      "updatedAt": "2026-03-10T12:00:00.000Z"
    },
    "message": "创建成功"
  }
  ```
- **失败响应**:
  - `400` - `{ "data": null, "error": "VALIDATION_ERROR", "message": "正文不能为空" }`
  - `413` - `{ "data": null, "error": "CONTENT_TOO_LARGE", "message": "正文超过 10,000 字符" }`

---

#### `PATCH /api/notes/:id`
- **文件**: `apps/server/src/routes/notes.js`
- **鉴权**: `preHandler: [requireAuth]`
- **请求验证**：
  ```js
  {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
      },
    },
    body: {
      type: 'object',
      properties: {
        content: { type: 'string', minLength: 1, maxLength: 10000 },
        tags: { type: 'array', items: { type: 'string', maxLength: 32 }, maxItems: 20 },
        images: { type: 'array', items: { type: 'string' }, maxItems: 9 },
        audioUrl: { type: 'string' },
        links: { type: 'array', items: { type: 'string' } },
        refs: { type: 'array', items: { type: 'string' } },
      },
    },
  }
  ```
- **成功响应** (200):
  ```json
  {
    "data": {
      "id": "550e8400-...",
      "content": "更新后正文...",
      "updatedAt": "2026-03-10T13:00:00.000Z"
    },
    "message": "更新成功"
  }
  ```
- **失败响应**:
  - `404` - `{ "data": null, "error": "NOT_FOUND", "message": "笔记不存在" }`
  - `403` - `{ "data": null, "error": "FORBIDDEN", "message": "无权编辑此笔记" }`

---

#### `DELETE /api/notes/:id`（软删除）
- **文件**: `apps/server/src/routes/notes.js`
- **鉴权**: `preHandler: [requireAuth]`
- **请求验证**：
  ```js
  {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
      },
    },
  }
  ```
- **成功响应** (204): 空 body
- **失败响应**:
  - `404` - 笔记不存在
  - `403` - 无权删除

---

#### `GET /api/notes/trash`
- **文件**: `apps/server/src/routes/notes.js`
- **鉴权**: `preHandler: [requireAuth]`
- **成功响应** (200):
  ```json
  {
    "data": [
      {
        "id": "550e8400-...",
        "content": "已删除笔记...",
        "deletedAt": "2026-03-01T08:00:00.000Z"
      }
    ],
    "message": "ok"
  }
  ```

---

#### `POST /api/notes/:id/restore`
- **文件**: `apps/server/src/routes/notes.js`
- **鉴权**: `preHandler: [requireAuth]`
- **请求验证**：
  ```js
  {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
      },
    },
  }
  ```
- **成功响应** (200):
  ```json
  {
    "data": { "id": "550e8400-..." },
    "message": "恢复成功"
  }
  ```
- **失败响应**:
  - `404` - 笔记不存在或未删除

---

#### `DELETE /api/notes/:id/permanent`（永久删除）
- **文件**: `apps/server/src/routes/notes.js`
- **鉴权**: `preHandler: [requireAuth]`
- **请求验证**：
  ```js
  {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
      },
    },
  }
  ```
- **成功响应** (204): 空 body
- **失败响应**:
  - `404` - 笔记不存在

---

#### `DELETE /api/notes/trash`（清空回收站）
- **文件**: `apps/server/src/routes/notes.js`
- **鉴权**: `preHandler: [requireAuth]`
- **成功响应** (204): 空 body

---

### 3.3 标签相关

#### `GET /api/tags`
- **文件**: `apps/server/src/routes/tags.js`
- **鉴权**: `preHandler: [requireAuth]`
- **成功响应** (200):
  ```json
  {
    "data": [
      { "name": "科幻", "count": 3 },
      { "name": "工作", "count": 12 }
    ],
    "message": "ok"
  }
  ```
  按 `count` 降序排列

---

### 3.4 统计相关

#### `GET /api/stats`
- **文件**: `apps/server/src/routes/stats.js`
- **鉴权**: `preHandler: [requireAuth]`
- **成功响应** (200):
  ```json
  {
    "data": {
      "totalNotes": 6,
      "totalTags": 1,
      "activeDays": 10,
      "heatmap": {
        "2026-02-26": 3,
        "2026-02-27": 1,
        "2026-03-10": 2
      }
    },
    "message": "ok"
  }
  ```
  - `totalNotes`: 当前用户全部未删除笔记总数
  - `totalTags`: 至少有 1 条笔记的不同标签数量
  - `activeDays`: 用户创建过笔记的不同日期总数
  - `heatmap`: 最近 112 天（约 16 周）的日期 → 笔记数量映射

---

### 3.5 文件上传

#### `POST /api/upload/image`
- **文件**: `apps/server/src/routes/upload.js`
- **鉴权**: `preHandler: [requireAuth]`
- **请求**: `multipart/form-data`, 字段 `file`
- **限制**: 单张最大 10MB, 仅支持 `jpg/png/gif/webp`
- **成功响应** (201):
  ```json
  {
    "data": {
      "url": "/uploads/2026-03-10/abc123.jpg"
    },
    "message": "上传成功"
  }
  ```
- **失败响应**:
  - `400` - `{ "data": null, "error": "INVALID_FILE", "message": "不支持的文件格式" }`
  - `413` - `{ "data": null, "error": "FILE_TOO_LARGE", "message": "文件大小超过 10MB" }`

---

#### `POST /api/upload/audio`
- **文件**: `apps/server/src/routes/upload.js`
- **鉴权**: `preHandler: [requireAuth]`
- **请求**: `multipart/form-data`, 字段 `file`
- **限制**: 单文件最大 20MB, 仅支持 `mp3/wav/m4a`
- **成功响应** (201):
  ```json
  {
    "data": {
      "url": "/uploads/2026-03-10/voice123.mp3"
    },
    "message": "上传成功"
  }
  ```

---

## 4. 前端页面与组件

### 4.1 新增 Screen（Expo Router 页面）

#### `apps/mobile/app/(auth)/login.jsx`
- **URL 路径**: `/login`
- **职责**: 登录页面，输入账号密码 → 调用 `POST /api/auth/login` → 成功后跳转 `/`

#### `apps/mobile/app/(auth)/register.jsx`
- **URL 路径**: `/register`
- **职责**: 注册页面，输入账号/密码/昵称 → 调用 `POST /api/auth/register` → 成功后跳转 `/login`

#### `apps/mobile/app/(app)/index.jsx`
- **URL 路径**: `/`（需登录）
- **职责**: 主笔记页面，双栏布局
  - 左侧边栏（`<Sidebar />`）
  - 右侧笔记流（`<NoteInput />` + `<NoteList />`）

#### `apps/mobile/app/(app)/trash.jsx`
- **URL 路径**: `/trash`（需登录）
- **职责**: 回收站视图，展示已删除笔记列表，支持恢复/永久删除

---

### 4.2 新增组件

#### `apps/mobile/components/Sidebar.jsx`
- **职责**: 左侧边栏完整实现
  - 用户信息区（昵称 + Pro 徽章 + 退出登录下拉）
  - 统计栏（笔记/标签/天）
  - 热力图（`<Heatmap />` 子组件）
  - 导航菜单（全部笔记 + 子项 + Pro 入口）
  - 标签列表（`<TagList />` 子组件）
  - 回收站入口

#### `apps/mobile/components/Heatmap.jsx`
- **职责**: 热力图可视化组件
  - 接收 `heatmap` 数据（从 `GET /api/stats` 获取）
  - 渲染最近 16 周日历格，颜色深浅映射笔记数
  - 悬浮显示 tooltip（`YYYY-MM-DD · N 条笔记`）

#### `apps/mobile/components/TagList.jsx`
- **职责**: 标签列表组件
  - 接收 `tags` 数据（从 `GET /api/tags` 获取）
  - 每行显示 `# 标签名 笔记数`
  - 按笔记数降序排列
  - 点击某标签行触发过滤

#### `apps/mobile/components/NoteInput.jsx`
- **职责**: 新建笔记输入框
  - 多行文本输入（占位文字：现在的想法是...）
  - 工具栏（`#` 标签、`🖼` 图片、`Aa` 富文本、列表、`@` 引用、`►` 提交）
  - 标签自动补全下拉（输入 `#` 时触发）
  - 链接自动识别（正则提取 URL）
  - 图片上传预览
  - 提交后乐观更新（立即插入 `<NoteCard />` 到列表顶部）

#### `apps/mobile/components/NoteList.jsx`
- **职责**: 笔记卡片列表容器
  - 接收 `notes` 数组
  - 无限滚动（距底部 200px 加载下一页）
  - 支持搜索高亮（传入 `searchKeyword` props）

#### `apps/mobile/components/NoteCard.jsx`
- **职责**: 单条笔记卡片
  - 显示时间戳、正文、标签、图片/链接/音频附件
  - 溢出菜单（`···`）：编辑/删除/复制内容
  - 编辑模式（内联切换为可编辑输入框，工具栏同 `<NoteInput />`）
  - 搜索高亮（关键词黄色背景）

#### `apps/mobile/components/ProModal.jsx`
- **职责**: Pro 会员购买浮窗
  - 遮罩背景半透明黑色
  - 标题 + 产品截图 + 「开通 PRO 会员解锁」按钮
  - 点击遮罩或 `×` 关闭浮窗
  - 按钮点击当前仅关闭浮窗（支付功能留空）

#### `apps/mobile/components/SearchBar.jsx`
- **职责**: 顶栏搜索框组件
  - 占位文字「⌘K」
  - 支持快捷键 `⌘K` / `Ctrl+K` 聚焦
  - 输入防抖 200ms，触发 `onSearch(keyword)` 回调
  - 支持 `#tagname` 语法（以 `#` 开头时解析为标签过滤）

---

### 4.3 Context/Reducer 变更

#### `apps/mobile/context/AuthContext.jsx`（新增）
- **职责**: 全局认证状态管理
- **State**:
  ```js
  {
    user: null | { id, nickname, isPro },
    isLoading: false,
    error: null,
  }
  ```
- **Action Types**:
  - `LOGIN_START` / `LOGIN_SUCCESS` / `LOGIN_ERROR`
  - `LOGOUT`
  - `REGISTER_START` / `REGISTER_SUCCESS` / `REGISTER_ERROR`

#### `apps/mobile/context/NoteContext.jsx`（新增）
- **职责**: 笔记列表状态管理
- **State**:
  ```js
  {
    notes: [],
    total: 0,
    page: 1,
    limit: 30,
    isLoading: false,
    error: null,
    filter: { tag: null, type: null, q: null },  // 当前过滤条件
  }
  ```
- **Action Types**:
  - `FETCH_START` / `FETCH_SUCCESS` / `FETCH_ERROR`
  - `ADD_NOTE` (乐观更新)
  - `UPDATE_NOTE`
  - `DELETE_NOTE` (软删除，从列表移除)
  - `SET_FILTER` (设置过滤条件)
  - `LOAD_MORE` (加载下一页)

#### `apps/mobile/context/StatsContext.jsx`（新增）
- **职责**: 统计数据状态管理
- **State**:
  ```js
  {
    totalNotes: 0,
    totalTags: 0,
    activeDays: 0,
    heatmap: {},
    isLoading: false,
  }
  ```
- **Action Types**:
  - `FETCH_STATS_START` / `FETCH_STATS_SUCCESS` / `FETCH_STATS_ERROR`

---

### 4.4 自定义 Hook 变更

#### `apps/mobile/hooks/use-notes.js`（新增）
- **职责**: 封装笔记列表获取逻辑
- **返回**: `{ notes, total, isLoading, refetch, loadMore, createNote, updateNote, deleteNote }`
- **内部调用**: `useNoteContext()` + `api.get('/notes')` + `api.post('/notes')` 等

#### `apps/mobile/hooks/use-stats.js`（新增）
- **职责**: 封装统计数据获取逻辑
- **返回**: `{ totalNotes, totalTags, activeDays, heatmap, isLoading, refetch }`
- **内部调用**: `useStatsContext()` + `api.get('/stats')`

#### `apps/mobile/hooks/use-tags.js`（新增）
- **职责**: 封装标签列表获取逻辑
- **返回**: `{ tags, isLoading, refetch }`
- **内部调用**: `api.get('/tags')`

---

### 4.5 用户交互流程

#### 登录流程
1. 用户打开 App → 未登录 → 重定向到 `/login`
2. 输入账号密码 → 点击「登录」→ 调用 `POST /api/auth/login`
3. 成功 → AuthContext 更新 `user` → 跳转 `/` 主页
4. 失败 → Toast 提示「账号或密码错误」

#### 新建笔记流程
1. 用户在输入框输入正文 → 点击工具栏 `#` 选择标签 → 点击 `🖼` 上传图片
2. 图片选择后 → 调用 `POST /api/upload/image` → 预览缩略图
3. 点击 `►` 提交 → 调用 `POST /api/notes`
4. **乐观更新**：立即将新笔记对象插入 NoteList 顶部（灰色背景表示"上传中"）
5. 成功 → 更新笔记状态（移除"上传中"标记）
6. 失败 → 回滚乐观更新，Toast 提示「保存失败，请重试」

#### 搜索流程
1. 用户点击顶栏搜索框（或按 `⌘K`）→ 聚焦输入
2. 输入关键词（防抖 200ms）→ 触发 `SET_FILTER` action
3. NoteContext 更新 `filter.q` → 重新调用 `GET /api/notes?q=keyword`
4. 笔记流替换为搜索结果 → 匹配片段黄色高亮
5. 清空搜索词 → 恢复完整笔记流

#### 标签过滤流程
1. 用户点击侧边栏某标签行（如「# 科幻 3」）
2. 触发 `SET_FILTER` action，更新 `filter.tag = "科幻"`
3. 调用 `GET /api/notes?tag=科幻`
4. 笔记流只显示包含该标签的笔记
5. 点击「全部笔记」→ 清除过滤条件

#### 回收站流程
1. 用户点击侧边栏「🗑 回收站 (5)」→ 跳转 `/trash`
2. 调用 `GET /api/notes/trash` 获取已删除笔记
3. 点击某条笔记的「恢复」→ 调用 `POST /api/notes/:id/restore` → 从回收站移除
4. 点击「彻底删除」→ 弹出确认对话框 → 确认后调用 `DELETE /api/notes/:id/permanent`
5. 点击「清空回收站」→ 弹出确认对话框 → 确认后调用 `DELETE /api/notes/trash`

---

## 5. 改动文件清单

### 新增

**后端**:
- `apps/server/src/index.js` — Fastify 应用入口
- `apps/server/src/plugins/session.js` — Session 插件配置
- `apps/server/src/plugins/cors.js` — CORS 插件配置
- `apps/server/src/plugins/auth.js` — `requireAuth` preHandler
- `apps/server/src/routes/auth.js` — 认证路由（登录/注册/登出）
- `apps/server/src/routes/notes.js` — 笔记 CRUD + 回收站
- `apps/server/src/routes/tags.js` — 标签列表
- `apps/server/src/routes/stats.js` — 统计数据
- `apps/server/src/routes/upload.js` — 图片/音频上传
- `apps/server/src/db/schema.js` — Drizzle 表定义（users / notes / sessions）
- `apps/server/src/db/index.js` — Drizzle 实例导出
- `apps/server/src/lib/errors.js` — 统一错误类
- `apps/server/src/lib/password.js` — 密码哈希工具（bcrypt）
- `apps/server/drizzle.config.js` — Drizzle Kit 配置
- `apps/server/package.json` — 依赖声明（fastify / drizzle-orm / bcrypt 等）

**前端**:
- `apps/mobile/app/_layout.jsx` — 根布局（注册 AuthProvider / NoteProvider）
- `apps/mobile/app/(auth)/_layout.jsx` — 认证页面布局
- `apps/mobile/app/(auth)/login.jsx` — 登录页面
- `apps/mobile/app/(auth)/register.jsx` — 注册页面
- `apps/mobile/app/(app)/_layout.jsx` — 主应用布局（需登录）
- `apps/mobile/app/(app)/index.jsx` — 主笔记页面（双栏布局）
- `apps/mobile/app/(app)/trash.jsx` — 回收站页面
- `apps/mobile/components/Sidebar.jsx` — 左侧边栏
- `apps/mobile/components/Heatmap.jsx` — 热力图组件
- `apps/mobile/components/TagList.jsx` — 标签列表组件
- `apps/mobile/components/NoteInput.jsx` — 新建笔记输入框
- `apps/mobile/components/NoteList.jsx` — 笔记列表容器
- `apps/mobile/components/NoteCard.jsx` — 单条笔记卡片
- `apps/mobile/components/ProModal.jsx` — Pro 会员购买浮窗
- `apps/mobile/components/SearchBar.jsx` — 顶栏搜索框
- `apps/mobile/context/AuthContext.jsx` — 认证状态管理
- `apps/mobile/context/NoteContext.jsx` — 笔记列表状态管理
- `apps/mobile/context/StatsContext.jsx` — 统计数据状态管理
- `apps/mobile/hooks/use-notes.js` — 笔记操作 Hook
- `apps/mobile/hooks/use-stats.js` — 统计数据 Hook
- `apps/mobile/hooks/use-tags.js` — 标签列表 Hook
- `apps/mobile/lib/api-client.js` — API 请求封装（fetch wrapper）
- `apps/mobile/package.json` — 依赖声明（expo / expo-router / react-native 等）

### 修改

**根目录**:
- `.env` — 新增环境变量：
  ```bash
  # Backend
  NODE_ENV=development
  PORT=3000
  DB_PATH=./data/aiflomo.db
  SESSION_SECRET=replace-with-32-char-random-string-here
  CORS_ORIGIN=http://localhost:8082

  # Frontend
  EXPO_PUBLIC_API_URL=http://localhost:3000
  ```

- `package.json` — 更新 workspaces、scripts
  ```json
  {
    "workspaces": ["apps/server", "apps/mobile", "apps/tests"],
    "scripts": {
      "dev": "concurrently \"pnpm dev -w apps/server\" \"pnpm dev -w apps/mobile\"",
      "build": "pnpm build -w apps/server && pnpm build -w apps/mobile",
      "lint": "pnpm lint -w apps/server && pnpm lint -w apps/mobile",
      "test": "playwright test",
      "test:unit": "pnpm test:unit -w apps/server && pnpm test:unit -w apps/mobile"
    }
  }
  ```

---

## 6. 技术约束与风险

### 6.1 输入校验

**前端校验（React Native）**:
| 字段 | 类型 | 长度 | 格式要求 |
|------|------|------|---------|
| `account` | string | 3–100 | 邮箱或手机号格式 |
| `password` | string | 6–100 | 至少 6 位 |
| `nickname` | string | 1–50 | 任意字符 |
| `note.content` | string | 1–10,000 | 纯文本/HTML（防 XSS） |
| `note.tags[]` | string | 1–32 每个 | 最多 20 个标签 |
| `note.images[]` | string | - | 最多 9 张，每张 ≤ 10MB |

**后端校验（Fastify JSON Schema）**:
- 所有端点必须使用 JSON Schema 验证 `body` / `params` / `querystring`
- 超长输入 → 返回 `400` + `VALIDATION_ERROR`
- 图片/音频上传必须检查 MIME 类型和文件大小

### 6.2 安全

#### XSS 防护
- 前端展示笔记内容时**禁止使用 `dangerouslySetInnerHTML`**，统一用 `<Text>{content}</Text>` 纯文本渲染
- 如需富文本（加粗、高亮），后端存储前必须使用 `sanitize-html` 库过滤危险标签

#### 认证边界
- 所有 `/api/*` 端点（除 `/auth/login` `/auth/register`）必须加 `preHandler: [requireAuth]`
- `requireAuth` 检查 `request.session.userId`，未登录返回 `401`

#### Session 安全
- Cookie 必须设置：
  - `httpOnly: true` — 防止 JS 读取
  - `sameSite: 'strict'` — 防 CSRF
  - `secure: true`（生产环境）— 仅 HTTPS
- Session 有效期 7 天，超时后强制重新登录

#### 密码存储
- 使用 `bcrypt` 哈希（salt rounds = 10）
- 禁止明文存储、禁止 MD5/SHA1

### 6.3 性能

#### 潜在 N+1 查询
- **标签列表聚合**：
  - ❌ 每个标签单独查询笔记数 → N+1
  - ✅ 使用 JSON 字段 + SQLite `json_each()` 一次性聚合：
    ```sql
    SELECT j.value AS tag, COUNT(*) AS count
    FROM notes, json_each(notes.tags) AS j
    WHERE notes.deleted = false AND notes.user_id = ?
    GROUP BY j.value
    ORDER BY count DESC
    ```

#### 分页
- 笔记列表必须支持分页（默认 30 条/页，最大 100 条）
- 前端无限滚动（距底部 200px 触发 `LOAD_MORE` action）

#### 热力图查询优化
- 仅查询最近 112 天（16 周）的数据
- 使用 SQLite `date()` 函数按日期分组：
  ```sql
  SELECT date(created_at) AS day, COUNT(*) AS count
  FROM notes
  WHERE user_id = ? AND deleted = false
    AND created_at >= date('now', '-112 days')
  GROUP BY day
  ```

### 6.4 兼容性

#### 现有功能兼容性
- 本次为首次实现，无现有功能冲突

#### 跨端兼容性
- **Web**: 使用 Expo Web，基于 React Native Web 编译
- **Android/iOS**: 使用原生 React Native 组件
- **平台差异**：
  - 阴影样式：`Platform.select()` 区分 `shadowColor`（iOS）/ `elevation`（Android）/ `boxShadow`（Web）
  - 键盘快捷键（`⌘K`）：仅 Web 生效，移动端不支持

---

## 7. 不包含（范围边界）

本次设计**明确不涉及**以下功能，防止实现阶段范围蔓延：

1. **Pro 功能实现** — 微信输入、每日回顾、AI 洞察、随机漫步仅保留入口（点击弹浮窗），不实现具体功能
2. **支付系统** — Pro 会员购买浮窗中的「开通 PRO 会员解锁」按钮当前仅关闭浮窗，不对接支付
3. **全文搜索优化** — 当前使用 SQLite `LIKE '%keyword%'`，暂不引入 FTS5 虚拟表（可后续优化）
4. **图片 CDN** — 图片上传后存储在本地 `uploads/` 目录，不对接 OSS/CDN
5. **实时同步** — 多端不实时同步，用户需要手动刷新（WebSocket 留待后续）
6. **离线模式** — 移动端暂不支持离线缓存笔记
7. **数据导出** — 不提供笔记导出为 Markdown/PDF 功能
8. **笔记分享** — 不支持公开链接分享笔记
9. **协作功能** — 不支持多人协作编辑同一笔记
10. **数据库迁移工具** — 不提供从其他笔记应用（Evernote、Notion 等）的导入工具

---

**文档版本**: v1.0
**生成日期**: 2026-03-10
**下一步**: 提交本文档至 `specs/active/` → 团队评审 → 获批后进入实现阶段
