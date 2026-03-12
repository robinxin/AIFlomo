# 技术方案：创建笔记与笔记列表（第一版）

**关联 Spec**: `specs/active/45-create-memo-and-memo-list-1.md`
**关联 Issue**: #45
**Feature Branch**: `feat/45-create-memo-and-memo-list-1`
**生成日期**: 2026-03-12
**状态**: 草稿

---

## §1 功能概述

### 核心目标

为 AIFlomo 实现"输入 → 存储 → 回看"最小闭环：用户登录后可创建纯文本笔记，可选附加标签和图片，并通过三种分类视图（全部笔记、有标签、有图片）浏览自己的笔记，同时支持查看全部标签及其笔记计数。

### 在系统中的定位

本次功能是整个应用的**核心业务层**，属于从零构建阶段（项目目前无 `apps/server` 和 `apps/mobile` 子包）。涉及以下新增交互点：

| 层 | 新增内容 | 说明 |
|----|---------|------|
| 后端路由 | `POST /api/memos` | 创建笔记（含标签关联、图片元数据） |
| 后端路由 | `GET /api/memos` | 获取笔记列表，支持分类筛选（`filter` 参数：`all` / `tagged` / `with-images`）、分页 |
| 后端路由 | `GET /api/tags` | 获取当前用户全部标签及每个标签的笔记计数 |
| 后端路由 | `GET /api/memos?tagId=:id` | 获取特定标签下的笔记列表 |
| 数据库 | `users` / `memos` / `tags` / `memo_tags` / `memo_images` | 五张新增表（详见 §2） |
| 前端 Context | `MemoContext.jsx` | 全局笔记状态（列表、当前分类、加载状态、错误） |
| 前端 Context | `TagContext.jsx` | 全局标签状态（标签列表、笔记计数） |
| 前端路由 | `app/(app)/index.jsx` | 主界面（输入框 + 分类标签页 + 笔记列表） |
| 前端路由 | `app/(app)/tags/index.jsx` | 全部标签列表页 |
| 前端路由 | `app/(app)/tags/[id].jsx` | 特定标签的笔记列表页（动态路由） |

本功能依赖认证系统（Session Cookie），所有笔记 API 均需 `preHandler: [requireAuth]`，后端通过 `request.session.userId` 确定数据归属。图片功能（P3）依赖文件上传能力，需额外注册 `@fastify/multipart` 插件。

### 用户价值

- **解决的问题**：无结构的想法难以快速捕捉和事后检索。
- **体验提升**：从打开应用到完成一条笔记记录不超过 30 秒；标签和图片分类让笔记回看效率显著提升；空状态引导降低首次使用门槛。

---

## §2 数据模型变更

### 概述

本次从零新增 **5 张表**：`users`（用户）、`memos`（笔记）、`tags`（标签）、`memo_tags`（笔记-标签多对多关联）、`memo_images`（笔记图片）。

### 完整 Schema（可直接复制到 `apps/server/src/db/schema.js`）

```js
// apps/server/src/db/schema.js
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── users ───────────────────────────────────────────────────────────────────
// 系统注册用户。认证模块依赖此表，其他所有业务表通过 userId 外键关联到此表。
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

// ─── memos ───────────────────────────────────────────────────────────────────
// 核心业务实体。content 限制在 10,000 字符以内（由路由层 JSON Schema 校验）。
// onDelete: 'cascade' — 用户账号删除时，其所有笔记随之删除，避免孤儿数据。
export const memos = sqliteTable('memos', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  content: text('content').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

// ─── tags ────────────────────────────────────────────────────────────────────
// 标签归属于具体用户（不同用户可拥有同名标签，互不干扰）。
// name 字段格式约束（中英文、数字、下划线，2-20 字符）由路由层 JSON Schema 校验。
// onDelete: 'cascade' — 用户账号删除时，其所有标签随之删除。
// 注意：tags 表不存储 memoCount，计数通过查询 memo_tags 实时聚合，避免数据不一致。
export const tags = sqliteTable('tags', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

// ─── memo_tags ───────────────────────────────────────────────────────────────
// 笔记与标签的多对多关联表。一条笔记可有多个标签，一个标签可关联多条笔记。
// memoId onDelete: 'cascade' — 笔记删除时，关联记录随之删除。
// tagId  onDelete: 'cascade' — 标签删除时，关联记录随之删除（笔记本身保留）。
// 联合主键（memoId + tagId）由应用层保证唯一性（插入前先查询）；
// SQLite 不直接支持在 Drizzle sqliteTable 中声明复合主键约束，
// 唯一性通过路由层"先查后写"逻辑保障。
export const memoTags = sqliteTable('memo_tags', {
  memoId: text('memo_id')
    .notNull()
    .references(() => memos.id, { onDelete: 'cascade' }),
  tagId: text('tag_id')
    .notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
});

// ─── memo_images ─────────────────────────────────────────────────────────────
// 笔记附图元数据。图片二进制内容存储在服务器文件系统（或后续对象存储），
// 此表仅保存 URL 路径和文件元数据，供前端渲染缩略图使用。
// 单条笔记最多 9 张图片，由路由层业务逻辑校验（查询当前笔记已有图片数）。
// fileSize 单位为字节，5MB 上限 = 5 * 1024 * 1024 = 5242880 字节，由路由层校验。
// mimeType 记录图片格式（image/jpeg / image/png / image/gif），由路由层白名单校验。
// onDelete: 'cascade' — 笔记删除时，其所有图片元数据随之删除。
export const memoImages = sqliteTable('memo_images', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  memoId: text('memo_id')
    .notNull()
    .references(() => memos.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: text('mime_type').notNull(),
  uploadedAt: text('uploaded_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});
```

