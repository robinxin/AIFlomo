# Quickstart: 001-login-page

开发者快速启动指南。

---

## 前置条件

- Node.js >= 18
- npm >= 9

---

## 1. 初始化（首次运行）

```bash
# 安装所有子包依赖
npm install

# 生成 Drizzle 迁移文件
npm run db:generate -w apps/server

# 执行数据库迁移（创建 users 表）
npm run db:migrate -w apps/server

# 插入种子数据（yixiang/666666）
npm run db:seed -w apps/server
```

---

## 2. 启动开发服务器

```bash
# 终端 1：启动后端
npm run dev -w apps/server

# 终端 2：启动前端（Web）
npm run dev -w apps/mobile
```

前端默认运行在 `http://localhost:8081`，后端默认运行在 `http://localhost:3000`。

---

## 3. 登录测试

浏览器访问 `http://localhost:8081`，应自动跳转到登录页。

使用预置账号登录：
- **用户名**: `yixiang`
- **密码**: `666666`

---

## 4. API 快速验证

```bash
# 登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"yixiang","password":"666666"}' \
  -c cookies.txt

# 查看当前用户
curl http://localhost:3000/api/auth/me -b cookies.txt

# 退出
curl -X POST http://localhost:3000/api/auth/logout -b cookies.txt
```

---

## 5. 环境变量

根目录 `.env` 文件（已提交 Git，无敏感信息）：

```bash
NODE_ENV=development
PORT=3000
DB_PATH=./data/aiflomo.db
SESSION_SECRET=aiflomo-dev-secret-key-minimum-32-chars!!
CORS_ORIGIN=http://localhost:8081
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

---

## 6. 目录结构（实现后）

```
AIFlomo/
├── package.json                 # 根 monorepo（npm workspaces）
├── .env                         # 环境变量
├── apps/
│   ├── server/                  # Fastify 后端
│   │   ├── package.json
│   │   ├── drizzle.config.js
│   │   └── src/
│   │       ├── index.js
│   │       ├── plugins/
│   │       │   ├── cors.js
│   │       │   ├── session.js
│   │       │   └── auth.js
│   │       ├── routes/
│   │       │   └── auth.js
│   │       ├── db/
│   │       │   ├── schema.js
│   │       │   ├── index.js
│   │       │   ├── seed.js
│   │       │   └── migrations/
│   │       └── lib/
│   │           ├── errors.js
│   │           └── password.js
│   └── mobile/                  # Expo 前端
│       ├── package.json
│       ├── app.json
│       ├── babel.config.js
│       └── app/
│           ├── _layout.jsx
│           ├── (auth)/
│           │   ├── _layout.jsx
│           │   └── login.jsx
│           └── (app)/
│               ├── _layout.jsx
│               └── index.jsx
│       ├── context/
│       │   └── AuthContext.jsx
│       └── lib/
│           └── api-client.js
└── specs/
    └── 001-login-page/          # 本 Spec 目录
```
