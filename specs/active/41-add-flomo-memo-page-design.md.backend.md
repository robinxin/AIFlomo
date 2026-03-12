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
