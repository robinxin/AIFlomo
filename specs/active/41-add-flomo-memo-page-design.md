# 技术方案：Flomo 笔记主页面

**关联 Spec**: specs/active/41-add-flomo-memo-page.md
**生成日期**: 2026-03-12

---

<!-- §1 §2：原样复制 architect.md 的完整内容，不得改动 -->

# 技术方案：Flomo 笔记主页面（Issue #41）

> **生成时间**: 2026-03-12
> **来源 Spec**: specs/active/41-add-flomo-memo-page.md
> **阶段**: architect subagent 输出（§1 + §2）

---

## §1 功能概述

### 核心目标

为已登录用户提供一个完整的笔记主页面，覆盖"输入→存储→回看"的完整闭环：快速创建笔记（支持标签、图片、链接）、按时间倒序浏览列表、通过筛选器与标签定位内容、全文搜索、查看统计热力图、软删除至回收站，以及账号登出。

### 系统定位

本功能是整个 AIFlomo 应用的核心业务层，在现有架构基础上新增以下交互维度：

| 维度 | 交互对象 | 说明 |
|------|---------|------|
| 后端路由 | 新增 `apps/server/src/routes/memos.js`、`tags.js`、`attachments.js` | 覆盖笔记 CRUD、标签查询、图片上传 |
| 数据表 | 新增 `memos`、`tags`、`memo_tags`、`attachments` | 见 §2 |
| 已有路由 | `auth.js` 中的 `GET /me`、`POST /logout` | 主页面顶部账号区直接复用 |
| 已有数据表 | `users`（读取 nickname、createdAt 用于统计）、`sessions`（鉴权守卫 requireAuth） | 无需改动 |
| 前端 Context | 新增 `MemoContext`（useReducer 管理笔记列表、筛选状态、搜索词） | 遵循项目 React Context + useReducer 规范 |
| 前端路由 | `app/(tabs)/index.jsx` 或 `app/index.jsx` → 主页面；`app/trash.jsx` → 回收站 | 基于 Expo Router 文件路由 |

### 用户价值

- **低摩擦记录**：输入框默认可见，一次点击即可开始输入，减少记录决策成本
- **即时反馈**：提交后无需刷新，笔记立即出现在列表顶部，统计数字同步更新
- **结构化回看**：标签筛选 + 类型筛选 + 全文搜索三种维度，快速定位历史笔记
- **数据安全**：软删除机制防止误操作，删除内容可通过回收站找回

---

## §2 数据模型变更

### 概述

当前 schema 仅有 `users`、`sessions` 两张表，不含任何笔记相关表。本次需新增四张表：

1. `memos` — 笔记主体
2. `tags` — 标签规范化存储
3. `memo_tags` — 笔记与标签多对多关联
4. `attachments` — 图片附件

---

### 新增表 1：`memos`

```js
export const memos = sqliteTable('memos', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull().default(''),
  hasImage: integer('has_image', { mode: 'boolean' }).notNull().default(false),
  hasLink: integer('has_link', { mode: 'boolean' }).notNull().default(false),
  deletedAt: text('deleted_at').default(null),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});
```

**设计说明**：

- `userId` → `users.id`，`onDelete: 'cascade'`：用户账号删除时笔记联动清除，防止孤儿数据
- `hasImage` / `hasLink`：冗余布尔字段，避免每次筛选时 JOIN `attachments` 或全文扫描 `content`；在写入/更新时由服务层同步维护
- `deletedAt`：软删除时间戳，`null` 表示未删除，非 `null` 表示已进入回收站；所有正常查询加 `WHERE deleted_at IS NULL` 过滤
- `content` 长度由应用层限制 ≤ 10,000 字符（见 CLAUDE.md 安全红线），SQLite `text` 类型本身无长度限制

---

### 新增表 2：`tags`

```js
export const tags = sqliteTable('tags', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});
```

**设计说明**：

- `userId` 范围隔离：标签属于用户私有，不同用户相同标签名彼此独立；`onDelete: 'cascade'` 同上
- `name` 不设全局唯一约束，唯一约束为 `(userId, name)` 组合（在迁移 SQL 中通过 `unique index` 实现，Drizzle 中使用 `uniqueIndex`）
- 标签名合法性（只允许字母、数字、中文、下划线）在服务层写入前校验，不在 schema 层做 CHECK 约束（SQLite CHECK 不支持正则）

