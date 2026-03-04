# Tasks: 账号密码登录页 (001-login-page)

**Input**: Design documents from `/specs/001-login-page/`
**Branch**: `001-login-page`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Tests**: 本期不含单元测试任务（E2E 测试后续补充，MVP 阶段以手动验证为主）

**Organization**: 任务按用户故事分组，支持独立实现和验证。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行执行（不同文件，无未完成依赖）
- **[Story]**: 所属用户故事（US1, US2）
- 路径均为相对项目根目录的完整路径

---

## Phase 1: Setup (Monorepo 基础结构)

**Purpose**: 初始化 monorepo，建立子包骨架，配置环境变量。

- [X] T001 Create root `package.json` with npm workspaces config for `apps/server` and `apps/mobile`
- [X] T002 Create root `.env` with `NODE_ENV`, `PORT`, `DB_PATH`, `SESSION_SECRET`, `CORS_ORIGIN`, `EXPO_PUBLIC_API_URL`
- [X] T003 [P] Create `apps/server/package.json` with Fastify/Drizzle/bcrypt deps and `dev`/`build`/`lint`/`prod`/`db:generate`/`db:migrate`/`db:seed` scripts
- [X] T004 [P] Create `apps/mobile/package.json` with Expo/React Native deps and `dev`/`build`/`lint`/`prod` scripts
- [X] T005 [P] Create `apps/mobile/app.json` with Expo app configuration (name: AIFlomo, slug: aiflomo)
- [X] T006 [P] Create `apps/mobile/babel.config.js` with `babel-preset-expo` and `module-resolver` alias (`@` → `./`)

---

## Phase 2: Foundational (后端 DB + 插件核心)

**Purpose**: 建立数据库 Schema、Drizzle 实例、Fastify 插件——所有用户故事的阻塞前提。

**⚠️ CRITICAL**: US1 和 US2 的实现均依赖本阶段完成。

- [X] T007 [P] Create `apps/server/drizzle.config.js` — `dialect: 'sqlite'`, schema `./src/db/schema.js`, out `./src/db/migrations`, dbCredentials from `DB_PATH`
- [X] T008 [P] Create `apps/server/src/db/schema.js` — `users` table: `id` (text PK uuid), `username` (text unique notNull), `passwordHash` (text notNull), `createdAt` (text default CURRENT_TIMESTAMP)
- [X] T009 Create `apps/server/src/db/index.js` — Drizzle instance via `drizzle(Database(process.env.DB_PATH))`, export `db`; depends on T008
- [X] T010 [P] Create `apps/server/src/lib/errors.js` — `AppError` base class with `statusCode` + `code`; `NotFoundError` (404); `ForbiddenError` (403)
- [X] T011 [P] Create `apps/server/src/lib/password.js` — `hashPassword(password)` using `bcrypt.hash(password, 10)`; `comparePassword(password, hash)` using `bcrypt.compare`
- [X] T012 [P] Create `apps/server/src/db/seed.js` — insert `yixiang` with hashed `666666` using `INSERT OR IGNORE`; depends on T008, T011
- [X] T013 [P] Create `apps/server/src/plugins/cors.js` — `fp()` wrapped, `@fastify/cors` with `origin: process.env.CORS_ORIGIN`, `credentials: true`
- [X] T014 [P] Create `apps/server/src/plugins/session.js` — `fp()` wrapped; register `@fastify/cookie` then `@fastify/session` with `httpOnly: true`, `sameSite: 'strict'`, `secure: NODE_ENV==='production'`, `maxAge: 7d`
- [X] T015 [P] Create `apps/server/src/plugins/auth.js` — export `requireAuth(request, reply)` preHandler; check `request.session.userId`, return 401 `{ data: null, error: 'UNAUTHORIZED', message: '请先登录' }` if missing
- [X] T016 [P] Create `apps/mobile/lib/api-client.js` — `fetch` wrapper with `credentials: 'include'`, `Content-Type: application/json`; `BASE_URL` from `EXPO_PUBLIC_API_URL`; export `api.get/post/put/delete`

**Checkpoint**: `npm install` 成功后可运行 `npm run db:generate && npm run db:migrate && npm run db:seed -w apps/server`

---

## Phase 3: US1 — 账号密码登录 (Priority: P1) 🎯 MVP

