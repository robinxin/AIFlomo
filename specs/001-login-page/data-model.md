# Data Model: 001-login-page

**日期**: 2026-03-04

---

## 1. 实体列表

### 1.1 users（用户表）

**表名**: `users`
**文件**: `apps/server/src/db/schema.js`

| 字段 | 列名 | 类型 | 约束 | 描述 |
|------|------|------|------|------|
| `id` | `id` | TEXT | PK, NOT NULL | UUID，由 `crypto.randomUUID()` 生成 |
| `username` | `username` | TEXT | NOT NULL, UNIQUE | 登录账号，如 `yixiang` |
| `passwordHash` | `password_hash` | TEXT | NOT NULL | bcrypt hash（saltRounds=10）|
| `createdAt` | `created_at` | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 创建时间（ISO 8601） |

**Drizzle Schema**:
```js
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});
```

---

## 2. 数据关系图

```
users
  ├── id (PK)
  ├── username (UNIQUE)
  ├── password_hash
  └── created_at
```

MVP 阶段仅有 users 表。后续迭代将添加：
- `memos`（关联 `users.id`）
- `tags`（关联 `users.id`）
- `memo_tags`（关联 `memos.id` + `tags.id`）

---

## 3. 种子数据

**文件**: `apps/server/src/db/seed.js`

| username | password | hash（bcrypt, saltRounds=10） |
|----------|----------|-------------------------------|
| `yixiang` | `666666` | 运行时动态生成 |

种子脚本在 `npm run db:seed` 时执行，生产上线前只需运行一次。
脚本使用 `INSERT OR IGNORE` 避免重复插入。

---

## 4. 状态转换

### Session 生命周期

```
[未认证] → 调用 POST /api/auth/login（凭证正确）
         → request.session.userId = user.id
         → [已认证，Session Cookie 写入客户端]
         → 调用 POST /api/auth/logout
         → request.session.destroy()
         → [未认证，Cookie 清除]
```

---

## 5. 验证规则

| 字段 | 前端校验 | 后端 Schema 校验 |
|------|----------|-----------------|
| `username` | 非空 | `type: 'string', minLength: 1, maxLength: 50` |
| `password` | 非空 | `type: 'string', minLength: 1` |

后端不暴露具体不匹配原因（"用户名或密码错误"），防止用户枚举攻击。