---

### 新增表 3：`memo_tags`（多对多关联）

```js
export const memoTags = sqliteTable('memo_tags', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  memoId: text('memo_id')
    .notNull()
    .references(() => memos.id, { onDelete: 'cascade' }),
  tagId: text('tag_id')
    .notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});
```

**设计说明**：

- `memoId` → `memos.id`，`onDelete: 'cascade'`：笔记删除（硬删除或回收站清空）时关联记录自动清除
- `tagId` → `tags.id`，`onDelete: 'cascade'`：标签删除时关联记录自动清除
- `(memoId, tagId)` 组合在迁移时建唯一索引，防止重复关联
- 查询"每个标签的笔记数量"（FR-008）通过 `GROUP BY tag_id COUNT(*)` 在此表上完成，无需扫描全量 memos

---

### 新增表 4：`attachments`

```js
export const attachments = sqliteTable('attachments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  memoId: text('memo_id')
    .notNull()
    .references(() => memos.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull().default('image'),
  url: text('url').notNull(),
  filename: text('filename').notNull().default(''),
  size: integer('size').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});
```

**设计说明**：

- `memoId` → `memos.id`，`onDelete: 'cascade'`：笔记被永久删除时附件记录联动清除；MVP 阶段不做物理文件清理（留给后续 spec）
- `userId` 冗余字段：方便鉴权时直接校验附件归属，无需先查 `memos` 表
- `type` 预留扩展：MVP 阶段仅为 `'image'`，后续可扩展 `'file'`、`'audio'` 等
- `url` 存储文件相对路径或完整 URL；MVP 阶段图片上传至服务器本地 `uploads/` 目录，url 为相对路径，由 Fastify static plugin 提供访问
- `size` 单位为字节，用于后续存储配额控制

---

### 数据关系总览

```
users
  ├── memos        (1:N, userId → users.id)
  ├── tags         (1:N, userId → users.id)
  └── attachments  (1:N, userId → users.id)

memos
  ├── memo_tags    (1:N, memoId → memos.id)
  └── attachments  (1:N, memoId → memos.id)

tags
  └── memo_tags    (1:N, tagId → tags.id)
```

---

### 统计查询说明（无额外表，通过聚合实现）

FR-012（全部笔记数、有标签笔记数、使用天数）和 FR-013（热力图）均通过对 `memos` 表的聚合查询实现，无需新增统计表：

| 统计指标 | 查询来源 |
|---------|---------|
| 全部笔记数 | `COUNT(*) FROM memos WHERE user_id=? AND deleted_at IS NULL` |
| 有标签笔记数 | `COUNT(DISTINCT memo_id) FROM memo_tags JOIN memos WHERE user_id=? AND deleted_at IS NULL` |
| 使用天数 | `COUNT(DISTINCT DATE(created_at)) FROM memos WHERE user_id=? AND deleted_at IS NULL` |
| 热力图（近90天每日数量） | `COUNT(*) GROUP BY DATE(created_at) FROM memos WHERE user_id=? AND created_at >= date('now','-90 days') AND deleted_at IS NULL` |
| 回收站数量 | `COUNT(*) FROM memos WHERE user_id=? AND deleted_at IS NOT NULL` |

---

<!-- §3：原样复制 backend.md 的完整内容，不得改动 -->

## §3 API 端点设计

> 所有端点前缀：`/api`
> 所有端点均需 `preHandler: [requireAuth]`（除非特别说明）
> 统一响应格式：成功 `{ data, message }`，失败 `{ data: null, error, message }`

---

### 3.1 笔记 CRUD — `apps/server/src/routes/memos.js`

---

#### POST /api/memos — 创建笔记

**鉴权**：`preHandler: [requireAuth]`

**请求验证 Schema**：
```js
const createMemoSchema = {
  body: {
    type: 'object',
    required: ['content'],
    properties: {
      content: { type: 'string', minLength: 1, maxLength: 10000 },
    },
  },
};
```