**Goal**: 用户输入 `yixiang` / `666666` 可成功登录，失败时显示错误，空字段前端校验拦截。

**Independent Test**:
```bash
# 后端验证
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"yixiang","password":"666666"}' -c cookies.txt
# 期望: {"data":{"id":"...","username":"yixiang"},"message":"登录成功"}

curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"wrong","password":"wrong"}' -c cookies.txt
# 期望: 401 {"data":null,"error":"AUTH_FAILED","message":"用户名或密码错误"}

# 前端：浏览器访问 http://localhost:8081 → 输入 yixiang/666666 → 跳转成功页
```

### Implementation for User Story 1

- [X] T017 [US1] Create `apps/server/src/routes/auth.js` — `authRoutes` Fastify plugin: `POST /login` (JSON Schema: username/password string required, minLength 1); query users by username via Drizzle, comparePassword, set `request.session.userId` + `request.session.username`, return `{ data: { id, username }, message: '登录成功' }`; `POST /logout` destroys session; `GET /me` returns session user or 401; depends on T009, T010, T011
- [X] T018 [US1] Create `apps/server/src/index.js` — Fastify instance with `logger: NODE_ENV !== 'test'`; register in order: `corsPlugin` → `sessionPlugin` → `authRoutes` at `/api/auth`; global `setErrorHandler` returning `{ data: null, error, message }`; listen on `PORT` / `0.0.0.0`; depends on T013, T014, T015, T017
- [X] T019 [P] [US1] Create `apps/mobile/context/AuthContext.jsx` — `AuthProvider` + `useAuth()` hook; `useReducer` with states: `{ user, isLoading, isAuthenticating, error }`; actions: `RESTORE_SESSION`, `LOGIN_START`, `LOGIN_SUCCESS`, `LOGIN_ERROR`, `LOGOUT_SUCCESS`, `CLEAR_ERROR`; `useEffect` on mount calls `api.get('/auth/me')` to restore session; export `login(username, password)`, `logout()`, `clearError()`; depends on T016
- [X] T020 [US1] Create `apps/mobile/app/_layout.jsx` — root Stack layout; wrap with `<AuthProvider>`; `screenOptions={{ headerShown: false }}`; depends on T019
- [X] T021 [P] [US1] Create `apps/mobile/app/(auth)/_layout.jsx` — simple `<Stack screenOptions={{ headerShown: false }}>` for public routes
- [X] T022 [US1] Create `apps/mobile/app/(auth)/login.jsx` — default export `LoginScreen`; `KeyboardAvoidingView` container; `TextInput` for username (autoCapitalize: 'none') and password (secureTextEntry); local `useState` for field values + `validationError`; `handleLogin` validates non-empty → calls `useAuth().login()` → `router.replace('/(app)')` on success; show `isAuthenticating` ActivityIndicator; show `error` and `validationError` as red Text; `StyleSheet.create` for all styles; green theme `#4caf50`; depends on T019

**Checkpoint**: `npm run dev -w apps/server` + `npm run dev -w apps/mobile` → 登录功能完整可用（含错误提示）

---

## Phase 4: US2 — Session 保持与路由保护 (Priority: P2)

**Goal**: 刷新页面保持登录状态；已登录用户访问 `/login` 自动跳转主应用；未登录用户访问受保护路由自动跳转登录页。

**Independent Test**:
```bash
# Session 保持：登录后刷新浏览器 → 仍在主应用页（不跳登录页）
# 路由保护：清除 Cookie 后访问 http://localhost:8081 → 自动跳转 /login
# 已登录跳转：已登录状态访问 http://localhost:8081/login → 自动跳到 /(app)
```

### Implementation for User Story 2

- [X] T023 [US2] Create `apps/mobile/app/(app)/_layout.jsx` — `useAuth()` 获取 `{ user, isLoading }`; `isLoading` 时返回居中 `<ActivityIndicator>`; `!user` 时返回 `<Redirect href="/(auth)/login" />`; 否则返回 `<Stack screenOptions={{ headerShown: false }}>`; depends on T019
- [X] T024 [US2] Create `apps/mobile/app/(app)/index.jsx` — default export `HomeScreen`; 显示"欢迎回来，{user.username}"文本占位页 + 退出按钮（调用 `useAuth().logout()` → `router.replace('/(auth)/login')`）; `StyleSheet.create` for styles; depends on T019, T023

