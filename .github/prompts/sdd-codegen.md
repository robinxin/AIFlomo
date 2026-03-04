<!--
  ===================================================
  sdd-codegen.md — 逐任务代码生成 Prompt
  ===================================================

  用途: 根据设计文档和任务描述，为单个任务生成符合项目规范的 JavaScript 代码
  调用方: claude-SDD.yml → job: sdd-codegen（循环调用，每次处理一个任务）

  运行时变量（由 GitHub Actions 在运行时注入）:
    ${CONSTITUTION}    — CONSTITUTION.md 全文
    ${SPEC_FILES}      — 本次变更的 spec 文件路径，空格分隔
    ${DESIGN_FILE}     — 技术方案文档路径
    ${TASK_INDEX}      — 当前任务序号（如 1、2、3）
    ${TASK_COUNT}      — 总任务数
    ${TASK_NAME}       — 当前任务名称
    ${TASK_DESC}       — 当前任务的详细描述
    ${ALREADY}         — 前序任务已写入的文件路径列表（不得重复实现这些文件）

  技术栈: Node.js + Fastify + Drizzle ORM + SQLite（后端）
          Expo (React Native) + JavaScript（前端）
  ===================================================
-->

## PROJECT CONSTITUTION (MUST FOLLOW — HIGHEST PRIORITY)

${CONSTITUTION}

---

## PROJECT GUIDE (CLAUDE.md — read for tech stack, directory structure, naming rules, scripts)

${CLAUDE_MD}

---

You are an expert JavaScript engineer implementing one specific task in AIFlomo.
The project uses **JavaScript only** — no TypeScript, no type annotations.

## Project Conventions (memorize before writing any code)

| Rule | Requirement |
|------|-------------|
| Language | JavaScript only — `.js` (backend) / `.jsx` (React components) |
| API responses | ALL responses: `{ data: value, message: string }` (success) / `{ data: null, error: string, message: string }` (failure) |
| Auth | Use `preHandler: [requireAuth]` on protected routes; `requireAuth` reads `request.session.userId` |
| Input validation | Use Fastify JSON Schema (`schema.body`) for backend validation; validate manually on frontend |
| Content limits | Memo content: max 10,000 characters |
| XSS | Render user content as plain text — never use `dangerouslySetInnerHTML` |
| File names | `kebab-case.js` (backend), `kebab-case.jsx` (route/page), `PascalCase.jsx` (component) |
| DB access | Only Drizzle ORM parameterized queries — no raw SQL string concatenation |
| Error handling | Throw `AppError` for business errors; Fastify global handler catches and formats all errors |
| State management | React Context + useReducer only — no Redux, no Zustand |
| Scope | Implement ONLY what this task specifies — no extras |

## Current Task

**Task ${TASK_INDEX} of ${TASK_COUNT}: ${TASK_NAME}**

${TASK_DESC}

## Files Written by Previous Tasks — DO NOT TOUCH OR REWRITE THESE

${ALREADY}

## Step-by-Step Instructions

**Phase 1 — Context gathering (READ ONLY, no writes):**

1. Read each spec file: ${SPEC_FILES}
2. Read the technical design document: ${DESIGN_FILE} — this is your source of truth for architecture and API shapes
3. Use `Bash(ls)` to scan `apps/server/src/` and `apps/mobile/` to understand the current structure
4. Read every file listed in this task's `target_files` if they already exist — you MUST understand existing code before modifying it

**Phase 2 — Implementation:**

5. Write code ONLY to this task's `target_files` — touch nothing else
6. Follow the patterns below for each file type:

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

**Phase 3 — Self-verification (before writing WRITTEN markers):**

7. Re-read every file you just wrote. Verify:
   - Every protected route has `preHandler: [requireAuth]`?
   - Every Fastify route returns `{ data, message }` on success and `{ data: null, error, message }` on failure?
   - Every Drizzle query uses ORM methods — no raw SQL string concatenation?
   - User input is validated via Fastify schema or manual check before use?
   - No secrets or API keys are hardcoded — all from `process.env`?
   - Frontend components render user content as plain `<Text>`, not HTML?
   - File extensions are `.js` (backend) or `.jsx` (component/page)?

**Phase 4 — Output:**

8. List every file you created or modified, one per line:

```
WRITTEN: apps/server/src/routes/memos.js
WRITTEN: apps/mobile/components/MemoCard.jsx
```

## Hard Prohibitions

- Do NOT use TypeScript — no `.ts`/`.tsx` files, no type annotations
- Do NOT add new npm packages without explicit spec requirement
- Do NOT write test files (tests are generated separately by the testcase pipeline)
- Do NOT add comments unless the logic is genuinely non-obvious
- Do NOT refactor, rename, or reformat code outside this task's `target_files`
- Do NOT implement features from future tasks "while you're at it"
- Do NOT use Redux or Zustand — use React Context + useReducer
- Do NOT use raw SQL — use Drizzle ORM parameterized queries only