### 设计说明

#### `.references()` 与 `onDelete` 策略选择

| 外键 | 策略 | 理由 |
|------|------|------|
| `memos.userId → users.id` | `cascade` | 用户数据属于用户，账号注销后无需保留笔记 |
| `tags.userId → users.id` | `cascade` | 同上，标签也是用户私有数据 |
| `memo_tags.memoId → memos.id` | `cascade` | 笔记删除时，其标签关联也应清除；标签本身保留 |
| `memo_tags.tagId → tags.id` | `cascade` | 标签删除时，清除其关联关系；笔记本身保留 |
| `memo_images.memoId → memos.id` | `cascade` | 笔记删除时，图片元数据随之删除（图片文件由后台任务清理） |

#### 标签计数不存储于 `tags` 表的理由

spec 中"查看全部标签及笔记数"（FR-005）要求实时准确的计数。若在 `tags` 表增加 `memoCount` 字段，每次创建/删除笔记标签关联时都需同步更新，存在并发写入不一致的风险。采用**聚合查询**（`COUNT` + `GROUP BY`）从 `memo_tags` 实时计算，在 SQLite 单机 MVP 阶段性能完全满足需求（标签数量不超过数千条），且数据始终准确。

#### `updatedAt` 仅存在于 `memos` 表

根据 spec，MVP 阶段不支持笔记编辑（SC 假设清单第 8 条），`updatedAt` 预留字段为后续版本扩展使用，创建时与 `createdAt` 值相同。`tags` 和 `memo_images` 无需此字段。

#### 图片存储架构定位

`memo_images` 表仅存储元数据（URL、大小、类型）。MVP 阶段图片文件存储在服务器本地文件系统（`/uploads/` 目录），URL 格式为相对路径（如 `/uploads/images/<uuid>.jpg`）。此设计解耦了存储后端，后续迁移到对象存储（OSS/S3）时只需修改上传逻辑和 URL 前缀，数据表结构无需变更。

---

## §3 API 端点设计

### 设计原则

- 所有端点均需鉴权：`preHandler: [requireAuth]`，通过 `request.session.userId` 获取当前用户 ID
- 请求验证使用 Fastify 原生 JSON Schema，无需额外依赖
- 成功响应统一格式：`{ data: value, message: string }`
- 失败响应统一格式：`{ data: null, error: string, message: string }`
- 分页列表响应的 `data` 字段包含子字段：`{ memos: [...], total, page, limit }`
- 错误由全局 `setErrorHandler` 统一处理（抛出 `AppError` 子类）

---

### 3.1 创建笔记

**路径 + HTTP 方法**

```
POST /api/memos
```

**对应文件路径**

```
apps/server/src/routes/memos.js
```

**鉴权**

```js
preHandler: [requireAuth]
```

**请求验证（JSON Schema）**

```js
const createMemoSchema = {
  body: {
    type: 'object',
    required: ['content'],
    properties: {
      content: {
        type: 'string',
        minLength: 1,
        maxLength: 10000,
      },
      tagNames: {
        type: 'array',
        items: {
          type: 'string',
          minLength: 2,
          maxLength: 20,
          pattern: '^[\\u4e00-\\u9fa5a-zA-Z0-9_]+$',
        },
        maxItems: 50,
        uniqueItems: true,
      },
      imageUrls: {
        type: 'array',
        items: {
          type: 'string',
          format: 'uri',
        },
        maxItems: 9,
      },
    },
    additionalProperties: false,
  },
};
```

**业务逻辑说明**

