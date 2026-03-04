# Implementation Plan: 账号密码登录页

**Branch**: `001-login-page` | **Date**: 2026-03-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-login-page/spec.md`

---

## Summary

实现一个完整的登录功能，包含 Fastify 后端（auth 路由 + Session）和 Expo 前端（登录页 + AuthContext）。
MVP 阶段使用预置账号 `yixiang/666666`，密码以 bcrypt hash 存储于 SQLite。
登录成功后建立 Session Cookie，前端基于此实现路由保护（未登录跳 `/login`，已登录跳主应用）。

---

## Technical Context

**Language/Version**: JavaScript (Node.js ESM, `"type": "module"`) + React Native (Expo SDK)
**Primary Dependencies**:
- 后端: `fastify@^5`, `@fastify/session`, `@fastify/cookie`, `@fastify/cors`, `drizzle-orm`, `better-sqlite3`, `bcrypt`, `fastify-plugin`
- 前端: `expo`, `expo-router`, `react-native`, `react`
- 工具: `drizzle-kit`, `dotenv`

**Storage**: SQLite（`better-sqlite3`）via Drizzle ORM；Session 使用内存 store（MVP）
**Testing**: midscene-pc（E2E，后续补充）
**Target Platform**: Web（Expo Web，主要），Android / iOS 次要
**Project Type**: Monorepo（npm workspaces）— Mobile app + API server
**Performance Goals**: N/A（MVP 阶段）
**Constraints**: 无需注册，仅预置账号；内存 Session Store（重启后需重新登录）
**Scale/Scope**: 单用户 MVP

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 规则 | 状态 | 说明 |
|------|------|------|
| NO raw SQL concatenation | ✅ PASS | 使用 Drizzle ORM 参数化查询 |
| NO hardcoded secrets | ✅ PASS | SESSION_SECRET 通过 `.env` 注入 |
| NO modifying auth core without spec | ✅ PASS | 本 spec 显式要求实现 auth |
| NO overwriting files without reading | ✅ PASS | 项目从零开始，无需覆盖 |
| NO new deps without spec requirement | ✅ PASS | bcrypt、@fastify/session 均在标准 stack 内 |
| NO TypeScript | ✅ PASS | 纯 JavaScript (.js / .jsx) |
| NO Redux/Zustand | ✅ PASS | 使用 React Context + useReducer |
| ALL API responses unified `{data, message}` | ✅ PLAN | 所有 handler 均遵循此格式 |
| ALL input validated frontend + backend | ✅ PLAN | 前端空值校验 + Fastify JSON Schema |
| HTTP status codes accurate | ✅ PLAN | 401 未认证，200 成功，400 参数错误 |
| preHandler: [requireAuth] for protected routes | ✅ PLAN | memo 等路由会加此 preHandler（本期不实现） |

---

## Project Structure

### Documentation (this feature)

```text
specs/001-login-page/
├── plan.md              ← 本文件
├── spec.md              ← 功能规格
├── research.md          ← Phase 0 研究结论
├── data-model.md        ← Phase 1 数据模型
├── quickstart.md        ← Phase 1 快速启动指南
├── contracts/
│   └── auth-api.md      ← Phase 1 API 契约
└── tasks.md             ← Phase 2 任务拆解（待生成）
```

### Source Code (repository root)

```text
AIFlomo/
├── package.json                    # 根 monorepo（npm workspaces）
├── .env                            # 环境变量（统一管理，提交 Git）
│
├── apps/
│   ├── server/                     # Fastify 后端
│   │   ├── package.json
│   │   ├── drizzle.config.js
│   │   └── src/
│   │       ├── index.js            # 入口（Fastify 实例 + 插件注册）
│   │       ├── plugins/
│   │       │   ├── cors.js         # @fastify/cors 配置
│   │       │   ├── session.js      # @fastify/cookie + @fastify/session
│   │       │   └── auth.js         # requireAuth preHandler
│   │       ├── routes/
│   │       │   └── auth.js         # /login, /logout, /me
│   │       ├── db/
│   │       │   ├── schema.js       # users 表定义
│   │       │   ├── index.js        # Drizzle 实例
│   │       │   ├── seed.js         # 种子数据（yixiang/666666）
│   │       │   └── migrations/     # 自动生成，不手动编辑
│   │       └── lib/
│   │           ├── errors.js       # AppError / NotFoundError / ForbiddenError
│   │           └── password.js     # hashPassword / comparePassword (bcrypt)
│   │
│   └── mobile/                     # Expo 前端
│       ├── package.json
│       ├── app.json
│       ├── babel.config.js
│       ├── app/
│       │   ├── _layout.jsx         # 根布局（AuthProvider）
│       │   ├── (auth)/
│       │   │   ├── _layout.jsx     # 公开路由布局
│       │   │   └── login.jsx       # 登录页
│       │   └── (app)/
│       │       ├── _layout.jsx     # 保护路由（session=null → Redirect）
│       │       └── index.jsx       # 主应用占位页
│       ├── context/
│       │   └── AuthContext.jsx     # 认证状态管理
│       └── lib/
│           └── api-client.js       # API 客户端（fetch + credentials）
│
└── specs/001-login-page/           ← 本 spec 目录
```

**Structure Decision**: 选择 Option 3 变体（Mobile App + API Server），符合项目定义的 Expo + Fastify monorepo 架构。

---

## Implementation Phases

### Phase A: 后端基础（先于前端）

**顺序**: 数据库 Schema → Drizzle 迁移 → 路由 → 入口

1. **根 package.json + .env**（monorepo 入口）
2. **`apps/server/package.json`**（server 子包，含 dev/build/lint/prod 四条标准脚本）
3. **`apps/server/drizzle.config.js`**（Drizzle Kit 配置）
4. **`apps/server/src/db/schema.js`**（users 表定义）
5. **`apps/server/src/db/index.js`**（Drizzle 实例导出）
6. **`apps/server/src/db/seed.js`**（种子脚本：yixiang/666666）
7. **`apps/server/src/lib/errors.js`**（AppError 类）
8. **`apps/server/src/lib/password.js`**（bcrypt 封装）
9. **`apps/server/src/plugins/cors.js`**
10. **`apps/server/src/plugins/session.js`**
11. **`apps/server/src/plugins/auth.js`**（requireAuth preHandler）
12. **`apps/server/src/routes/auth.js`**（login / logout / me）
13. **`apps/server/src/index.js`**（Fastify 入口，注册顺序：cors → session → routes）

执行迁移与种子：
```bash
npm run db:generate -w apps/server
npm run db:migrate -w apps/server
npm run db:seed -w apps/server
```

### Phase B: 前端基础（后于后端）

1. **`apps/mobile/package.json`**（含 dev/build/lint/prod 四条标准脚本）
2. **`apps/mobile/app.json`**（Expo 配置）
3. **`apps/mobile/babel.config.js`**（路径别名配置）
4. **`apps/mobile/lib/api-client.js`**（fetch + credentials: 'include'）
5. **`apps/mobile/context/AuthContext.jsx`**（useReducer，login/logout/me）
6. **`apps/mobile/app/_layout.jsx`**（根布局，包裹 AuthProvider）
7. **`apps/mobile/app/(auth)/_layout.jsx`**（公开路由布局）
8. **`apps/mobile/app/(auth)/login.jsx`**（登录页 UI）
9. **`apps/mobile/app/(app)/_layout.jsx`**（保护路由 + Redirect）
10. **`apps/mobile/app/(app)/index.jsx`**（主应用占位页）

---

## Key Design Decisions

| 决策 | 选择 | 理由 |
|------|------|------|
| Session Store | 内存（默认） | MVP 不需要持久化，省去依赖 |
| 密码哈希 | bcrypt（saltRounds=10） | 工业标准，抗彩虹表 |
| 用户字段 | `username`（非 email） | 需求明确账号为 yixiang |
| 路由保护 | `<Redirect href="/(auth)/login">` | 兼容性最佳，Expo Router 标准模式 |
| Session 检查 | App 启动时调 `GET /api/auth/me` | 恢复登录状态，防止闪烁 |
| 错误信息 | "用户名或密码错误"（不分开） | 防止用户枚举攻击 |

---

## Complexity Tracking

无 Constitution 违规，无需 Complexity Tracking。

---

## Phase 0 Research Summary

→ 详见 [research.md](./research.md)

关键结论：
- 插件注册顺序：`cors` → `@fastify/cookie` → `@fastify/session` → 业务路由
- MVP 用内存 store，后续可升级 `fastify-session-better-sqlite3-store`
- `bcrypt.hash(password, 10)` + `bcrypt.compare(password, hash)`（ESM 兼容）
- Expo Router 用 `(auth)` / `(app)` 分组，`<Redirect>` 实现保护

---

## Phase 1 Design Summary

→ 详见 [data-model.md](./data-model.md)、[contracts/auth-api.md](./contracts/auth-api.md)、[quickstart.md](./quickstart.md)

关键设计：
- **数据模型**: `users(id, username, password_hash, created_at)`
- **API 契约**: `POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/me`
- **前端路由**: `(auth)/login.jsx` + `(app)/index.jsx`（受保护）

---

## Next Step

运行 `/speckit.tasks` 生成 `tasks.md`，将上述 Phase A/B 拆解为可执行任务并分配顺序。
