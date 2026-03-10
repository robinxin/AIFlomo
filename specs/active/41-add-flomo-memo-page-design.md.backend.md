# §3 API 端点设计 — Flomo 笔记页面 (#41)

**生成时间**: 2026-03-10
**设计者**: backend-developer subagent
**依赖**: §2 数据模型（41-add-flomo-memo-page-design.md.architect.md）
**设计范围**: §3 API 端点设计（仅此章节）

---

## 3.1 路由文件清单

| 文件路径 | 前缀 | 资源 |
|---------|------|------|
| `apps/server/src/routes/auth.js` | `/api/auth` | 认证（注册/登录/登出/当前用户） |
| `apps/server/src/routes/memos.js` | `/api/memos` | 笔记 CRUD、搜索、回收站操作 |
| `apps/server/src/routes/tags.js` | `/api/tags` | 标签列表（含笔记计数） |
| `apps/server/src/routes/stats.js` | `/api/stats` | 统计数据与热力图 |

所有路由通过 `apps/server/src/index.js` 注册，统一 `/api` 前缀：

```js
await app.register(authRoutes,  { prefix: '/api/auth' });
await app.register(memoRoutes,  { prefix: '/api/memos' });
await app.register(tagRoutes,   { prefix: '/api/tags' });
await app.register(statsRoutes, { prefix: '/api/stats' });
```

---

## 3.2 认证端点（`apps/server/src/routes/auth.js`）

### POST /api/auth/register — 注册新用户

- **鉴权**: 无（公开接口）
- **业务说明**: 创建新用户账号，nickname 默认取 email 前缀（`@` 前的部分），注册后自动登录（写入 session）

**请求验证 JSON Schema**:

```js
const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email:    { type: 'string', format: 'email', maxLength: 255 },
      password: { type: 'string', minLength: 8, maxLength: 128 },
      nickname: { type: 'string', minLength: 1, maxLength: 50 },
    },
    additionalProperties: false,
  },
};
```

**成功响应** `201 Created`:

```json
{
  "data": {
    "id": "uuid-v4",
    "email": "user@example.com",
    "nickname": "user",
    "createdAt": "2026-03-10T08:00:00Z"
  },
  "message": "注册成功"
}
```

**失败响应清单**:

| HTTP 状态码 | error 字段 | 场景 |
|-----------|-----------|------|
| 400 | `VALIDATION_ERROR` | 请求体格式不合法（缺少字段、格式错误） |
| 409 | `EMAIL_EXISTS` | email 已被注册 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |

---

### POST /api/auth/login — 用户登录

- **鉴权**: 无（公开接口）
- **业务说明**: 验证邮箱密码，成功后将 `userId` 写入 session，Set-Cookie 返回 session ID

**请求验证 JSON Schema**:

```js
const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email:    { type: 'string', format: 'email', maxLength: 255 },
      password: { type: 'string', minLength: 1, maxLength: 128 },
    },
    additionalProperties: false,
  },
};
```

**成功响应** `200 OK`:

```json
{
  "data": {
    "id": "uuid-v4",
    "email": "user@example.com",
    "nickname": "Robin",
    "createdAt": "2026-03-10T08:00:00Z"
  },
  "message": "登录成功"
}
```

**失败响应清单**:

| HTTP 状态码 | error 字段 | 场景 |
|-----------|-----------|------|
| 400 | `VALIDATION_ERROR` | 请求体格式不合法 |
| 401 | `INVALID_CREDENTIALS` | 邮箱或密码错误 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |

---

### POST /api/auth/logout — 用户登出

- **鉴权**: `preHandler: [requireAuth]`
- **业务说明**: 销毁 session，清除客户端 Cookie

**请求验证 JSON Schema**: 无请求体

**成功响应** `200 OK`:

```json
{
  "data": null,
  "message": "已登出"
}
```

**失败响应清单**:

| HTTP 状态码 | error 字段 | 场景 |
|-----------|-----------|------|
| 401 | `Unauthorized` | 未登录状态调用 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |

---

### GET /api/auth/me — 获取当前登录用户信息

- **鉴权**: `preHandler: [requireAuth]`
- **业务说明**: 返回当前 session 对应用户的基本信息（FR-008：页面展示昵称）

**请求验证 JSON Schema**: 无请求体，无查询参数

**成功响应** `200 OK`:

```json
{
  "data": {
    "id": "uuid-v4",
    "email": "user@example.com",
    "nickname": "Robin",
    "createdAt": "2026-03-10T08:00:00Z"
  },
  "message": "ok"
}
```

**失败响应清单**:

| HTTP 状态码 | error 字段 | 场景 |
|-----------|-----------|------|
| 401 | `Unauthorized` | 未登录 |
| 404 | `NOT_FOUND` | session 有效但用户记录已删除 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |

---

## 3.3 笔记端点（`apps/server/src/routes/memos.js`）

### GET /api/memos — 获取笔记列表

- **鉴权**: `preHandler: [requireAuth]`
- **业务说明**: 返回当前用户所有未删除笔记（`deletedAt IS NULL`），按 `createdAt` 倒序排列（FR-013）。支持标签筛选、类型筛选（FR-001/FR-002）和全文搜索（FR-004）。支持分页（边界场景：搜索结果超过 100 条时分页显示）。

**查询参数 JSON Schema**:

```js
const listMemosSchema = {
  querystring: {
    type: 'object',
    properties: {
      // 全文搜索关键词（FR-004）；不区分大小写，部分匹配
      q:       { type: 'string', maxLength: 200 },
      // 标签筛选，传标签 ID（FR-002）
      tagId:   { type: 'string' },
      // 类型筛选（FR-001）：'has_image' | 'has_link' | 'no_tag'
      type:    { type: 'string', enum: ['has_image', 'has_link', 'no_tag'] },
      // 分页
      page:    { type: 'integer', minimum: 1, default: 1 },
      limit:   { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
    additionalProperties: false,
  },
};
```

**成功响应** `200 OK`:

```json
{
  "data": {
    "items": [
      {
        "id": "uuid-v4",
        "content": "今天开了个重要会议 #工作 #2026",
        "hasImage": 0,
        "hasLink": 0,
        "deletedAt": null,
        "createdAt": "2026-03-10T10:00:00Z",
        "updatedAt": "2026-03-10T10:00:00Z",
        "tags": [
          { "id": "tag-uuid-1", "name": "工作" },
          { "id": "tag-uuid-2", "name": "2026" }
        ],
        "attachments": []
      }
    ],
    "total": 42,
    "page": 1,
    "limit": 20
  },
  "message": "ok"
}
```

**失败响应清单**:

| HTTP 状态码 | error 字段 | 场景 |
|-----------|-----------|------|
| 400 | `VALIDATION_ERROR` | 查询参数不合法（如 type 值不在枚举内） |
| 401 | `Unauthorized` | 未登录 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |

---

### POST /api/memos — 创建笔记

- **鉴权**: `preHandler: [requireAuth]`
- **业务说明**: 创建新笔记。后端自动解析正文中的 `#标签名` 格式（FR-011），写入 `tags` 和 `memo_tags` 表（已存在标签则复用）。同时处理附件（FR-003/FR-012），更新 `hasImage`/`hasLink` 标志位。每条笔记最多 10 个标签（边界场景）；图片最大 5MB（边界场景，由 multipart 插件控制）。

**请求验证 JSON Schema**:

```js
const createMemoSchema = {
  body: {
    type: 'object',
    required: ['content'],
    properties: {
      content: { type: 'string', minLength: 1, maxLength: 10000 },
      // 附件列表（可选）
      attachments: {
        type: 'array',
        maxItems: 20,
        items: {
          type: 'object',
          required: ['type', 'url'],
          properties: {
            type: { type: 'string', enum: ['image', 'link'] },
            url:  { type: 'string', maxLength: 2048 },
          },
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  },
};
```

**成功响应** `201 Created`:

```json
{
  "data": {
    "id": "uuid-v4",
    "content": "今天开了个重要会议 #工作",
    "hasImage": 0,
    "hasLink": 0,
    "deletedAt": null,
    "createdAt": "2026-03-10T10:00:00Z",
    "updatedAt": "2026-03-10T10:00:00Z",
    "tags": [
      { "id": "tag-uuid-1", "name": "工作" }
    ],
    "attachments": []
  },
  "message": "创建成功"
}
```

**失败响应清单**:

| HTTP 状态码 | error 字段 | 场景 |
|-----------|-----------|------|
| 400 | `VALIDATION_ERROR` | 请求体不合法（内容为空、超长、附件格式错误） |
| 400 | `TOO_MANY_TAGS` | 解析出的标签数量超过 10 个 |
| 401 | `Unauthorized` | 未登录 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |

---

### PUT /api/memos/:id — 更新笔记

- **鉴权**: `preHandler: [requireAuth]`
- **业务说明**: 更新笔记正文和附件。重新解析 `#标签名`，更新 `memo_tags` 关联（删除旧关联，建立新关联；孤立标签保留不删除）。同步更新 `hasImage`/`hasLink` 标志位和 `updatedAt`。仅允许操作本人笔记（`userId` 校验）。