- `tagNames`（可选）：标签名称数组，标签名仅允许中英文、数字、下划线，长度 2-20 字符
  - 若标签不存在则自动创建（INSERT INTO tags）
  - 若标签已存在则复用（查询后取 id）
  - 创建 memo 后在 `memo_tags` 表中插入关联记录
- `imageUrls`（可选）：图片 URL 数组（由文件上传接口返回），最多 9 项
  - 创建 memo 后在 `memo_images` 表中批量插入元数据
  - MVP 阶段图片先由 `POST /api/uploads` 上传，返回 URL 后再创建 memo（本接口不处理文件上传）

**成功响应示例（HTTP 201）**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "content": "今天学到的新概念",
    "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "createdAt": "2026-03-12T08:00:00.000Z",
    "updatedAt": "2026-03-12T08:00:00.000Z",
    "tags": [
      {
        "id": "tag-uuid-1",
        "name": "工作"
      }
    ],
    "images": []
  },
  "message": "创建成功"
}
```

**失败响应清单**

| HTTP 状态码 | error 字段 | 触发场景 |
|------------|-----------|---------|
| 400 | `VALIDATION_ERROR` | content 为空、超过 10000 字符、tagNames 格式非法、imageUrls 超过 9 项 |
| 401 | `Unauthorized` | 用户未登录（session 中无 userId） |
| 500 | `INTERNAL_ERROR` | 数据库写入异常 |

---

### 3.2 获取笔记列表

**路径 + HTTP 方法**

```
GET /api/memos
```

**对应文件路径**

```
apps/server/src/routes/memos.js
```

**鉴权**

```js
preHandler: [requireAuth]
```

**请求验证（JSON Schema）**

```js
const getMemoListSchema = {
  querystring: {
    type: 'object',
    properties: {
      filter: {
        type: 'string',
        enum: ['all', 'tagged', 'with-images'],
        default: 'all',
      },
      tagId: {
        type: 'string',
      },
      page: {
        type: 'integer',
        minimum: 1,
        default: 1,
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 20,
      },
    },
    additionalProperties: false,
  },
};
```

**Query 参数说明**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `filter` | string | `all` | 分类筛选：`all`（全部笔记）/ `tagged`（有标签笔记）/ `with-images`（有图片笔记） |
| `tagId` | string | — | 按特定标签 ID 筛选（与 filter 互斥，tagId 优先） |
| `page` | integer | `1` | 当前页码，从 1 开始 |
| `limit` | integer | `20` | 每页条数，最大 100 |

**业务逻辑说明**

- `filter=all`：查询当前用户全部笔记，按 `createdAt` 倒序
- `filter=tagged`：仅返回在 `memo_tags` 中有关联记录的笔记（JOIN memo_tags）
- `filter=with-images`：仅返回在 `memo_images` 中有关联记录的笔记（JOIN memo_images）
- `tagId` 存在时：忽略 `filter` 参数，仅返回关联该标签的笔记
- 每条笔记需关联查询其 tags 和 images，以聚合形式返回
- `total` 为满足条件的总记录数（用于前端分页计算）

**成功响应示例（HTTP 200）**

```json
{
  "data": {
    "memos": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "content": "今天学到的新概念",
        "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "createdAt": "2026-03-12T08:00:00.000Z",
        "updatedAt": "2026-03-12T08:00:00.000Z",
        "tags": [
          { "id": "tag-uuid-1", "name": "工作" }
        ],
        "images": []
      }
    ],
    "total": 42,
    "page": 1,
    "limit": 20
  },
  "message": "ok"
}
```

**失败响应清单**

| HTTP 状态码 | error 字段 | 触发场景 |
|------------|-----------|---------|
| 400 | `VALIDATION_ERROR` | filter 值非枚举值、page/limit 超出范围 |
| 401 | `Unauthorized` | 用户未登录 |
| 500 | `INTERNAL_ERROR` | 数据库查询异常 |

---

### 3.3 删除笔记

**路径 + HTTP 方法**

```
DELETE /api/memos/:id
```

**对应文件路径**

```
apps/server/src/routes/memos.js
```

**鉴权**

```js
preHandler: [requireAuth]
```

**请求验证（JSON Schema）**

```js
const deleteMemoSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        minLength: 1,
      },
    },
  },
};
```

**业务逻辑说明**

- 先查询笔记是否存在（`SELECT FROM memos WHERE id = :id`）
  - 不存在则抛出 `NotFoundError('Memo')`
- 校验笔记归属（`memo.userId === request.session.userId`）
  - 不匹配则抛出 `ForbiddenError()`
- 执行删除：由于 `memo_tags` 和 `memo_images` 外键均设置 `onDelete: 'cascade'`，关联记录自动级联删除
- 成功响应 204，无响应 body

**成功响应（HTTP 204）**

```
（无响应体）
```

**失败响应清单**

| HTTP 状态码 | error 字段 | 触发场景 |
|------------|-----------|---------|
| 401 | `Unauthorized` | 用户未登录 |
| 403 | `FORBIDDEN` | 笔记不属于当前用户 |
| 404 | `NOT_FOUND` | 笔记 ID 不存在 |
| 500 | `INTERNAL_ERROR` | 数据库删除异常 |

---

### 3.4 获取全部标签及笔记数

**路径 + HTTP 方法**

```
GET /api/tags
```

**对应文件路径**

```
apps/server/src/routes/tags.js
```

**鉴权**

```js
preHandler: [requireAuth]
```

**请求验证（JSON Schema）**

```js
const getTagsSchema = {
  querystring: {
    type: 'object',
    properties: {
      sortBy: {
        type: 'string',
        enum: ['name', 'createdAt', 'memoCount'],
        default: 'createdAt',
      },
    },
    additionalProperties: false,
  },
};
```

**业务逻辑说明**

- 查询当前用户所有标签，并通过聚合查询（`COUNT` + `LEFT JOIN memo_tags`）实时计算每个标签的笔记数
- `memoCount` 为该标签下关联的笔记数量（可能为 0）
- 默认按 `createdAt` 倒序排列
- 笔记数为 0 的标签仍然返回（不自动过滤空标签）

**成功响应示例（HTTP 200）**

```json
{
  "data": [
    {
      "id": "tag-uuid-1",
      "name": "工作",
      "createdAt": "2026-03-01T10:00:00.000Z",
      "memoCount": 8
    },
    {
      "id": "tag-uuid-2",
      "name": "阅读",
      "createdAt": "2026-03-05T14:30:00.000Z",
      "memoCount": 5
    },
    {
      "id": "tag-uuid-3",
      "name": "灵感",
      "createdAt": "2026-03-10T09:15:00.000Z",
      "memoCount": 0
    }
  ],
  "message": "ok"
}
```

**失败响应清单**

| HTTP 状态码 | error 字段 | 触发场景 |
|------------|-----------|---------|
| 401 | `Unauthorized` | 用户未登录 |
| 500 | `INTERNAL_ERROR` | 数据库查询异常 |

---

### 3.5 按标签筛选笔记

**路径 + HTTP 方法**

```
GET /api/tags/:tagId/memos
```

**对应文件路径**

```
apps/server/src/routes/tags.js
```

**鉴权**

```js
preHandler: [requireAuth]
```

**请求验证（JSON Schema）**

```js
const getTagMemosSchema = {
  params: {
    type: 'object',
    required: ['tagId'],
    properties: {
      tagId: {
        type: 'string',
        minLength: 1,
      },
    },
  },
  querystring: {
    type: 'object',
    properties: {
      page: {
        type: 'integer',
        minimum: 1,
        default: 1,
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 20,
      },
    },
    additionalProperties: false,
  },
};
```

**业务逻辑说明**

- 先验证标签存在且属于当前用户（`SELECT FROM tags WHERE id = :tagId AND userId = :userId`）
  - 不存在则抛出 `NotFoundError('Tag')`
  - 不属于当前用户则抛出 `ForbiddenError()`
- 通过 `memo_tags` 关联查询该标签下的所有笔记，按 `createdAt` 倒序排列
- 每条笔记需关联返回其完整 tags 和 images 列表
- 支持分页（page / limit）

**成功响应示例（HTTP 200）**

```json
{
  "data": {
    "memos": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "content": "阅读笔记：《原则》第三章",
        "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "createdAt": "2026-03-12T08:00:00.000Z",
        "updatedAt": "2026-03-12T08:00:00.000Z",
        "tags": [
          { "id": "tag-uuid-2", "name": "阅读" },
          { "id": "tag-uuid-3", "name": "灵感" }
        ],
        "images": []
      }
    ],
    "total": 5,
    "page": 1,
    "limit": 20
  },
  "message": "ok"
}
```

**失败响应清单**

| HTTP 状态码 | error 字段 | 触发场景 |
|------------|-----------|---------|
| 401 | `Unauthorized` | 用户未登录 |
| 403 | `FORBIDDEN` | 标签不属于当前用户 |
| 404 | `NOT_FOUND` | 标签 ID 不存在 |
| 500 | `INTERNAL_ERROR` | 数据库查询异常 |

---

### 3.6 路由注册汇总

```
apps/server/src/
├── routes/
│   ├── memos.js    # 处理 /api/memos 相关路由
│   └── tags.js     # 处理 /api/tags 相关路由
```

在 `src/index.js` 中注册：

```js
await app.register(memoRoutes, { prefix: '/api/memos' });
await app.register(tagRoutes, { prefix: '/api/tags' });
```

完整路由映射表：

| HTTP 方法 | 路径 | 功能 | 文件 | 鉴权 |
|----------|------|------|------|------|
| POST | `/api/memos` | 创建笔记 | `routes/memos.js` | 是 |
| GET | `/api/memos` | 获取笔记列表（含分页/筛选） | `routes/memos.js` | 是 |
| DELETE | `/api/memos/:id` | 删除指定笔记 | `routes/memos.js` | 是 |
| GET | `/api/tags` | 获取全部标签及笔记数 | `routes/tags.js` | 是 |
| GET | `/api/tags/:tagId/memos` | 获取指定标签下的笔记列表 | `routes/tags.js` | 是 |

---

### 3.7 错误类映射

路由层通过 `throw` 抛出，由 `src/index.js` 全局 `setErrorHandler` 统一处理：

```js
import { NotFoundError, ForbiddenError } from '../lib/errors.js';