**业务逻辑**：
1. 从 `content` 中用正则 `/#([a-zA-Z0-9\u4e00-\u9fa5_]+)/g` 解析所有标签名
2. 检测 `content` 中是否含 URL（`/https?:\/\//i`），设 `hasLink`
3. 插入 `memos` 表
4. 对每个标签名：查 `tags` 表，不存在则 INSERT，取得 `tagId`，再插入 `memo_tags`
5. 返回完整 memo 对象（含 tags 数组）

**成功响应** `201`：
```json
{
  "data": {
    "id": "uuid",
    "content": "今天学了 #React 和 #Expo",
    "hasImage": false,
    "hasLink": false,
    "deletedAt": null,
    "createdAt": "2026-03-12T10:00:00.000Z",
    "updatedAt": "2026-03-12T10:00:00.000Z",
    "tags": [
      { "id": "uuid", "name": "React" },
      { "id": "uuid", "name": "Expo" }
    ]
  },
  "message": "笔记已创建"
}
```

**失败响应**：
| HTTP 状态码 | error |
|------------|-------|
| 400 | `content 不能为空` / `内容超出 10000 字符限制` |
| 401 | `未登录` |

---

#### GET /api/memos — 获取笔记列表

**鉴权**：`preHandler: [requireAuth]`

**请求验证 Schema**：
```js
const listMemosSchema = {
  querystring: {
    type: 'object',
    properties: {
      page:    { type: 'integer', minimum: 1, default: 1 },
      limit:   { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      tag:     { type: 'string', maxLength: 100 },
      type:    { type: 'string', enum: ['no_tag', 'has_image', 'has_link'] },
      keyword: { type: 'string', maxLength: 200 },
    },
  },
};
```

**业务逻辑**：
1. 基础条件：`WHERE user_id = ? AND deleted_at IS NULL`
2. `tag`：JOIN `memo_tags` + `tags` WHERE `tags.name = ?`
3. `type=no_tag`：NOT EXISTS 子查询 memo_tags
4. `type=has_image`：`AND has_image = 1`
5. `type=has_link`：`AND has_link = 1`
6. `keyword`：`AND content LIKE '%keyword%'`
7. ORDER BY `created_at DESC`，LIMIT/OFFSET 分页
8. 每条 memo 附带 tags 数组（子查询或二次查询）

**成功响应** `200`：
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "content": "今天学了 #React",
        "hasImage": false,
        "hasLink": false,
        "createdAt": "2026-03-12T10:00:00.000Z",
        "tags": [{ "id": "uuid", "name": "React" }]
      }
    ],
    "total": 42,
    "page": 1,
    "limit": 20
  },
  "message": "获取成功"
}
```

**失败响应**：
| HTTP 状态码 | error |
|------------|-------|
| 401 | `未登录` |

---

#### DELETE /api/memos/:id — 软删除笔记（移入回收站）

**鉴权**：`preHandler: [requireAuth]`

**请求验证 Schema**：
```js
const deleteMemoSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 1, maxLength: 36 },
    },
  },
};
```

**业务逻辑**：
1. 查询 memo 确认归属当前用户且 `deleted_at IS NULL`
2. UPDATE `deleted_at = CURRENT_TIMESTAMP`

**成功响应** `200`：
```json
{ "data": null, "message": "笔记已移入回收站" }
```

**失败响应**：
| HTTP 状态码 | error |
|------------|-------|
| 401 | `未登录` |
| 403 | `无权操作此笔记` |
| 404 | `笔记不存在` |

---

#### GET /api/memos/stats — 获取统计数据

**鉴权**：`preHandler: [requireAuth]`

**无请求参数**

**业务逻辑**（聚合查询，见 §2 统计查询说明）：
- `totalMemos`：COUNT WHERE deleted_at IS NULL
- `taggedMemos`：COUNT DISTINCT memo_id FROM memo_tags JOIN memos WHERE deleted_at IS NULL
- `activeDays`：COUNT DISTINCT DATE(created_at) WHERE deleted_at IS NULL
- `trashCount`：COUNT WHERE deleted_at IS NOT NULL

**成功响应** `200`：
```json
{
  "data": {
    "totalMemos": 42,
    "taggedMemos": 18,
    "activeDays": 15,
    "trashCount": 3
  },
  "message": "获取成功"
}
```

**失败响应**：
| HTTP 状态码 | error |
|------------|-------|
| 401 | `未登录` |

---

#### GET /api/memos/heatmap — 获取热力图数据

**鉴权**：`preHandler: [requireAuth]`

**无请求参数**（固定返回近 90 天）

**业务逻辑**：
```sql
SELECT DATE(created_at) as date, COUNT(*) as count
FROM memos
WHERE user_id = ? AND deleted_at IS NULL
  AND created_at >= date('now', '-90 days')