**请求验证 JSON Schema**:

```js
const updateMemoSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    required: ['content'],
    properties: {
      content: { type: 'string', minLength: 1, maxLength: 10000 },
      attachments: {
        type: 'array',
        maxItems: 20,
        items: {
          type: 'object',
          required: ['type', 'url'],
          properties: {
            type: { type: 'string', enum: ['image', 'link'] },
            url:  { type: 'string', maxLength: 2048 },
          },
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  },
};
```

**成功响应** `200 OK`:

```json
{
  "data": {
    "id": "uuid-v4",
    "content": "更新后的笔记内容 #工作 #重要",
    "hasImage": 0,
    "hasLink": 0,
    "deletedAt": null,
    "createdAt": "2026-03-10T10:00:00Z",
    "updatedAt": "2026-03-10T11:30:00Z",
    "tags": [
      { "id": "tag-uuid-1", "name": "工作" },
      { "id": "tag-uuid-3", "name": "重要" }
    ],
    "attachments": []
  },
  "message": "更新成功"
}
```

**失败响应清单**:

| HTTP 状态码 | error 字段 | 场景 |
|-----------|-----------|------|
| 400 | `VALIDATION_ERROR` | 请求体不合法 |
| 400 | `TOO_MANY_TAGS` | 解析出的标签数量超过 10 个 |
| 401 | `Unauthorized` | 未登录 |
| 403 | `FORBIDDEN` | 笔记属于其他用户 |
| 404 | `NOT_FOUND` | 笔记不存在或已永久删除 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |

---

### DELETE /api/memos/:id — 软删除笔记（移入回收站）

- **鉴权**: `preHandler: [requireAuth]`
- **业务说明**: 设置 `deletedAt` 为当前 UTC 时间戳（软删除，FR-005）。笔记从正常列表消失，进入回收站。不删除 `memo_tags` 关联（保留，便于恢复时完整还原）。仅允许操作本人笔记。

**请求验证 JSON Schema**:

```js
const memoParamsSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' },
    },
  },
};
```

**成功响应** `200 OK`:

```json
{
  "data": { "id": "uuid-v4", "deletedAt": "2026-03-10T12:00:00Z" },
  "message": "已移入回收站"
}
```

**失败响应清单**:

| HTTP 状态码 | error 字段 | 场景 |
|-----------|-----------|------|
| 401 | `Unauthorized` | 未登录 |
| 403 | `FORBIDDEN` | 笔记属于其他用户 |
| 404 | `NOT_FOUND` | 笔记不存在 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |

---

## 3.4 回收站端点（`apps/server/src/routes/memos.js` 内，子路径 `/trash`）

### GET /api/memos/trash — 获取回收站列表

- **鉴权**: `preHandler: [requireAuth]`
- **业务说明**: 返回当前用户所有 `deletedAt IS NOT NULL` 的笔记（FR-005/FR-006），按 `deletedAt` 倒序排列。

**查询参数 JSON Schema**:

```js
const trashListSchema = {
  querystring: {
    type: 'object',
    properties: {
      page:  { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
    additionalProperties: false,
  },
};
```

**成功响应** `200 OK`:

```json
{
  "data": {
    "items": [
      {
        "id": "uuid-v4",
        "content": "这条笔记被删除了",
        "hasImage": 0,
        "hasLink": 0,
        "deletedAt": "2026-03-09T15:00:00Z",
        "createdAt": "2026-03-01T08:00:00Z",
        "updatedAt": "2026-03-01T08:00:00Z",
        "tags": [],
        "attachments": []
      }
    ],
    "total": 5,
    "page": 1,
    "limit": 20
  },
  "message": "ok"
}
```

**失败响应清单**:

| HTTP 状态码 | error 字段 | 场景 |
|-----------|-----------|------|
| 401 | `Unauthorized` | 未登录 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |

---

### POST /api/memos/:id/restore — 恢复回收站笔记

- **鉴权**: `preHandler: [requireAuth]`
- **业务说明**: 将指定笔记的 `deletedAt` 重置为 `NULL`，笔记重新出现在正常列表（FR-005）。

**请求验证 JSON Schema**:

```js
const restoreSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' },
    },
  },
};
```

**成功响应** `200 OK`:

```json
{
  "data": {
    "id": "uuid-v4",
    "content": "这条笔记已恢复",
    "hasImage": 0,
    "hasLink": 0,
    "deletedAt": null,
    "createdAt": "2026-03-01T08:00:00Z",
    "updatedAt": "2026-03-10T12:30:00Z",
    "tags": [],
    "attachments": []
  },
  "message": "已恢复"
}
```