// 笔记不存在
throw new NotFoundError('Memo');

// 标签不存在
throw new NotFoundError('Tag');

// 无权限（笔记或标签不属于当前用户）
throw new ForbiddenError();
```

错误类定义参考 `apps/server/src/lib/errors.js`（`AppError` / `NotFoundError` / `ForbiddenError`）。

---

### 3.8 安全约束

- **内容长度限制**：memo content 通过 JSON Schema `maxLength: 10000` 在路由层拦截，不依赖数据库约束
- **标签名格式**：通过 JSON Schema `pattern: '^[\\u4e00-\\u9fa5a-zA-Z0-9_]+$'` 校验，仅允许中英文、数字、下划线
- **用户数据隔离**：所有查询均携带 `WHERE userId = :userId` 条件，防止越权访问
- **图片数量限制**：`imageUrls` 数组通过 JSON Schema `maxItems: 9` 限制
- **分页上限**：`limit` 最大值为 100，防止单次查询过多数据
- **SQL 注入防护**：全程使用 Drizzle ORM 参数化查询，禁止原生 SQL 字符串拼接

---

## §4 前端页面与组件设计

### 4.1 新增 Screen（页面路由）

所有页面文件位于 `apps/mobile/app/` 下，遵循 Expo Router 文件路由约定。

---

#### 4.1.1 主界面（创建笔记 + 笔记列表）

**文件路径**: `apps/mobile/app/(app)/index.jsx`
**URL 路径**: `/`（登录后默认落地页）
**导出方式**: `export default`

**职责**:
主界面整合"输入区"与"列表区"两个核心功能区域。页面顶部为分类 Tab 切换，Tab 下方为对应分类的笔记列表，页面底部固定为输入区（输入框 + 工具栏）。

**页面结构（从上到下）**:
```
[顶部导航栏]        — 应用标题 "AIFlomo"，右侧可放"全部标签"入口图标
[分类 Tab 栏]      — "全部笔记" | "有标签" | "有图片"（三个 Tab）
[笔记列表区]        — FlatList，显示对应分类的笔记卡片，支持上滑加载更多
[固定底部输入区]    — 输入框 + 标签按钮 + 图片按钮 + 字数统计 + 发布按钮
```

**调用的 API 端点**:
- `GET /api/memos?filter=all&page=1&limit=20` — 初始加载全部笔记列表
- `GET /api/memos?filter=tagged&page=1&limit=20` — "有标签"分类
- `GET /api/memos?filter=with-images&page=1&limit=20` — "有图片"分类
- `POST /api/memos` — 创建笔记（含 tagNames 数组和图片 URL）
- `GET /api/tags` — 加载已有标签列表（TagPicker 弹层打开时）

---

#### 4.1.2 全部标签列表页面

**文件路径**: `apps/mobile/app/(app)/tags/index.jsx`
**URL 路径**: `/tags`
**导出方式**: `export default`

**职责**:
展示当前登录用户的所有标签，每个标签显示名称与笔记数量，支持点击跳转到该标签的笔记列表页。

**调用的 API 端点**:
- `GET /api/tags` — 获取全部标签及笔记计数（后端聚合查询 memo_tags）

---

#### 4.1.3 标签笔记列表页面（动态路由）

**文件路径**: `apps/mobile/app/(app)/tags/[id].jsx`
**URL 路径**: `/tags/:id`（动态路由，`:id` 为标签 UUID）
**导出方式**: `export default`

**职责**:
展示特定标签下的所有笔记，笔记按创建时间倒序排列，支持无限滚动分页加载。

**调用的 API 端点**:
- `GET /api/memos?tagId=:id&page=:page&limit=20` — 获取特定标签下的笔记列表（分页）

**API 路径备注**：前端选择使用 `GET /api/memos?tagId=xxx` 而非 `GET /api/tags/:tagId/memos`。两个端点功能等价，前端统一使用 `GET /api/memos` 简化 API client 逻辑。

---

### 4.2 新增组件

所有通用组件位于 `apps/mobile/components/`，使用具名 `export`，文件名用 PascalCase。

**新增组件清单**:
1. `MemoCard.jsx` — 笔记卡片（显示内容、标签、图片缩略图、时间）
2. `TagPicker.jsx` — 标签选择弹层（显示已有标签 + 新增标签输入框）
3. `ImagePickerInput.jsx` — 图片选择组件（本地相册选择 + 预览 + 删除）
4. `EmptyState.jsx` — 通用空状态组件
5. `ErrorState.jsx` — 通用错误状态组件

---

### 4.3 Context/Reducer 变更

---

#### 4.3.1 MemoContext.jsx

**文件路径**: `apps/mobile/context/MemoContext.jsx`
**这是新建文件**（项目目前无任何前端代码）

**状态结构**:
```js
const initialState = {
  memos: [],               // 当前分类下的笔记列表
  currentPage: 1,          // 分页信息
  hasMore: true,
  activeFilter: 'all',     // 当前激活的分类 Tab: 'all' | 'tagged' | 'with-images'
  isLoading: false,        // 异步状态
  isLoadingMore: false,
  isSubmitting: false,
  error: null,             // 错误信息
  submitError: null,
};
```

**Action Types**:

| Action Type | payload | 说明 |
|------------|---------|------|
| `FETCH_MEMOS_START` | 无 | 开始加载笔记列表（首次 / 切换 Tab / 下拉刷新） |
| `FETCH_MEMOS_SUCCESS` | `{ memos, page, hasMore }` | 笔记列表加载成功，替换当前列表 |
| `FETCH_MEMOS_ERROR` | `errorMessage` | 笔记列表加载失败 |
| `LOAD_MORE_START` | 无 | 开始加载下一页 |
| `LOAD_MORE_SUCCESS` | `{ memos, page, hasMore }` | 下一页加载成功，追加到列表末尾 |
| `LOAD_MORE_ERROR` | `errorMessage` | 下一页加载失败 |
| `SET_FILTER` | `'all' \| 'tagged' \| 'with-images'` | 切换分类 Tab，同时重置分页状态 |
| `ADD_MEMO` | `memoObject` | 创建笔记成功，将新笔记插入列表顶部（乐观更新） |
| `SUBMIT_START` | 无 | 开始提交笔记 |
| `SUBMIT_SUCCESS` | `memoObject` | 提交成功 |
| `SUBMIT_ERROR` | `errorMessage` | 提交失败 |

**导出**:
- `export function MemoProvider` — Context Provider，包裹需要访问笔记状态的组件树
- `export function useMemoContext` — 自定义 Hook，访问 `{ state, dispatch }`

---

#### 4.3.2 TagContext.jsx

**文件路径**: `apps/mobile/context/TagContext.jsx`
**这是新建文件**

**状态结构**:
```js
const initialState = {
  tags: [],              // 标签列表（含笔记计数）每项: { id, name, memoCount, createdAt }
  isLoading: false,      // 异步状态
  error: null,
};
```

**Action Types**:

| Action Type | payload | 说明 |
|------------|---------|------|
| `FETCH_TAGS_START` | 无 | 开始加载标签列表 |
| `FETCH_TAGS_SUCCESS` | `tagsArray` | 标签列表加载成功 |
| `FETCH_TAGS_ERROR` | `errorMessage` | 标签列表加载失败 |
| `ADD_TAG_LOCAL` | `tagObject` | 用户在 TagPicker 中新增了一个本地标签（尚未持久化，发布笔记时由后端创建） |

**导出**:
- `export function TagProvider` — Context Provider
- `export function useTagContext` — 自定义 Hook，访问 `{ state, dispatch }`

---

### 4.4 自定义 Hook

---

#### 4.4.1 use-memos.js

**文件路径**: `apps/mobile/hooks/use-memos.js`
**这是新建文件**

**职责**:
封装笔记列表的加载、分页、分类筛选、创建笔记的全部业务逻辑。

**返回值**:
```js
{
  memos, isLoading, isLoadingMore, isSubmitting, hasMore, activeFilter, error, submitError,
  fetchMemos, loadMore, setFilter, createMemo, clearSubmitError,
}
```

**调用的 API 端点**:
- `GET /api/memos?filter=:filter&page=:page&limit=20`
- `POST /api/memos`

---

#### 4.4.2 use-tags.js

**文件路径**: `apps/mobile/hooks/use-tags.js`
**这是新建文件**

**职责**:
封装标签列表的加载逻辑。

**返回值**:
```js
{ tags, isLoading, error, fetchTags }
```

**调用的 API 端点**:
- `GET /api/tags`

---

#### 4.4.3 use-tag-memos.js

**文件路径**: `apps/mobile/hooks/use-tag-memos.js`
**这是新建文件**

**职责**:
封装特定标签笔记列表的加载与分页逻辑，用于 `app/(app)/tags/[id].jsx` 页面。

**参数**: `tagId {string}`

**返回值**:
```js
{ memos, isLoading, isLoadingMore, hasMore, error, loadMore, refetch }
```

**调用的 API 端点**:
- `GET /api/memos?tagId=:tagId&page=:page&limit=20`

---

## §5 改动文件清单

### 新增文件

#### 后端

**数据库 Schema**
```
apps/server/src/db/schema.js                     — Drizzle 表定义（users / memos / tags / memo_tags / memo_images）
apps/server/src/db/index.js                      — Drizzle 实例导出
```

**路由**
```
apps/server/src/routes/memos.js                  — Memo 路由（POST/GET/DELETE /api/memos）
apps/server/src/routes/tags.js                   — Tag 路由（GET /api/tags, GET /api/tags/:tagId/memos）
```

**插件与工具**
```
apps/server/src/plugins/session.js               — Session 插件配置（@fastify/session + @fastify/cookie）
apps/server/src/plugins/cors.js                  — CORS 插件配置
apps/server/src/plugins/auth.js                  — 认证 preHandler（requireAuth）
apps/server/src/lib/errors.js                    — 统一错误类（AppError / NotFoundError / ForbiddenError）
```

**应用入口**
```
apps/server/src/index.js                         — Fastify 应用入口（注册插件、路由、全局错误处理）
apps/server/drizzle.config.js                    — Drizzle Kit 配置
apps/server/package.json                         — 依赖声明（fastify, drizzle-orm, better-sqlite3 等）
```

#### 前端

**页面路由**
```
apps/mobile/app/_layout.jsx                      — 根布局（挂载 MemoProvider、TagProvider）
apps/mobile/app/(app)/_layout.jsx                — 已登录区域布局
apps/mobile/app/(app)/index.jsx                  — 主界面（创建笔记 + 笔记列表）
apps/mobile/app/(app)/tags/index.jsx             — 全部标签列表页
apps/mobile/app/(app)/tags/[id].jsx              — 特定标签的笔记列表页（动态路由）
```

**通用组件**
```
apps/mobile/components/MemoCard.jsx              — 笔记卡片组件
apps/mobile/components/TagPicker.jsx             — 标签选择弹层组件
apps/mobile/components/ImagePickerInput.jsx      — 图片选择与预览组件
apps/mobile/components/EmptyState.jsx            — 通用空状态组件
apps/mobile/components/ErrorState.jsx            — 通用错误状态组件
```

**状态管理**
```
apps/mobile/context/MemoContext.jsx              — 全局笔记状态（Context + Reducer）
apps/mobile/context/TagContext.jsx               — 全局标签状态（Context + Reducer）
```

**自定义 Hooks**
```
apps/mobile/hooks/use-memos.js                   — 笔记列表业务逻辑 Hook
apps/mobile/hooks/use-tags.js                    — 标签列表业务逻辑 Hook
apps/mobile/hooks/use-tag-memos.js               — 特定标签笔记列表 Hook
```

**API Client**
```
apps/mobile/lib/api-client.js                    — API 请求封装（统一 fetch 封装，credentials: 'include'）
```

**配置文件**
```
apps/mobile/package.json                         — 依赖声明（expo, expo-router, expo-image-picker 等）
apps/mobile/babel.config.js                      — Babel 配置（module-resolver 路径别名）
```

### 修改文件

**根目录**
```
.env                                             — 新增环境变量（DB_PATH、SESSION_SECRET、CORS_ORIGIN、EXPO_PUBLIC_API_URL）
pnpm-workspace.yaml                              — 新增 apps/server、apps/mobile 到 workspaces
package.json                                     — 根 package.json（新增 dev/build/lint 脚本调用子包）
```

---

## §6 技术约束与风险

### 6.1 输入校验

**前端**:
- 笔记内容：1-10,000 字符（实时字数统计，超限阻止输入）
- 标签名称：2-20 字符，仅中英文、数字、下划线，实时过滤非法字符
- 图片格式：JPG/PNG/GIF，单张 ≤5MB，每笔记最多 9 张
- 用户输入后立即校验，不依赖服务端响应

**后端**:
- JSON Schema 校验所有请求体和 query 参数
- content 长度、tagNames 格式、imageUrls 数量均在路由层拦截
- 双重校验（前后端都校验）确保数据一致性

### 6.2 安全

**XSS 防护**:
- 笔记内容纯文本渲染（使用 `<Text>` 组件，不使用 HTML 渲染）
- 标签名称仅展示，不执行任何脚本

**认证边界**:
- 所有 API 端点均需 `preHandler: [requireAuth]`
- Session Cookie 配置 `httpOnly: true`、`sameSite: 'strict'`、生产环境 `secure: true`
- 用户数据隔离：所有查询携带 `WHERE userId = :userId`

**SQL 注入防护**:
- 全程使用 Drizzle ORM 参数化查询
- 禁止原生 SQL 字符串拼接（项目宪法强制要求）

### 6.3 性能

**潜在 N+1 查询问题**:
- 笔记列表查询时，每条 memo 需关联查询 tags 和 images
- 解决方案：使用 LEFT JOIN 一次性查询，后端在内存中聚合数据
- 示例 SQL（Drizzle ORM）:
  ```js
  await db
    .select()
    .from(memos)
    .leftJoin(memoTags, eq(memoTags.memoId, memos.id))
    .leftJoin(tags, eq(tags.id, memoTags.tagId))
    .leftJoin(memoImages, eq(memoImages.memoId, memos.id))
    .where(eq(memos.userId, userId));
  ```
- 手动聚合成 `{ memo, tags: [...], images: [...] }` 结构

**分页**:
- 每页 20 条，前端无限滚动加载
- 后端使用 `LIMIT` + `OFFSET` 分页
- `limit` 最大值 100，防止单次查询过载

**标签计数查询**:
- `GET /api/tags` 使用 `COUNT + LEFT JOIN memo_tags` 聚合查询
- SQLite 单机性能足够（标签数不超过数千），无需缓存
- 后续优化可引入 Redis 缓存标签计数

### 6.4 兼容性

**与现有功能的兼容性风险**:
- 本次为从零构建，无现有功能冲突
- 后续需注意：
  - 用户表 `users` 已预留，认证模块应复用此表
  - Session 存储方案需与现有认证系统统一（SQLite 同库或独立 session store）

---

## §7 不包含（范围边界）

为避免范围蔓延，本次设计**明确不包含**以下功能：

### 7.1 笔记编辑与删除（前端 UI）

- MVP 阶段仅支持**创建**和**查看**笔记
- 用户点击笔记卡片后进入详情页（只读）
- 后端虽实现 `DELETE /api/memos/:id` 端点，但前端不提供删除按钮
- **理由**: spec 假设清单第 8 条明确"MVP 阶段不支持编辑"，删除功能延迟到后续版本

### 7.2 图片上传独立端点

- 本次不单独实现 `POST /api/uploads` 端点
- 图片上传逻辑集成在 `POST /api/memos` 内（multipart/form-data）
- **理由**: 简化 MVP 流程，避免两次 API 调用（先上传图片 → 再创建笔记）
- **后续扩展**: 若需支持"草稿自动保存图片"，再拆分独立上传端点

### 7.3 搜索功能

- 不包含笔记内容全文搜索
- 不包含标签模糊搜索
- **理由**: spec 中未包含搜索功能，留待后续版本实现（可使用 SQLite FTS5 全文索引）

### 7.4 笔记分享与导出

- 不包含分享到社交媒体
- 不包含导出为 Markdown/PDF
- **理由**: 核心价值为"个人记录"，分享功能非 MVP 必需

### 7.5 标签管理（重命名/删除/合并）

- 用户可创建标签，但不可重命名、删除、合并标签
- 空标签（memoCount = 0）仍会显示，不自动清理
- **理由**: 标签管理功能复杂度高（需处理关联笔记的批量更新），延迟到后续版本

### 7.6 多用户协作

- 不包含笔记共享给其他用户
- 不包含团队空间
- **理由**: MVP 定位为单用户个人笔记应用

### 7.7 离线支持

- 不包含本地数据缓存（除草稿外）
- 不包含离线同步（Offline-First）
- **理由**: MVP 依赖网络，离线功能需额外架构设计（本地 SQLite + 同步机制）

---

**设计完成日期**: 2026-03-12
**审核状态**: 待实现团队评审
**下一步**: 基于本设计文档进入编码实现阶段