**Checkpoint**: Session Cookie 保持、路由保护、自动跳转均正常工作。

---

## Phase 5: Polish & 验证

**Purpose**: 运行迁移和种子、lint 检查、端到端手动验证。

- [X] T025 Run database setup in `apps/server`: `npm run db:generate && npm run db:migrate && npm run db:seed`
- [X] T026 [P] Run `npm run lint -w apps/server` and fix any ESLint errors
- [X] T027 [P] Run `npm run lint -w apps/mobile` and fix any ESLint errors
- [X] T028 Verify full login flow per `specs/001-login-page/quickstart.md` acceptance criteria (all 6 items pass)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 无依赖，立即开始
- **Phase 2 (Foundational)**: 依赖 Phase 1 完成 — **阻塞 US1 和 US2**
- **Phase 3 (US1)**: 依赖 Phase 2 完成
- **Phase 4 (US2)**: 依赖 Phase 3 完成（T023/T024 依赖 T019/AuthContext）
- **Phase 5 (Polish)**: 依赖所有实现完成

### 关键依赖链（后端）

```
T008 (schema) → T009 (db/index) → T017 (auth routes) → T018 (index.js, entry)
T011 (password) ↗
T010 (errors)  ↗
T013 (cors) ↘
T014 (session) → T018 (index.js)
T015 (auth.js) ↗
```

### 关键依赖链（前端）

```
T016 (api-client) → T019 (AuthContext) → T022 (login.jsx)
                                         → T020 (_layout.jsx)
                                         → T023 ((app)/_layout.jsx) → T024 (index.jsx)
```

### 并行机会

- **Phase 1**: T003–T006 完全并行（4 个不同文件）
- **Phase 2**: T007–T016 大部分并行（T009 依赖 T008，其余独立）
- **Phase 3 US1**: T019–T021 可并行（AuthContext、root layout、auth layout 分属不同文件）
- **Phase 4 US2**: T023 + T024 内部独立（T024 依赖 T023 完成）

---

## Parallel Example: Phase 2

```bash
# 同时启动（不同文件，无依赖冲突）：
Task: "Create apps/server/drizzle.config.js"       # T007
Task: "Create apps/server/src/db/schema.js"        # T008
Task: "Create apps/server/src/lib/errors.js"       # T010
Task: "Create apps/server/src/lib/password.js"     # T011
Task: "Create apps/server/src/plugins/cors.js"     # T013
Task: "Create apps/server/src/plugins/session.js"  # T014
Task: "Create apps/server/src/plugins/auth.js"     # T015
Task: "Create apps/mobile/lib/api-client.js"       # T016

# 等待 T008 完成后再启动：
Task: "Create apps/server/src/db/index.js"         # T009
Task: "Create apps/server/src/db/seed.js"          # T012
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational（关键阻塞）
3. 完成 Phase 3: US1 登录功能
4. **STOP & VALIDATE**: 手动测试登录流程（quickstart.md 验收标准 1–3）
5. 可独立演示登录功能

### Incremental Delivery

1. Phase 1 + Phase 2 → 后端可运行
2. Phase 3 US1 → 登录可用 → Demo MVP
3. Phase 4 US2 → Session 保持 + 路由保护完整
4. Phase 5 Polish → 代码质量达标

### 单开发者建议顺序

```
T001 → T002 → T003 → T004 → T005 → T006   (Phase 1, 约 20 min)
T007 → T008 → T009 → T010 → T011          (Phase 2 后端 DB, 约 20 min)
T012 → T013 → T014 → T015 → T016          (Phase 2 插件, 约 20 min)
T017 → T018                               (US1 后端路由, 约 20 min)
T019 → T020 → T021 → T022                 (US1 前端, 约 30 min)
T023 → T024                               (US2 路由保护, 约 15 min)
T025 → T026 → T027 → T028                 (Polish, 约 10 min)
```

---

## Notes

- `[P]` 任务 = 操作不同文件，可并行分配给不同 Agent
- `[Story]` 标签用于追踪实现与用户故事的对应关系
- 每个 Phase 结束时验证 Checkpoint 再继续
- 不要跳过 Phase 5 的 `npm run lint`（CONSTITUTION 要求）
- 验收标准参考 `specs/001-login-page/spec.md` Section 4
