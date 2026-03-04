# 后端代码规范 — Node.js + Fastify + Drizzle ORM + JavaScript

> 适用范围：`apps/server/`
> 技术栈：Fastify v5 + JavaScript + Drizzle ORM + SQLite + @fastify/session

---

## 语言约定

- **默认使用 JavaScript**（`.js`），不引入 TypeScript
- Drizzle 配置文件（`drizzle.config.js`）用 JS，schema 也用 JS
- 无需 `tsconfig.json`，使用 Node.js ESM 模块（`"type": "module"`）

---

## 1. 目录与文件结构

```
apps/server/
├── src/
│   ├── index.js                # 应用入口（创建 Fastify 实例，注册插件）
│   ├── plugins/                # Fastify 插件（全局中间件）
│   │   ├── session.js          # @fastify/session 配置
│   │   ├── cors.js             # @fastify/cors 配置
│   │   └── auth.js             # 认证 preHandler
│   ├── routes/                 # 业务路由（每个文件一个 Fastify plugin）
│   │   ├── auth.js             # POST /auth/login, /auth/logout, /auth/register
│   │   ├── memos.js            # GET/POST/PUT/DELETE /memos
│   │   └── tags.js             # GET /tags
│   ├── db/
│   │   ├── schema.js           # Drizzle 表定义（唯一数据源）
│   │   ├── index.js            # Drizzle 实例导出
│   │   └── migrations/         # 自动生成的迁移文件（不手动编辑）
│   └── lib/
│       ├── errors.js           # 统一错误类定义
│       └── password.js         # 密码哈希工具
├── drizzle.config.js           # Drizzle Kit 配置
└── package.json
```

---

## 2. 应用入口规范

```js
// src/index.js
import Fastify from 'fastify';
import { sessionPlugin } from './plugins/session.js';
import { corsPlugin } from './plugins/cors.js';
import { authRoutes } from './routes/auth.js';
import { memoRoutes } from './routes/memos.js';
import { tagRoutes } from './routes/tags.js';

const app = Fastify({
  logger: process.env.NODE_ENV !== 'test',  // 测试环境关闭日志
});

// 注册全局插件（顺序重要）
await app.register(corsPlugin);
await app.register(sessionPlugin);

// 注册业务路由（统一 /api 前缀）
await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(memoRoutes, { prefix: '/api/memos' });
await app.register(tagRoutes, { prefix: '/api/tags' });

// 全局错误处理
app.setErrorHandler((error, request, reply) => {
  request.log.error(error);

  if (error.statusCode) {
    return reply.status(error.statusCode).send({
      data: null,
      error: error.code ?? 'ERROR',
      message: error.message,
    });
  }

  if (error.validation) {
    return reply.status(400).send({
      data: null,
      error: 'VALIDATION_ERROR',
      message: '请求参数不合法',
    });
  }

  const isProd = process.env.NODE_ENV === 'production';
  return reply.status(500).send({
    data: null,
    error: 'INTERNAL_ERROR',
    message: isProd ? '服务器内部错误' : error.message,
  });
});

const port = Number(process.env.PORT) || 3000;
await app.listen({ port, host: '0.0.0.0' });
```

---

## 3. 路由 Plugin 规范

每个路由文件导出一个 Fastify plugin，使用 **JSON Schema** 做请求验证。

```js
// src/routes/memos.js
import fp from 'fastify-plugin';
import { db } from '../db/index.js';
import { memos } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { requireAuth } from '../plugins/auth.js';

// JSON Schema 定义（Fastify 原生支持，无需额外库）
const createMemoSchema = {
  body: {
    type: 'object',
    required: ['content'],
    properties: {
      content: { type: 'string', minLength: 1, maxLength: 10000 },
    },
  },
};

const memoParamsSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' },
    },
  },
};

async function memoRoutes(fastify) {
  // GET /api/memos
  fastify.get('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.session.userId;
    const rows = await db
      .select()
      .from(memos)
      .where(eq(memos.userId, userId))
      .orderBy(desc(memos.createdAt));

    return reply.send({ data: rows, message: 'ok' });
  });

  // POST /api/memos
  fastify.post('/', {
    preHandler: [requireAuth],
    schema: createMemoSchema,
  }, async (request, reply) => {
    const userId = request.session.userId;
    const { content } = request.body;

    const [memo] = await db
      .insert(memos)
      .values({ content, userId })
      .returning();

    return reply.status(201).send({ data: memo, message: '创建成功' });
  });

  // DELETE /api/memos/:id
  fastify.delete('/:id', {
    preHandler: [requireAuth],
    schema: memoParamsSchema,
  }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.session.userId;

    await db
      .delete(memos)
      .where(eq(memos.id, id) && eq(memos.userId, userId));

    return reply.status(204).send();
  });
}

export { memoRoutes };
```