GROUP BY DATE(created_at)
```

**成功响应** `200`：
```json
{
  "data": [
    { "date": "2026-03-12", "count": 3 },
    { "date": "2026-03-11", "count": 1 }
  ],
  "message": "获取成功"
}
```

**失败响应**：
| HTTP 状态码 | error |
|------------|-------|
| 401 | `未登录` |

---

#### GET /api/memos/trash — 获取回收站列表

**鉴权**：`preHandler: [requireAuth]`

**请求验证 Schema**：
```js
const trashSchema = {
  querystring: {
    type: 'object',
    properties: {
      page:  { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
};
```

**业务逻辑**：WHERE `user_id = ? AND deleted_at IS NOT NULL`，ORDER BY `deleted_at DESC`

**成功响应** `200`：
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "content": "已删除的笔记内容",
        "deletedAt": "2026-03-10T08:00:00.000Z",
        "createdAt": "2026-03-09T10:00:00.000Z",
        "tags": []
      }
    ],
    "total": 3,
    "page": 1,
    "limit": 20
  },
  "message": "获取成功"
}
```

**失败响应**：
| HTTP 状态码 | error |
|------------|-------|
| 401 | `未登录` |

---

### 3.2 标签 — `apps/server/src/routes/tags.js`

---

#### GET /api/tags — 获取标签列表（含笔记数）

**鉴权**：`preHandler: [requireAuth]`

**无请求参数**

**业务逻辑**：
```sql
SELECT t.id, t.name, COUNT(mt.memo_id) as memoCount
FROM tags t
LEFT JOIN memo_tags mt ON mt.tag_id = t.id
LEFT JOIN memos m ON m.id = mt.memo_id AND m.deleted_at IS NULL
WHERE t.user_id = ?
GROUP BY t.id
ORDER BY memoCount DESC
```

**成功响应** `200`：
```json
{
  "data": [
    { "id": "uuid", "name": "React", "memoCount": 8 },
    { "id": "uuid", "name": "Expo",  "memoCount": 5 }
  ],
  "message": "获取成功"
}
```

**失败响应**：
| HTTP 状态码 | error |
|------------|-------|
| 401 | `未登录` |

---

### 3.3 图片上传 — `apps/server/src/routes/attachments.js`

---

#### POST /api/attachments/upload — 上传图片

**鉴权**：`preHandler: [requireAuth]`

**Content-Type**：`multipart/form-data`

**请求字段**：
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file` | File | 是 | 图片文件，限 jpeg/png/gif/webp，≤ 5MB |
| `memoId` | string | 否 | 关联的笔记 ID（创建笔记后上传时传入） |

**业务逻辑**：
1. 校验 MIME type 在白名单内（`image/jpeg`、`image/png`、`image/gif`、`image/webp`）
2. 校验文件大小 ≤ 5MB
3. 生成唯一文件名（`uuid + 原始扩展名`），写入 `uploads/` 目录
4. 插入 `attachments` 表，`url` 为相对路径 `/uploads/<filename>`
5. 若传入 `memoId`，UPDATE `memos.has_image = 1`

**成功响应** `201`：
```json
{
  "data": {
    "id": "uuid",
    "url": "/uploads/abc123.jpg",
    "filename": "photo.jpg",
    "size": 204800
  },
  "message": "图片上传成功"
}
```

**失败响应**：
| HTTP 状态码 | error |
|------------|-------|
| 400 | `不支持的文件类型` / `文件大小超过 5MB 限制` |
| 401 | `未登录` |
| 404 | `关联笔记不存在` |

---

### 3.4 已有路由（直接复用，无需修改）

| 路由 | 文件 | 用途 |
|------|------|------|
| `GET /api/auth/me` | `apps/server/src/routes/auth.js` | 主页面顶部显示昵称 |
| `POST /api/auth/logout` | `apps/server/src/routes/auth.js` | 登出操作 |

---

### 3.5 路由注册顺序说明

`memos.js` 中，**静态路径必须在动态路径前注册**，否则 `:id` 会匹配到 `stats`、`heatmap`、`trash`：

```js
// 正确顺序
fastify.get('/stats', ...)
fastify.get('/heatmap', ...)
fastify.get('/trash', ...)
fastify.get('/:id', ...)    // 必须最后注册
fastify.delete('/:id', ...)
```

---

<!-- §4：原样复制 frontend.md 的完整内容，不得改动 -->

## §4 前端页面与组件

---

### 4.1 新增 Screen

| 文件路径 | URL 路径 | 职责 |
|---------|---------|------|
| `apps/mobile/app/memo.jsx` | `/memo` | 笔记主页面（已存在，需完整实现）：输入框、笔记列表、顶部统计、搜索入口 |
| `apps/mobile/app/trash.jsx` | `/trash` | 回收站页面：展示已软删除笔记列表及数量 |

> `app/index.jsx` 已有逻辑：已登录 → Redirect `/memo`，未登录 → Redirect `/login`，无需改动。

---

### 4.2 新增组件

所有组件放在 `apps/mobile/components/` 下，使用具名 export。

---

#### `MemoInput.jsx` — 笔记输入框

**职责**：主页面顶部的笔记输入区域，支持文本输入、标签插入、图片上传触发、发送。

**Props**：
| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `onSubmit` | `(content: string) => Promise<void>` | 是 | 提交笔记回调 |
| `tags` | `Array<{id, name}>` | 是 | 已有标签列表，用于 `#` 联想 |
| `disabled` | `boolean` | 否 | 提交中状态 |

**用户交互**：
- 默认单行显示，点击后展开多行并显示工具栏
- 输入 `#` 时弹出标签联想列表（从 `tags` prop 中过滤）
- 工具栏：`#标签`、图片上传、链接
- 内容为空时发送按钮置灰不可点击（`!!str && ...` 判断，避免空字符串渲染问题）
- 点击发送调用 `onSubmit`，成功后清空输入框

---

#### `MemoCard.jsx` — 单条笔记卡片

**职责**：展示单条笔记内容，含标签高亮、图片缩略图、删除操作。

**Props**：
| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `memo` | `object` | 是 | 笔记对象 `{id, content, tags, hasImage, createdAt}` |
| `onDelete` | `(id: string) => void` | 是 | 软删除回调 |

**用户交互**：
- `#标签名` 以高亮颜色（`#4caf50`）内联展示
- 长按或点击右上角菜单触发删除确认
- 图片以缩略图展示（`hasImage=true` 时从 attachments 获取）

---

#### `MemoList.jsx` — 笔记列表

**职责**：虚拟滚动渲染笔记列表，处理空状态和加载状态。

**Props**：
| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `memos` | `Array` | 是 | 笔记数组 |
| `isLoading` | `boolean` | 是 | 加载状态 |
| `error` | `string\|null` | 否 | 错误信息 |
| `emptyText` | `string` | 否 | 空状态文案，默认 `写下你的第一条想法` |
| `onDelete` | `(id: string) => void` | 是 | 传递给 MemoCard |
| `onLoadMore` | `() => void` | 否 | 触底加载更多 |

**用户交互**：
- 加载中显示骨架屏（3条占位卡片）
- 空状态显示 `emptyText`
- 错误状态显示 `加载失败，点击重试`
- 使用 `FlatList` 实现，`onEndReached` 触发 `onLoadMore`

---

#### `SideNav.jsx` — 左侧导航栏

**职责**：筛选器入口、标签列表、Pro 功能入口、回收站入口。

**Props**：
| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `tags` | `Array<{id, name, memoCount}>` | 是 | 标签列表含数量 |
| `activeFilter` | `string\|null` | 是 | 当前激活筛选 `no_tag\|has_image\|has_link\|tag:<id>` |
| `trashCount` | `number` | 是 | 回收站笔记数量 |
| `onFilterChange` | `(filter: string\|null) => void` | 是 | 切换筛选回调 |

**用户交互**：
- 快速筛选器（无标签、有图片、有链接）：点击高亮，再次点击取消
- 标签列表超过 5 个时折叠，显示「展开全部」
- 点击 Pro 功能入口（微信输入、每日回顾、AI 洞察、随机漫步）弹出 `ProModal`
- 点击回收站跳转 `/trash`，角标显示 `trashCount`

---

#### `StatsBar.jsx` — 顶部统计栏

**职责**：展示用户昵称、全部笔记数、有标签笔记数、使用天数。

**Props**：
| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `nickname` | `string` | 是 | 登录用户昵称 |
| `stats` | `{totalMemos, taggedMemos, activeDays}` | 是 | 统计数据 |
| `onLogout` | `() => void` | 是 | 登出回调 |

---

#### `HeatmapCalendar.jsx` — 热力图日历

**职责**：展示近 90 天每日笔记数量热力图。

**Props**：
| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `data` | `Array<{date: string, count: number}>` | 是 | 热力图数据 |

**用户交互**：
- 每格代表一天，颜色深浅映射笔记数（0条最浅 `#e8f5e9`，≥5条最深 `#1b5e20`）
- 点击某天格子显示当天笔记数 tooltip

---

#### `SearchBar.jsx` — 搜索栏

**职责**：全文搜索输入，触发实时筛选。

**Props**：
| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `value` | `string` | 是 | 搜索词 |
| `onChangeText` | `(text: string) => void` | 是 | 输入回调 |
| `onClear` | `() => void` | 是 | 清空搜索回调 |

---

#### `ProModal.jsx` — Pro 会员浮窗

**职责**：点击 Pro 功能入口时展示的购买引导浮窗。

**Props**：
| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `visible` | `boolean` | 是 | 是否显示 |
| `onClose` | `() => void` | 是 | 关闭回调 |

**用户交互**：点击遮罩层或关闭按钮调用 `onClose`，MVP 阶段无实际支付逻辑。

---

### 4.3 Context / Reducer 变更

#### 新增：`apps/mobile/context/MemoContext.jsx`

**State 结构**：
```js
const initialState = {
  memos: [],          // 当前展示的笔记列表（已应用筛选/搜索）
  allMemos: [],       // 全量笔记缓存（前端搜索使用）
  tags: [],           // 标签列表 [{id, name, memoCount}]
  stats: {
    totalMemos: 0,
    taggedMemos: 0,
    activeDays: 0,
    trashCount: 0,
  },
  heatmap: [],        // [{date, count}]
  activeFilter: null, // 'no_tag' | 'has_image' | 'has_link' | 'tag:<id>' | null
  keyword: '',        // 搜索关键字
  page: 1,
  hasMore: true,
  isLoading: false,
  isSubmitting: false,
  error: null,
};
```

**Action Types**：
| Action Type | Payload | 说明 |
|-------------|---------|------|
| `FETCH_MEMOS_START` | — | 开始加载列表 |
| `FETCH_MEMOS_SUCCESS` | `{items, total, page}` | 加载成功，追加或替换列表 |
| `FETCH_MEMOS_ERROR` | `string` | 加载失败 |
| `CREATE_MEMO_START` | — | 开始提交 |
| `CREATE_MEMO_SUCCESS` | `memo` | 新笔记插入列表顶部，更新统计 |
| `CREATE_MEMO_ERROR` | `string` | 提交失败 |
| `DELETE_MEMO_SUCCESS` | `id` | 从列表中移除，trashCount++ |
| `SET_FILTER` | `string\|null` | 设置筛选条件，重置列表 |
| `SET_KEYWORD` | `string` | 设置搜索词，前端实时过滤 |
| `FETCH_TAGS_SUCCESS` | `tags[]` | 更新标签列表 |
| `FETCH_STATS_SUCCESS` | `stats` | 更新统计数据 |
| `FETCH_HEATMAP_SUCCESS` | `heatmap[]` | 更新热力图数据 |

---

### 4.4 自定义 Hook

#### `apps/mobile/hooks/use-memos.js`

**职责**：封装 MemoContext 操作，提供给 Screen 层调用。

**入参**：无

**返回值**：
```js
{
  memos,          // 当前列表
  tags,           // 标签列表
  stats,          // 统计数据
  heatmap,        // 热力图数据
  activeFilter,   // 当前筛选
  keyword,        // 搜索词
  isLoading,
  isSubmitting,
  error,
  hasMore,
  fetchMemos,     // () => Promise<void>  — 加载/重新加载列表
  loadMore,       // () => Promise<void>  — 加载下一页
  createMemo,     // (content: string) => Promise<void>
  deleteMemo,     // (id: string) => Promise<void>
  setFilter,      // (filter: string|null) => void
  setKeyword,     // (keyword: string) => void
  fetchTags,      // () => Promise<void>
  fetchStats,     // () => Promise<void>
  fetchHeatmap,   // () => Promise<void>
}
```

---

### 4.5 用户交互流程

#### 新建笔记流程

```
用户进入 /memo
  → StatsBar 展示昵称 + 统计
  → MemoInput 展示单行输入框（placeholder: "现在的想法是..."）
  → MemoList 展示笔记列表（倒序）

用户点击输入框
  → 展开多行，工具栏出现（#标签 / 图片 / 链接）

用户输入 "#React 今天学习笔记"
  → 输入 "#" 时 TagSuggest 浮层展示已有标签
  → 选择标签后补全标签名

用户点击发送
  → isSubmitting=true，发送按钮 Loading
  → POST /api/memos {content}
  → 成功：新 memo 插入列表顶部，输入框清空，stats 更新
  → 失败：Toast 提示"提交失败，请重试"，内容保留
```

#### 筛选流程

```
用户点击 SideNav "有图片"
  → SET_FILTER('has_image')
  → 重置列表，GET /api/memos?type=has_image
  → 筛选器高亮，列表只显示含图片笔记

用户再次点击"有图片"
  → SET_FILTER(null)
  → 恢复全量列表
```

#### 搜索流程（前端实时过滤）

```
用户点击顶部搜索图标
  → SearchBar 展开，键盘弹起

用户输入关键字
  → SET_KEYWORD('keyword')
  → 前端从 allMemos 中实时过滤 content.includes(keyword)
  → 结果为空显示"未找到相关笔记"

用户清空搜索框
  → SET_KEYWORD('')
  → 恢复显示全部笔记
```

---

### 4.6 调用的 API 端点

| Screen / Hook | Method | Path | 关键请求字段 | 关键响应字段 |
|--------------|--------|------|------------|------------|
| `use-memos` 初始化 | GET | `/api/memos` | `page, limit` | `items[], total` |
| `use-memos` 创建 | POST | `/api/memos` | `content` | `memo object` |
| `use-memos` 删除 | DELETE | `/api/memos/:id` | — | — |
| `use-memos` 标签 | GET | `/api/tags` | — | `[{id, name, memoCount}]` |
| `use-memos` 统计 | GET | `/api/memos/stats` | — | `{totalMemos, taggedMemos, activeDays, trashCount}` |
| `use-memos` 热力图 | GET | `/api/memos/heatmap` | — | `[{date, count}]` |
| `trash.jsx` | GET | `/api/memos/trash` | `page, limit` | `items[], total` |
| `MemoInput` 图片 | POST | `/api/attachments/upload` | `file (multipart)` | `{id, url}` |
| `StatsBar` 登出 | POST | `/api/auth/logout` | — | — |

---

## §5 改动文件清单

```
新增:
  后端:
    - apps/server/src/routes/memos.js        — 笔记 CRUD（创建、列表、软删除、统计、热力图、回收站）
    - apps/server/src/routes/tags.js         — 标签列表（含笔记数）
    - apps/server/src/routes/attachments.js  — 图片上传

  前端:
    - apps/mobile/app/trash.jsx              — 回收站页面（/trash）
    - apps/mobile/context/MemoContext.jsx    — 笔记状态管理（useReducer）
    - apps/mobile/hooks/use-memos.js         — 封装 MemoContext 操作的自定义 Hook
    - apps/mobile/components/MemoInput.jsx   — 笔记输入框组件
    - apps/mobile/components/MemoCard.jsx    — 单条笔记卡片组件
    - apps/mobile/components/MemoList.jsx    — 笔记列表组件（FlatList + 空/加载/错误状态）
    - apps/mobile/components/SideNav.jsx     — 左侧导航栏（筛选器、标签、Pro 入口、回收站）
    - apps/mobile/components/StatsBar.jsx    — 顶部统计栏（昵称、笔记数、天数）
    - apps/mobile/components/HeatmapCalendar.jsx — 近 90 天热力图日历
    - apps/mobile/components/SearchBar.jsx   — 搜索输入框组件
    - apps/mobile/components/ProModal.jsx    — Pro 会员购买引导浮窗

修改:
  后端:
    - apps/server/src/db/schema.js           — 新增 memos、tags、memo_tags、attachments 四张表
    - apps/server/src/index.js               — 注册 memos、tags、attachments 路由插件

  前端:
    - apps/mobile/app/memo.jsx               — 完整实现主页面（当前为占位页面，需全量重写）
    - apps/mobile/app/_layout.jsx            — 将 MemoProvider 包裹到路由树中
```

---

## §6 技术约束与风险

**输入校验**：
- `content`：前端 `minLength=1`（发送按钮置灰），后端 Schema `minLength: 1, maxLength: 10000`
- 标签名：前后端均用正则 `/^[a-zA-Z0-9\u4e00-\u9fa5_]+$/` 校验，拒绝包含特殊字符的标签
- 图片：前端限制 MIME 类型和文件大小（≤5MB），后端 `@fastify/multipart` 再次校验，防止绕过
- 分页参数：`page ≥ 1`，`limit 1–100`，防止超大查询

**安全**：
- 所有笔记路由均需 `requireAuth`，服务层查询时强制追加 `WHERE user_id = ?`，防止越权访问他人数据
- `content` 纯文本存储，前端使用 `<Text>` 组件渲染，不使用 `dangerouslySetInnerHTML`，无 XSS 风险
- 图片上传后 URL 为相对路径，文件名使用 `uuid` 生成，防止路径遍历攻击

**性能**：
- `GET /api/memos` 含 `tag` 筛选时需 JOIN `memo_tags` + `tags`，应在 `memo_tags(tag_id)` 和 `memos(user_id, deleted_at, created_at)` 上建索引
- 搜索（`keyword`）使用 `LIKE '%keyword%'` 全表扫描，数据量小时可接受；数据量大时考虑 SQLite FTS5
- `GET /api/memos/stats` 涉及多个 COUNT 聚合，建议合并为单次多子查询，避免多次往返数据库
- 前端搜索为本地过滤（`allMemos.filter`），需在初始化时加载全量笔记（或分批加载），笔记量大时需切换为服务端搜索

**兼容性**：
- `MemoContext` 需在 `_layout.jsx` 中包裹，确保 `trash.jsx` 等子路由也能访问 `trashCount`
- Expo Router 文件路由：`trash.jsx` 必须放在 `app/` 目录下，确保路径 `/trash` 可访问
- React Native `<View>` 直接子节点不得使用 `{str && <Text>}` 模式（`str=''` 时渲染空字符串报错），一律改用 `{!!str && <Text>}`

---

## §7 不包含（范围边界）

本次设计**不涉及**以下功能，防止实现阶段范围蔓延：

1. **笔记编辑**：创建后不支持修改笔记内容（编辑功能在独立 spec 中定义）
2. **回收站恢复/永久删除**：回收站页面只展示已删除笔记，恢复和永久删除操作在 spec #42 中定义
3. **真实支付流程**：Pro 会员浮窗为 MVP 占位，不接入任何支付 SDK 或后端购买逻辑
4. **推送通知**：每日回顾、AI 洞察等 Pro 功能不实现推送，仅展示浮窗引导
5. **多媒体附件（非图片）**：MVP 阶段只支持图片上传，文件/音频留给后续版本
6. **物理文件清理**：软删除或回收站清空时不删除 `uploads/` 目录中的实际文件
7. **SQLite FTS 全文索引**：搜索使用 `LIKE` 实现，不引入 FTS5 虚拟表
