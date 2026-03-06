<!--
  ===================================================
  sdd-codegen.md — 逐任务代码生成 Prompt
  ===================================================

  用途: 根据设计文档和任务描述，为单个任务生成符合项目规范的 JavaScript 代码
  调用方: sdd-codegen.yml → job: run（循环调用，每次处理一个任务）
  ===================================================
-->

## PROJECT CONSTITUTION (MUST FOLLOW — HIGHEST PRIORITY)

${CONSTITUTION}

---

## PROJECT GUIDE (CLAUDE.md — read for tech stack, directory structure, naming rules, scripts)

${CLAUDE_MD}

---

You are an expert JavaScript engineer implementing one specific task in AIFlomo.

## Current Task

**Task ${TASK_INDEX} of ${TASK_COUNT}: ${TASK_NAME}**

${TASK_DESC}

## Files Written by Previous Tasks — DO NOT TOUCH OR REWRITE THESE

${ALREADY}

---

## Step-by-Step Instructions

### Phase 1 — Context gathering (READ ONLY, no writes)

1. **读取项目规范**：`CLAUDE.md` — 技术栈、目录结构、命名规则、编码规范
2. **读取代码标准**：先执行 `Bash(ls docs/standards/)` 查看所有文件，再逐一读取
3. **读取 Spec 文件**：`${SPEC_FILES}` — 了解功能需求和用户故事
4. **读取技术方案（主要参考）**：`${DESIGN_FILE}` — 了解架构设计、接口定义、改动文件清单
5. **扫描现有代码结构**：`Bash(ls apps/server/src/)` 和 `Bash(ls apps/mobile/)` 了解当前目录
6. **读取目标文件**：如果当前任务要修改已存在的文件，必须先 Read 读取，理解现有实现再修改

完成以上读取后，再进入实现阶段。

---

### Phase 2 — Implementation

7. **只写本任务指定的文件** — 不得修改 `${ALREADY}` 中列出的任何文件
8. 按以下参考模式实现各类文件：

---

**Drizzle Schema** (`apps/server/src/db/schema.js`):
```js
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});
```

**Drizzle DB instance** (`apps/server/src/db/index.js`):
```js
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema.js';

const sqlite = new Database(process.env.DB_PATH ?? './data/aiflomo.db');
export const db = drizzle(sqlite, { schema });
```

**Fastify Route Plugin** (`apps/server/src/routes/xxx.js`):
```js
import { requireAuth } from '../plugins/auth.js';
import { db } from '../db/index.js';
import { memos } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';

export async function memoRoutes(fastify) {
  // GET /api/memos
  fastify.get('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const rows = await db.select().from(memos)
      .where(eq(memos.userId, request.session.userId))
      .orderBy(desc(memos.createdAt));
    return reply.send({ data: rows, message: 'ok' });
  });

  // POST /api/memos
  fastify.post('/', {
    preHandler: [requireAuth],
    schema: {
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string', minLength: 1, maxLength: 10000 },
        },
      },
    },
  }, async (request, reply) => {
    const [memo] = await db.insert(memos)
      .values({ content: request.body.content, userId: request.session.userId })
      .returning();
    return reply.status(201).send({ data: memo, message: '创建成功' });
  });
}
```

**Auth plugin** (`apps/server/src/plugins/auth.js`):
```js
export async function requireAuth(request, reply) {
  if (!request.session.userId) {
    return reply.status(401).send({ data: null, error: 'Unauthorized', message: '请先登录' });
  }
}
```

**Error classes** (`apps/server/src/lib/errors.js`):
```js
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
```

**Expo Route/Page** (`apps/mobile/app/xxx.jsx`):
```jsx
import { View, Text, FlatList } from 'react-native';
import { useMemos } from '@/hooks/use-memos';

export default function MemosScreen() {
  const { memos, isLoading } = useMemos();
  if (isLoading) return <Text>加载中...</Text>;
  return (
    <FlatList
      data={memos}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <Text>{item.content}</Text>}
    />
  );
}
```

**Expo Component** (`apps/mobile/components/PascalCase.jsx`):
```jsx
import { View, Text, Pressable, StyleSheet } from 'react-native';

export function MemoCard({ content, onPress }) {
  return (
    <Pressable style={styles.container} onPress={onPress}>
      <Text style={styles.content}>{content}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff', borderRadius: 8, marginBottom: 8 },
  content: { fontSize: 14, lineHeight: 22, color: '#333' },
});
```

**React Context** (`apps/mobile/context/XxxContext.jsx`):
```jsx
import { createContext, useContext, useReducer } from 'react';

function reducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING': return { ...state, isLoading: action.payload };
    case 'SET_DATA':    return { ...state, isLoading: false, data: action.payload };
    default: return state;
  }
}

const XxxContext = createContext(null);

export function XxxProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, { data: [], isLoading: false, error: null });
  return <XxxContext.Provider value={{ state, dispatch }}>{children}</XxxContext.Provider>;
}

export function useXxxContext() {
  const ctx = useContext(XxxContext);
  if (!ctx) throw new Error('useXxxContext must be used within XxxProvider');
  return ctx;
}
```

**Custom Hook** (`apps/mobile/hooks/use-xxx.js`):
```js
import { useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { useXxxContext } from '@/context/XxxContext';

export function useXxx() {
  const { state, dispatch } = useXxxContext();

  const fetchData = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const data = await api.get('/xxx');
      dispatch({ type: 'SET_DATA', payload: data });
    } catch {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [dispatch]);

  useEffect(() => { fetchData(); }, [fetchData]);
  return { ...state, refetch: fetchData };
}
```

**API Client** (`apps/mobile/lib/api-client.js`):
```js
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

export const api = {
  get:    (path)        => request(path),
  post:   (path, body)  => request(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    (path, body)  => request(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: (path)        => request(path, { method: 'DELETE' }),
};
```

---

### Phase 3 — Self-verification (写完所有文件后逐项检查)

9. 重读你刚写的每个文件，逐项确认：
   - 每个受保护的路由都有 `preHandler: [requireAuth]`？
   - 每个 Fastify 路由成功时返回 `{ data, message }`，失败时返回 `{ data: null, error, message }`？
   - 所有 Drizzle 查询都使用 ORM 方法，没有拼接原始 SQL 字符串？
   - 用户输入在使用前通过 Fastify schema 或手动校验过？
   - 没有硬编码密钥或 API Key，全部从 `process.env` 读取？
   - 前端组件用纯 `<Text>` 渲染用户内容，没有 `dangerouslySetInnerHTML`？
   - 文件扩展名：后端 `.js`，组件/页面 `.jsx`？

### Phase 4 — Output

10. 列出本次创建或修改的每个文件，每行一个：

```
WRITTEN: apps/server/src/routes/memos.js
WRITTEN: apps/mobile/components/MemoCard.jsx
```

---

## Hard Prohibitions

- Do NOT use TypeScript — no `.ts`/`.tsx` files, no type annotations
- Do NOT add new npm packages without explicit spec requirement
- Do NOT write test files (tests are generated separately by the testcase pipeline)
- Do NOT add comments unless the logic is genuinely non-obvious
- Do NOT refactor, rename, or reformat code outside this task's target files
- Do NOT implement features from future tasks "while you're at it"
- Do NOT use Redux or Zustand — use React Context + useReducer
- Do NOT use raw SQL — use Drizzle ORM parameterized queries only