**失败响应清单**:

| HTTP 状态码 | error 字段 | 场景 |
|-----------|-----------|------|
| 401 | `Unauthorized` | 未登录 |
| 403 | `FORBIDDEN` | 笔记属于其他用户 |
| 404 | `NOT_FOUND` | 笔记不存在或未在回收站中 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |

---

### DELETE /api/memos/:id/permanent — 永久删除笔记

- **鉴权**: `preHandler: [requireAuth]`
- **业务说明**: 对回收站中的笔记执行物理 `DELETE`（FR-005）。级联删除 `memo_tags`、`memo_attachments`（由 DB schema 中的 `onDelete: 'cascade'` 自动处理）。操作不可逆，仅允许操作本人回收站中的笔记。

**请求验证 JSON Schema**:

```js
const permanentDeleteSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' },
    },
  },
};
```

**成功响应** `200 OK`:

```json
{
  "data": null,
  "message": "已永久删除"
}
```

**失败响应清单**:

| HTTP 状态码 | error 字段 | 场景 |
|-----------|-----------|------|
| 401 | `Unauthorized` | 未登录 |
| 403 | `FORBIDDEN` | 笔记属于其他用户，或笔记不在回收站中（`deletedAt IS NULL`） |
| 404 | `NOT_FOUND` | 笔记不存在 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |

---

## 3.5 标签端点（`apps/server/src/routes/tags.js`）

### GET /api/tags — 获取标签列表（含每个标签下的笔记数）

- **鉴权**: `preHandler: [requireAuth]`
- **业务说明**: 返回当前用户所有标签，以及每个标签关联的**未删除笔记数量**（FR-002：标签旁显示数量）。按笔记数量倒序排列，数量相同则按 `name` 字母序。

**请求验证 JSON Schema**: 无查询参数

**成功响应** `200 OK`:

```json
{
  "data": [
    { "id": "tag-uuid-1", "name": "工作", "count": 15 },
    { "id": "tag-uuid-2", "name": "2026", "count": 8 },
    { "id": "tag-uuid-3", "name": "个人", "count": 3 }
  ],
  "message": "ok"
}
```

**失败响应清单**:

| HTTP 状态码 | error 字段 | 场景 |
|-----------|-----------|------|
| 401 | `Unauthorized` | 未登录 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |

---

## 3.6 统计端点（`apps/server/src/routes/stats.js`）

### GET /api/stats — 获取用户统计数据与热力图

- **鉴权**: `preHandler: [requireAuth]`
- **业务说明**: 返回用户统计信息（FR-007/FR-008）：
  - `totalMemos`：全部未删除笔记数
  - `taggedMemos`：有标签的未删除笔记数
  - `activeDays`：创建过笔记的去重天数（使用天数）
  - `trashCount`：回收站笔记数
  - `heatmap`：最近 90 天每天笔记数量（FR-007），仅返回笔记数 > 0 的日期

  所有数值均为**实时聚合查询**，不缓存（SC-008：实时一致性）。

**请求验证 JSON Schema**: 无查询参数

**Drizzle 查询策略**（对应 §2.5）:

```js
// 全部笔记数（参数化，防注入）
// SELECT COUNT(*) FROM memos WHERE user_id = ? AND deleted_at IS NULL
const totalMemosResult = await db
  .select({ count: count() })
  .from(memos)
  .where(and(eq(memos.userId, userId), isNull(memos.deletedAt)));

// 有标签笔记数
// SELECT COUNT(DISTINCT memo_id) FROM memo_tags
//   JOIN memos ON memos.id = memo_tags.memo_id
//   WHERE memos.user_id = ? AND memos.deleted_at IS NULL
const taggedMemosResult = await db
  .selectDistinct({ memoId: memoTags.memoId })
  .from(memoTags)
  .innerJoin(memos, eq(memos.id, memoTags.memoId))
  .where(and(eq(memos.userId, userId), isNull(memos.deletedAt)));

// 使用天数
// SELECT COUNT(DISTINCT date(created_at)) FROM memos
//   WHERE user_id = ? AND deleted_at IS NULL
const activeDaysResult = await db
  .selectDistinct({ day: sql`date(${memos.createdAt})` })
  .from(memos)
  .where(and(eq(memos.userId, userId), isNull(memos.deletedAt)));

// 回收站数量
// SELECT COUNT(*) FROM memos WHERE user_id = ? AND deleted_at IS NOT NULL
const trashCountResult = await db
  .select({ count: count() })
  .from(memos)
  .where(and(eq(memos.userId, userId), isNotNull(memos.deletedAt)));

// 热力图（最近 90 天）
// SELECT date(created_at) as day, COUNT(*) as count FROM memos
//   WHERE user_id = ? AND deleted_at IS NULL
//     AND created_at >= date('now', '-90 days')
//   GROUP BY day ORDER BY day
const heatmapResult = await db
  .select({
    day:   sql`date(${memos.createdAt})`,
    count: count(),
  })
  .from(memos)
  .where(and(
    eq(memos.userId, userId),
    isNull(memos.deletedAt),
    gte(memos.createdAt, sql`date('now', '-90 days')`),
  ))
  .groupBy(sql`date(${memos.createdAt})`)
  .orderBy(sql`date(${memos.createdAt})`);
```