**规则**：
- 每个路由文件只处理一个资源（memos / tags / auth）
- 请求体、路径参数使用 JSON Schema 验证（Fastify 内置，无需额外依赖）
- 业务路由加 `preHandler: [requireAuth]`，不要在 handler 内手动检查 session
- Handler 只做数据库操作和响应，复杂业务逻辑抽到 `lib/` 服务函数

---

## 4. Fastify Plugin 规范

```js
// src/plugins/session.js
import fp from 'fastify-plugin';
import fastifySession from '@fastify/session';
import fastifyCookie from '@fastify/cookie';

// 必须用 fp() 包裹才能共享装饰（跨 scope 可见）
export const sessionPlugin = fp(async (fastify) => {
  await fastify.register(fastifyCookie);
  await fastify.register(fastifySession, {
    secret: process.env.SESSION_SECRET,    // 必须 >= 32 字符
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,    // 7 天
    },
    store: sessionStore,                    // SQLite session store
  });
});

// src/plugins/auth.js
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

**规则**：
- 全局共享的插件（session、cors）必须用 `fastify-plugin`（`fp()`）包裹
- 路由级别的 preHandler 不需要 `fp()`
- `process.env` 在运行时读取，不在模块顶层解构

---

## 5. Drizzle ORM Schema 规范

```js
// src/db/schema.js
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// 表名：snake_case
// 字段名：camelCase（JS 侧），映射到 snake_case 列名（DB 侧）

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

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

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
});

export const memoTags = sqliteTable('memo_tags', {
  memoId: text('memo_id').notNull().references(() => memos.id, { onDelete: 'cascade' }),
  tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
});
```

### 5.1 Drizzle 查询规范

```js
import { db } from '../db/index.js';
import { memos } from '../db/schema.js';
import { eq, desc, like, and } from 'drizzle-orm';

// ✅ 参数化查询（Drizzle 默认行为，自动防 SQL 注入）
const userMemos = await db
  .select()
  .from(memos)
  .where(eq(memos.userId, userId))
  .orderBy(desc(memos.createdAt));

// ✅ 关键词搜索
const results = await db
  .select()
  .from(memos)
  .where(and(
    eq(memos.userId, userId),
    like(memos.content, `%${keyword}%`)
  ));

// ✅ 插入并返回
const [newMemo] = await db.insert(memos).values({ content, userId }).returning();

// ✅ 更新
await db.update(memos)
  .set({ content, updatedAt: new Date().toISOString() })
  .where(and(eq(memos.id, id), eq(memos.userId, userId)));

// ❌ 禁止原生 SQL 字符串拼接
// db.run(`SELECT * FROM memos WHERE user_id = '${userId}'`);
```

### 5.2 Drizzle Kit 配置

```js
// drizzle.config.js
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.js',
  out: './src/db/migrations',
  dbCredentials: {
    url: process.env.DB_PATH ?? './data/aiflomo.db',
  },
});
```

---

## 6. 错误处理规范

```js
// src/lib/errors.js

export class AppError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(404, `${resource} not found`, 'NOT_FOUND');
  }
}

export class ForbiddenError extends AppError {
  constructor() {
    super(403, 'Forbidden', 'FORBIDDEN');
  }
}
```

在路由中通过 `throw` 抛出，由 `index.js` 的全局 `setErrorHandler` 统一处理：

```js
// 路由内使用
import { NotFoundError, ForbiddenError } from '../lib/errors.js';

throw new NotFoundError('Memo');
throw new ForbiddenError();
```

---

## 7. 响应格式规范

所有接口必须返回统一结构：

```js
// 成功
{ data: value, message: string }

// 失败（由全局 errorHandler 处理）
{ data: null, error: string, message: string }
```

```js
// ✅ 成功示例
reply.status(200).send({ data: memo, message: 'ok' });
reply.status(201).send({ data: newMemo, message: '创建成功' });
reply.status(204).send();                     // 删除成功，无 body
```

---

## 8. 环境变量规范

```bash
# 根目录 .env（统一管理，提交 Git）
NODE_ENV=development
PORT=3000
DB_PATH=./data/aiflomo.db
SESSION_SECRET=replace-with-32-char-random-string-here
CORS_ORIGIN=http://localhost:8081
```

- 所有环境变量统一写入**根目录 `.env`**，提交 Git
- 代码中通过 `process.env.VAR_NAME` 读取，禁止硬编码
