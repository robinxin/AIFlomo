# §3 API 端点设计 — Flomo 笔记页面（Issue #41）

> 生成日期: 2026-03-11
> 负责角色: backend-developer subagent
> 基于: architect 数据模型（41-add-flomo-memo-page-design.md.architect.md）
> 对应 E2E 契约: apps/tests/*.spec.js

---

## 总览

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

---

## 3.1 认证路由（`apps/server/src/routes/auth.js`）

### POST /api/auth/register — 注册新用户

**鉴权**: 不需要（公开接口）

**请求验证 JSON Schema**:

```js
const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'password', 'nickname'],
    properties: {
      email: {
        type: 'string',
        format: 'email',       // Fastify ajv 内置 email format 验证
      },
      password: {
        type: 'string',
        minLength: 8,
      },
      nickname: {
        type: 'string',
        minLength: 1,
        maxLength: 50,
      },
    },
    additionalProperties: false,
  },
};
```

**成功响应** — HTTP 201:

```json
{
  "data": {
    "id": "uuid-v4",
    "email": "newuser@example.com",
    "nickname": "测试用户",
    "createdAt": "2026-03-11T08:00:00.000Z"
  },
  "message": "注册成功"
}
```

响应头包含 `Set-Cookie`（session cookie，httpOnly + sameSite=strict）。

**失败响应清单**:

| HTTP 状态码 | error 字段 | message | 触发条件 |
|------------|-----------|---------|---------|
| 400 | `VALIDATION_ERROR` | `请求参数不合法` | email 格式错误 / password < 8 字符 / nickname 缺失（Fastify schema 拦截） |
| 409 | `EMAIL_EXISTS` | `该邮箱已被注册` | 数据库唯一键冲突（email 已存在） |
| 500 | `INTERNAL_ERROR` | `服务器内部错误` | 未预期异常 |

**业务逻辑说明**:
- 密码使用 `bcrypt`（`apps/server/src/lib/password.js`）哈希后存入 `users.passwordHash`
- 注册成功后立即写入 session（`request.session.userId = newUser.id`），前端无需二次登录
- 不得在响应中返回 `passwordHash` 字段

---

### POST /api/auth/login — 用户登录

**鉴权**: 不需要（公开接口）

**请求验证 JSON Schema**:

```js
const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
      },
      password: {
        type: 'string',
        minLength: 1,
      },
    },
    additionalProperties: false,
  },
};
```

**成功响应** — HTTP 200:

```json
{
  "data": {
    "id": "uuid-v4",
    "email": "test@example.com",
    "nickname": "测试用户",
    "createdAt": "2026-03-10T00:00:00.000Z"
  },
  "message": "登录成功"
}
```

响应头包含 `Set-Cookie`。

**失败响应清单**:

| HTTP 状态码 | error 字段 | message | 触发条件 |
|------------|-----------|---------|---------|
| 400 | `VALIDATION_ERROR` | `请求参数不合法` | 参数格式错误（Fastify schema 拦截） |
| 401 | `INVALID_CREDENTIALS` | `邮箱或密码错误` | 邮箱不存在或密码不匹配 |
| 500 | `INTERNAL_ERROR` | `服务器内部错误` | 未预期异常 |

**业务逻辑说明**:
- 使用 `bcrypt.compare()` 校验密码
- 登录成功后写入 session：`request.session.userId = user.id`
- 邮箱不存在与密码错误返回同一错误（防止用户枚举攻击）

---

### POST /api/auth/logout — 用户登出

**鉴权**: 不需要（已登出用户调用应静默成功）

**请求体**: 无

**成功响应** — HTTP 200:

```json
{
  "data": null,
  "message": "已登出"
}
```

响应头 `Set-Cookie` 包含 `Max-Age=0`（销毁 cookie）。

**失败响应清单**:

| HTTP 状态码 | error 字段 | message | 触发条件 |
|------------|-----------|---------|---------|
| 500 | `INTERNAL_ERROR` | `服务器内部错误` | session 销毁异常 |

**业务逻辑说明**:
- 调用 `request.session.destroy()` 销毁 session
- 若用户本身未登录，仍返回 200（幂等）

---

### GET /api/auth/me — 获取当前登录用户信息

**鉴权**: `preHandler: [requireAuth]`

**请求体**: 无

**成功响应** — HTTP 200:

```json
{
  "data": {
    "id": "uuid-v4",
    "email": "test@example.com",
    "nickname": "测试用户",
    "createdAt": "2026-03-10T00:00:00.000Z"
  },
  "message": "ok"
}
```

**失败响应清单**:

| HTTP 状态码 | error 字段 | message | 触发条件 |
|------------|-----------|---------|---------|
| 401 | `Unauthorized` | `请先登录` | session 中无 userId |
| 404 | `NOT_FOUND` | `User not found` | session 有效但用户已被删除 |
| 500 | `INTERNAL_ERROR` | `服务器内部错误` | 未预期异常 |

---

## 3.2 笔记路由（`apps/server/src/routes/memos.js`）

### GET /api/memos — 获取笔记列表（支持筛选和搜索）

**鉴权**: `preHandler: [requireAuth]`

**Query 参数验证 JSON Schema**:

```js
const listMemosSchema = {
  querystring: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['tagged', 'untagged', 'image', 'link'],
      },
      tagId: {
        type: 'string',
      },
      q: {
        type: 'string',
        maxLength: 200,
      },
    },
    additionalProperties: false,
  },
};
```

**参数语义**:

| 参数 | 说明 | 示例 |
|-----|------|------|
| `type=tagged` | 只返回有标签的笔记（memo_tags 中有记录） | `GET /api/memos?type=tagged` |
| `type=untagged` | 只返回无标签的笔记 | `GET /api/memos?type=untagged` |
| `type=image` | 只返回 `hasImage = 1` 的笔记 | `GET /api/memos?type=image` |
| `type=link` | 只返回 `hasLink = 1` 的笔记 | `GET /api/memos?type=link` |
| `tagId` | 按标签 ID 筛选（属于该标签的笔记） | `GET /api/memos?tagId=uuid` |
| `q` | 全文搜索，匹配 content（LIKE `%q%`，不区分大小写）；空字符串等同于不传 | `GET /api/memos?q=会议` |

参数可组合（如 `?type=tagged&q=关键词`）。

**成功响应** — HTTP 200:

```json
{
  "data": [
    {
      "id": "uuid-v4",
      "content": "今天参加 #工作 会议",
      "userId": "uuid-v4",
      "hasImage": 0,
      "hasLink": 0,
      "deletedAt": null,
      "createdAt": "2026-03-11T10:00:00.000Z",
      "updatedAt": "2026-03-11T10:00:00.000Z",
      "tags": [
        { "id": "tag-uuid", "name": "工作" }
      ],
      "attachments": []
    }
  ],
  "message": "ok"
}
```

结果按 `createdAt DESC` 排序，只返回 `deletedAt IS NULL` 的笔记。每条笔记嵌套 `tags`（数组）和 `attachments`（数组）。

**失败响应清单**:

| HTTP 状态码 | error 字段 | message | 触发条件 |
|------------|-----------|---------|---------|
| 400 | `VALIDATION_ERROR` | `请求参数不合法` | `type` 枚举值不合法 |
| 401 | `Unauthorized` | `请先登录` | 未登录 |
| 500 | `INTERNAL_ERROR` | `服务器内部错误` | 未预期异常 |

---

### POST /api/memos — 创建新笔记

**鉴权**: `preHandler: [requireAuth]`

**请求验证 JSON Schema**:

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
    },
    additionalProperties: false,
  },
};
```

**请求体示例**:

```json
{ "content": "今天参加 #工作 会议，记录了 https://example.com 链接" }
```

**成功响应** — HTTP 201:

```json
{
  "data": {
    "id": "uuid-v4",
    "content": "今天参加 #工作 会议，记录了 https://example.com 链接",
    "userId": "uuid-v4",
    "hasImage": 0,
    "hasLink": 1,
    "deletedAt": null,
    "createdAt": "2026-03-11T10:00:00.000Z",
    "updatedAt": "2026-03-11T10:00:00.000Z",
    "tags": ["工作"]
  },
  "message": "创建成功"
}
```

**失败响应清单**:

| HTTP 状态码 | error 字段 | message | 触发条件 |
|------------|-----------|---------|---------|
| 400 | `VALIDATION_ERROR` | `请求参数不合法` | content 为空字符串 / 超出 10000 字符 / content 字段缺失 |
| 400 | `TOO_MANY_TAGS` | `每条笔记最多 10 个标签` | 解析到超过 10 个 `#标签名` |
| 401 | `Unauthorized` | `请先登录` | 未登录 |
| 500 | `INTERNAL_ERROR` | `服务器内部错误` | 未预期异常 |

**业务逻辑说明**:
1. 解析 content 中的 `#标签名` 模式（正则：`/#([^\s#]{1,20})/g`），提取标签名列表
2. 若标签数量超过 10，抛出业务错误 `TOO_MANY_TAGS`（在 schema 验证通过后、插入数据库前做此检查）
3. 检测 content 中是否存在 `https?://` 模式，若有则 `hasLink = 1`
4. 在数据库事务中：
   a. 插入 `memos` 行（`hasLink` 已计算）
   b. 对每个标签名：查询 `tags` 表是否存在同名同 userId 标签；存在则复用，不存在则插入新标签
   c. 插入 `memo_tags` 关联记录
5. 响应 `data.tags` 返回标签名字符串数组（与 E2E 断言 `body.data.tags.toContain('工作')` 对齐）
6. 图片上传通过独立接口（见 3.2 节图片上传）处理，创建笔记时不处理图片

---

### DELETE /api/memos/:id — 软删除笔记（移入回收站）

**鉴权**: `preHandler: [requireAuth]`

**路径参数验证 JSON Schema**:

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

**成功响应** — HTTP 200:

```json
{
  "data": null,
  "message": "已移至回收站"
}
```

**失败响应清单**:

| HTTP 状态码 | error 字段 | message | 触发条件 |
|------------|-----------|---------|---------|
| 401 | `Unauthorized` | `请先登录` | 未登录 |
| 404 | `NOT_FOUND` | `Memo not found` | 笔记不存在或不属于当前用户 |
| 500 | `INTERNAL_ERROR` | `服务器内部错误` | 未预期异常 |

**业务逻辑说明**:
- 仅更新 `deletedAt = new Date().toISOString()`，不物理删除行
- 必须验证 `userId = request.session.userId`，防止越权操作（查无则 404，不区分"不存在"和"无权限"）
- 已在回收站中的笔记（`deletedAt IS NOT NULL`）再次软删除时返回 404

---

### GET /api/memos/trash — 获取回收站列表

**鉴权**: `preHandler: [requireAuth]`

**Query 参数**: 无

**成功响应** — HTTP 200:

```json
{
  "data": [
    {
      "id": "uuid-v4",
      "content": "测试删除的笔记",
      "userId": "uuid-v4",
      "hasImage": 0,
      "hasLink": 0,
      "deletedAt": "2026-03-11T09:00:00.000Z",
      "createdAt": "2026-03-11T08:00:00.000Z",
      "updatedAt": "2026-03-11T09:00:00.000Z",
      "tags": [],
      "attachments": []
    }
  ],
  "message": "ok"
}
```

返回 `deletedAt IS NOT NULL` 的笔记，按 `deletedAt DESC` 排序。每条记录包含 `deletedAt`（E2E 断言此字段不为 null）。

**失败响应清单**:

| HTTP 状态码 | error 字段 | message | 触发条件 |
|------------|-----------|---------|---------|
| 401 | `Unauthorized` | `请先登录` | 未登录 |
| 500 | `INTERNAL_ERROR` | `服务器内部错误` | 未预期异常 |

**路由注册顺序说明**:

`GET /api/memos/trash` 必须在 `GET /api/memos/:id`（如有）之前注册，防止 Fastify 将 `trash` 当作 `:id` 参数解析。

---

### POST /api/memos/:id/restore — 从回收站恢复笔记

**鉴权**: `preHandler: [requireAuth]`

**路径参数验证 JSON Schema**:

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

**请求体**: 无

**成功响应** — HTTP 200:

```json
{
  "data": {
    "id": "uuid-v4",
    "content": "测试恢复",
    "userId": "uuid-v4",
    "hasImage": 0,
    "hasLink": 0,
    "deletedAt": null,
    "createdAt": "2026-03-11T08:00:00.000Z",
    "updatedAt": "2026-03-11T09:30:00.000Z",
    "tags": [],
    "attachments": []
  },
  "message": "恢复成功"
}
```

`data.deletedAt` 为 `null`（E2E 断言此字段为 null）。

**失败响应清单**:

| HTTP 状态码 | error 字段 | message | 触发条件 |
|------------|-----------|---------|---------|
| 401 | `Unauthorized` | `请先登录` | 未登录 |
| 404 | `NOT_FOUND` | `Memo not found` | 笔记不存在、不属于当前用户、或 `deletedAt IS NULL`（未被软删除的笔记不可恢复） |
| 500 | `INTERNAL_ERROR` | `服务器内部错误` | 未预期异常 |

**业务逻辑说明**:
- 更新 `deletedAt = null`，同时更新 `updatedAt = new Date().toISOString()`
- 验证 `userId = request.session.userId` 且 `deletedAt IS NOT NULL`

---

### DELETE /api/memos/:id/permanent — 永久删除笔记

**鉴权**: `preHandler: [requireAuth]`

**路径参数验证 JSON Schema**:

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

**请求体**: 无

**成功响应** — HTTP 204（无响应体）

**失败响应清单**:

| HTTP 状态码 | error 字段 | message | 触发条件 |
|------------|-----------|---------|---------|
| 401 | `Unauthorized` | `请先登录` | 未登录 |
| 404 | `NOT_FOUND` | `Memo not found` | 笔记不存在或不属于当前用户 |
| 500 | `INTERNAL_ERROR` | `服务器内部错误` | 未预期异常 |

**业务逻辑说明**:
- 物理删除 `memos` 表中的行（`DELETE FROM memos WHERE id = ? AND userId = ?`）
- 由于 schema 中 `memo_tags` 和 `attachments` 均设置了 `onDelete: 'cascade'`，关联数据自动清理
- 同时需同步删除本地磁盘上的图片文件（遍历该 memo 的 attachments，删除 `url` 指向的文件）
- 正常笔记（`deletedAt IS NULL`）也可直接永久删除，不强制要求先软删除

---

### POST /api/memos/:id/attachments — 上传笔记图片

**鉴权**: `preHandler: [requireAuth]`

**Content-Type**: `multipart/form-data`（使用 `@fastify/multipart`）

**路径参数 JSON Schema**:

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

**请求体**: `multipart/form-data`，字段 `file`（图片文件）

**服务端约束**（在 handler 中验证，非 JSON Schema）:
- 文件大小限制：5MB（`5 * 1024 * 1024` bytes）
- 允许 MIME 类型：`image/jpeg`、`image/png`、`image/gif`
- 超出限制时返回 400

**成功响应** — HTTP 201:

```json
{
  "data": {
    "id": "uuid-v4",
    "memoId": "uuid-v4",
    "url": "/uploads/uuid-v4.png",
    "mimeType": "image/png",
    "sizeBytes": 204800,
    "createdAt": "2026-03-11T10:00:00.000Z"
  },
  "message": "上传成功"
}
```

**失败响应清单**:

| HTTP 状态码 | error 字段 | message | 触发条件 |
|------------|-----------|---------|---------|
| 400 | `FILE_TOO_LARGE` | `图片大小不得超过 5MB` | 文件超过 5MB |
| 400 | `INVALID_FILE_TYPE` | `不支持的图片格式` | MIME 类型不在白名单 |
| 401 | `Unauthorized` | `请先登录` | 未登录 |
| 404 | `NOT_FOUND` | `Memo not found` | 笔记不存在或不属于当前用户 |
| 500 | `INTERNAL_ERROR` | `服务器内部错误` | 文件写入失败等 |

**业务逻辑说明**:
1. 验证目标 memo 存在且属于当前用户
2. 读取 multipart 数据，校验文件大小和 MIME 类型
3. 生成随机文件名（`crypto.randomUUID() + 扩展名`），写入 `data/uploads/` 目录
4. 插入 `attachments` 行，`url` 字段存储相对路径（如 `/uploads/xxx.png`）
5. 更新对应 `memos.hasImage = 1`
6. 返回 attachment 记录

---

## 3.3 标签路由（`apps/server/src/routes/tags.js`）

### GET /api/tags — 获取当前用户标签列表（含笔记计数）

**鉴权**: `preHandler: [requireAuth]`

**Query 参数**: 无

**成功响应** — HTTP 200:

```json
{
  "data": [
    {
      "id": "uuid-v4",
      "name": "工作",
      "count": 5
    },
    {
      "id": "uuid-v4",
      "name": "技术",
      "count": 3
    }
  ],
  "message": "ok"
}
```

每个标签包含 `id`、`name`、`count`（E2E 断言字段结构）。`count` 为该标签关联的正常笔记数量（`deletedAt IS NULL`）。按 `count DESC` 排序。

**失败响应清单**:

| HTTP 状态码 | error 字段 | message | 触发条件 |
|------------|-----------|---------|---------|
| 401 | `Unauthorized` | `请先登录` | 未登录 |
| 500 | `INTERNAL_ERROR` | `服务器内部错误` | 未预期异常 |

**业务逻辑说明**:
- 使用 Drizzle 关联查询，对 `memo_tags` 做 JOIN，统计每个 tag 关联的正常 memo 数量：

```js
// 伪代码（实现时使用 Drizzle sql helper）
SELECT tags.id, tags.name, COUNT(memo_tags.memoId) as count
FROM tags
LEFT JOIN memo_tags ON memo_tags.tagId = tags.id
LEFT JOIN memos ON memos.id = memo_tags.memoId AND memos.deletedAt IS NULL
WHERE tags.userId = ?
GROUP BY tags.id
ORDER BY count DESC
```

- `count = 0` 的孤儿标签（所有关联 memo 均被永久删除）仍然返回（`count: 0`），由前端决定是否显示

---

## 3.4 统计路由（`apps/server/src/routes/stats.js`）

### GET /api/stats — 获取用户统计数据和热力图

**鉴权**: `preHandler: [requireAuth]`

**Query 参数**: 无

**成功响应** — HTTP 200:

```json
{
  "data": {
    "totalMemos": 100,
    "taggedMemos": 60,
    "usageDays": 15,
    "trashCount": 5,
    "heatmap": [
      { "day": "2026-01-01", "count": 3 },
      { "day": "2026-01-02", "count": 0 },
      { "day": "2026-03-11", "count": 2 }
    ]
  },
  "message": "ok"
}
```

**字段语义**（与 architect §2.4 严格对齐）:

| 字段 | 类型 | 计算逻辑 |
|-----|------|---------|
| `totalMemos` | `number` | `COUNT(*) FROM memos WHERE userId = ? AND deletedAt IS NULL` |
| `taggedMemos` | `number` | 有至少一条 `memo_tags` 关联记录的正常笔记数量 |
| `usageDays` | `number` | 取该用户最早一条笔记（包含已删除）的 `createdAt` 到今日的天数差 + 1；若无笔记则返回 0 |
| `trashCount` | `number` | `COUNT(*) FROM memos WHERE userId = ? AND deletedAt IS NOT NULL` |
| `heatmap` | `Array<{day: string, count: number}>` | 最近 90 天（含今日）每日正常笔记数量，日期格式 `YYYY-MM-DD`，无笔记的日期 `count = 0` |

**失败响应清单**:

| HTTP 状态码 | error 字段 | message | 触发条件 |
|------------|-----------|---------|---------|
| 401 | `Unauthorized` | `请先登录` | 未登录 |
| 500 | `INTERNAL_ERROR` | `服务器内部错误` | 未预期异常 |

**业务逻辑说明**:
- `heatmap` 的日期范围：`今日 - 89 天` 到 `今日`（共 90 天）
- 对没有笔记的日期，显式填充 `count: 0`（前端热力图渲染需要连续日期序列）
- 所有统计值类型为 `number`（E2E 使用 `typeof` 断言）

---

## 3.5 路由注册顺序（`apps/server/src/index.js` 中）

```js
await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(memoRoutes, { prefix: '/api/memos' });
await app.register(tagRoutes,  { prefix: '/api/tags' });
await app.register(statsRoutes, { prefix: '/api/stats' });
```

在 `memoRoutes` plugin 内部，路由注册顺序：

```js
// 固定路径必须先于参数路径注册
fastify.get('/trash', ...)                   // GET /api/memos/trash
fastify.get('/', ...)                         // GET /api/memos
fastify.post('/', ...)                        // POST /api/memos
fastify.delete('/:id', ...)                   // DELETE /api/memos/:id
fastify.post('/:id/restore', ...)             // POST /api/memos/:id/restore
fastify.delete('/:id/permanent', ...)         // DELETE /api/memos/:id/permanent
fastify.post('/:id/attachments', ...)         // POST /api/memos/:id/attachments
```

---

## 3.6 公共 preHandler 约定

所有受保护路由使用 `requireAuth`（定义于 `apps/server/src/plugins/auth.js`）：

```js
// apps/server/src/plugins/auth.js
export async function requireAuth(request, reply) {
  if (!request.session.userId) {
    return reply.status(401).send({
      data: null,
      error: 'Unauthorized',
      message: '请先登录',
    });
  }
}
```

---

## 3.7 错误类清单（`apps/server/src/lib/errors.js` 新增）

基于现有 `AppError` / `NotFoundError` / `ForbiddenError`，补充以下错误类：

```js
export class ConflictError extends AppError {
  constructor(code, message) {
    super(409, message, code);
  }
}

export class BusinessError extends AppError {
  constructor(code, message) {
    super(400, message, code);
  }
}
```

使用示例：

```js
// 注册时邮箱已存在
throw new ConflictError('EMAIL_EXISTS', '该邮箱已被注册');

// 登录凭证错误
throw new AppError(401, '邮箱或密码错误', 'INVALID_CREDENTIALS');

// 标签超限
throw new BusinessError('TOO_MANY_TAGS', '每条笔记最多 10 个标签');

// 文件过大
throw new BusinessError('FILE_TOO_LARGE', '图片大小不得超过 5MB');

// 文件类型不支持
throw new BusinessError('INVALID_FILE_TYPE', '不支持的图片格式');
```

---

## 3.8 完整端点速查表

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