**成功响应** `200 OK`:

```json
{
  "data": {
    "totalMemos": 100,
    "taggedMemos": 60,
    "activeDays": 15,
    "trashCount": 5,
    "heatmap": [
      { "day": "2026-01-10", "count": 3 },
      { "day": "2026-01-11", "count": 7 },
      { "day": "2026-03-10", "count": 2 }
    ]
  },
  "message": "ok"
}
```

**失败响应清单**:

| HTTP 状态码 | error 字段 | 场景 |
|-----------|-----------|------|
| 401 | `Unauthorized` | 未登录 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |

---

## 3.7 端点汇总表

| 方法 | 路径 | 鉴权 | 功能描述 | 对应 FR |
|------|------|------|---------|--------|
| POST | `/api/auth/register` | 无 | 注册新用户 | — |
| POST | `/api/auth/login` | 无 | 用户登录 | FR-009 |
| POST | `/api/auth/logout` | 是 | 用户登出 | FR-009 |
| GET | `/api/auth/me` | 是 | 获取当前用户信息 | FR-008 |
| GET | `/api/memos` | 是 | 获取笔记列表（支持筛选/搜索/分页） | FR-001/FR-002/FR-004/FR-013 |
| POST | `/api/memos` | 是 | 创建笔记（含标签解析、附件处理） | FR-003/FR-011/FR-012 |
| PUT | `/api/memos/:id` | 是 | 更新笔记 | FR-003/FR-011/FR-012 |
| DELETE | `/api/memos/:id` | 是 | 软删除笔记（移入回收站） | FR-005/FR-006 |
| GET | `/api/memos/trash` | 是 | 获取回收站列表 | FR-005/FR-006 |
| POST | `/api/memos/:id/restore` | 是 | 从回收站恢复笔记 | FR-005 |
| DELETE | `/api/memos/:id/permanent` | 是 | 永久删除笔记（物理删除） | FR-005 |
| GET | `/api/tags` | 是 | 获取标签列表（含笔记计数） | FR-002 |
| GET | `/api/stats` | 是 | 获取统计数据与热力图 | FR-007/FR-008 |

---

## 3.8 安全实现要点

| 要点 | 实现方式 |
|------|---------|
| 禁止 SQL 字符串拼接 | 所有查询使用 Drizzle ORM 参数化表达式（`eq`、`like`、`and`、`isNull` 等） |
| 用户隔离 | 所有查询必须携带 `eq(memos.userId, userId)`，`userId` 来自 `request.session.userId` |
| 输入长度限制 | `content maxLength: 10000`（CLAUDE.md 安全红线） |
| 笔记权限校验 | PUT/DELETE/restore/permanent 操作前先查询笔记确认 `userId` 匹配，不匹配则 `throw new ForbiddenError()` |
| Session Cookie | `httpOnly: true`、`sameSite: 'strict'`、生产环境 `secure: true`（由 `plugins/session.js` 统一配置） |
| 标签注入防护 | 标签名从正文正则解析后，通过 Drizzle 参数化 `insert`/`select` 操作，禁止字符串拼接进 SQL |

---

## 3.9 路由注册顺序说明

`GET /api/memos/trash` 必须在 `GET /api/memos/:id`（如有）之前注册，避免 Fastify 将 `trash` 误识别为路径参数 `:id`。

```js
// apps/server/src/routes/memos.js 内路由注册顺序
fastify.get('/trash', ...)              // 必须先于 /:id 注册
fastify.get('/', ...)
fastify.post('/', ...)
fastify.put('/:id', ...)
fastify.delete('/:id', ...)
fastify.post('/:id/restore', ...)
fastify.delete('/:id/permanent', ...)
```
