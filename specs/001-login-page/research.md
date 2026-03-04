# Research: 001-login-page

**日期**: 2026-03-04
**阶段**: Phase 0

---

## 1. Fastify Session Auth 方案

### Decision
使用 `@fastify/cookie` + `@fastify/session`（内存 store），不引入 connect-sqlite3（MVP 简化）。

### Rationale
- 内存 store 对单进程 MVP 足够，Session 随进程重启丢失（用户需重新登录）
- `connect-sqlite3` 需要额外 npm 包，CONSTITUTION 要求不引入非必要依赖
- MVP 后续可升级到 SQLite session store

### Plugin 注册顺序（Fastify v5）
```
@fastify/cookie → @fastify/session → 业务路由
```
`@fastify/session` 依赖 `@fastify/cookie`，注册顺序不能颠倒。
均需用 `fp()` 包裹以跨 scope 共享。

### Session 配置关键点
```js
await fastify.register(fastifyCookie);
await fastify.register(fastifySession, {
  secret: process.env.SESSION_SECRET,  // >= 32 chars
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
  },
  // store: 省略 = 内存 store (MVP)
});
```

### requireAuth preHandler
```js
export async function requireAuth(request, reply) {
  if (!request.session.userId) {
    return reply.status(401).send({
      data: null, error: 'UNAUTHORIZED', message: '请先登录',
    });
  }
}
```

---

## 2. 密码哈希方案

### Decision
使用 `bcrypt`（saltRounds = 10）。

### Rationale
- 工业标准，内置盐值，抗彩虹表攻击
- `bcryptjs`（纯 JS）作为备选，无原生模块编译问题；但 `bcrypt` 更快
- 推荐 `bcrypt`，构建时需要 node-gyp，CI/CD 需确保 build tools 可用

### 用法（ESM）
```js
import bcrypt from 'bcrypt';
const hash = await bcrypt.hash(password, 10);
const match = await bcrypt.compare(password, hash);
```

---

## 3. 数据库字段设计

### Decision
`users` 表使用 `username`（非 `email`），与 MVP 账号 `yixiang` 对齐。

### Rationale
- 需求明确指定账号密码格式（username/password），无需 email
- 后续可扩展 email 字段

### Schema
```js
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});
```

---

## 4. Expo Router 认证路由方案

### Decision
使用 `(auth)` / `(app)` 路由分组 + `<Redirect>` 模式（兼容性最佳）。

### Rationale
- `Stack.Protected` 是 Expo Router v5+ 新 API，兼容性存疑
- `<Redirect href="/(auth)/login">` 方式更稳定，与 Expo Router 文档一致
- 项目标准文档已定义此模式

### 路由结构
```
app/
├── _layout.jsx          # 根布局：AuthProvider 包裹，session 检查中显示加载
├── (auth)/
│   ├── _layout.jsx      # 公开布局（无保护）
│   └── login.jsx        # 登录页
└── (app)/
    ├── _layout.jsx      # 保护布局：session=null → <Redirect to="/login">
    └── index.jsx        # 主应用占位页
```

### 认证状态检查
- App 启动时调用 `GET /api/auth/me`，检查 Session 是否有效
- `isLoading=true` 时显示加载，防止闪烁
- Session 有效 → user 存入 Context，进入 `(app)` 路由组
- Session 无效 → user=null，进入 `(auth)` 路由组

---

## 5. Monorepo 根 package.json

### Decision
使用 npm workspaces，`apps/server` + `apps/mobile` 作为 workspace。

### 结构
```json
{
  "name": "aiflomo",
  "private": true,
  "workspaces": ["apps/server", "apps/mobile"],
  "scripts": {
    "dev:server": "npm run dev -w apps/server",
    "dev:mobile": "npm run dev -w apps/mobile"
  }
}
```

---

## 6. 环境变量

所有环境变量写入根目录 `.env`（提交 Git）：

```bash
# Server
NODE_ENV=development
PORT=3000
DB_PATH=./data/aiflomo.db
SESSION_SECRET=aiflomo-dev-secret-key-minimum-32-chars!!
CORS_ORIGIN=http://localhost:8081

# Mobile (Expo)
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

---

## 7. Alternatives Considered

| 方案 | 结论 |
|------|------|
| JWT 替代 Session | 否，项目标准明确要求 Session + Cookie |
| connect-sqlite3 session store | 否，MVP 不需要持久化 session |
| email 替代 username | 否，需求明确账号为 yixiang |
| argon2 替代 bcrypt | 否，bcrypt 已足够，argon2 需额外依赖 |
| TypeScript | 否，CONSTITUTION 明确禁止 |
