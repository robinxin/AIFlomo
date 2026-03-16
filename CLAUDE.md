# CLAUDE.md — AIFlomo 项目指南

> **最后更新**: 2026-03-10
> **审核频率**: 每周

---

## 📋 项目概述

**项目名称**: AIFlomo
**一句话描述**: 复刻 Flomo 体验的全栈 MVP，支持 Web、Android、iOS 三端（快速记录 + 标签 + 搜索）
**核心理念**: 低摩擦记录，先打通"输入→存储→回看"闭环
**参考产品**: https://v.flomoapp.com/mine

### 技术栈

| 层级 | 技术选型 |
|------|---------|
| 前端（跨端） | Expo (React Native) + **JavaScript** — Web / Android / iOS |
| 后端 | Node.js + **Fastify** + **JavaScript** |
| 数据库 | SQLite（MVP 阶段） |
| ORM | Drizzle ORM |
| 认证 | Session + Cookie（Session 存储于 SQLite 同库） |
| 状态管理 | React Context + useReducer |
| 测试 | @playwright/test ^1.51+（跨浏览器 E2E 测试） |
| 包管理 | pnpm workspaces（Monorepo） |
| 进程守护 | pm2（VPS 部署） |

---

## 🔧 常用命令

> **每个子包的 `package.json` 必须支持以下四条标准脚本：**
>
> | 脚本 | 作用 |
> |------|------|
> | `pnpm dev` | 启动开发服务器 / 运行项目 |
> | `pnpm build` | 生产构建 |
> | `pnpm lint` | 语法与代码风格检测 |
> | `pnpm prod` | 启动线上服务器（pm2 管理） |
>
> ⚠️ **`build` 脚本规范（严格遵守）**：
> - `build` 必须执行完毕后自动退出（exit code 0 或非零），**不得**启动长期运行的进程
> - ❌ 错误示例：`"build": "node src/index.js"` — 会启动服务器，永远不退出
> - ✅ 正确示例（Node.js ESM 无编译步骤）：`"build": "node --check src/index.js && echo 'Build OK'"`
> - CI 的 `build.sh` 会调用此脚本，若进程不退出将导致 CI 永久挂死

```bash
# ── 根目录（Monorepo）──
pnpm install                          # 安装所有子包依赖
pnpm dev                              # 同时启动后端和前端
pnpm dev -w apps/server               # 启动后端
pnpm dev -w apps/mobile               # 启动前端

# ── 后端（apps/server）──
cd apps/server
pnpm dev               # 启动 Fastify 开发服务器（node --watch）
pnpm build             # 打包到 dist/
pnpm lint              # ESLint 检测
pnpm prod              # pm2 start dist/index.js --name aiflomo-server
pnpm db:generate       # 生成 Drizzle client
pnpm db:migrate        # 执行数据库迁移

# ── 前端（apps/mobile，Expo）──
cd apps/mobile
pnpm dev               # pnpm dlx expo start（交互式选择平台）
pnpm build             # pnpm dlx expo export（Web 静态产物）
pnpm lint              # ESLint 检测
pnpm prod              # 构建 + 部署 Web 静态产物到服务器
                       # 其他：pnpm dlx expo start --web | --android | --ios

# ── 单测 ──
pnpm test:unit         # 运行前后端单测（Vitest + Jest）

cd apps/mobile
pnpm test:unit         # 前端 Vitest 单测
pnpm test:unit:ui      # 前端单测 UI 模式
pnpm test:unit:cov     # 前端单测 + 覆盖率报告

cd apps/server
pnpm test:unit         # 后端 Jest 单测
pnpm test:unit:cov     # 后端单测 + 覆盖率报告

# ── E2E 测试 ──
pnpm test              # Playwright E2E 测试
pnpm test:ui           # Playwright E2E 测试 UI 模式
pnpm test:report       # 查看 E2E 测试报告
```

---

## 📁 目录结构

```
AIFlomo/
├── package.json           # 根 package.json（pnpm workspaces）
├── apps/
│   ├── mobile/            # Expo 跨端应用（Web + Android + iOS）
│   │   ├── app/           # Expo Router 页面（文件路由）
│   │   ├── components/    # 通用 UI 组件
│   │   ├── context/       # React Context 状态管理
│   │   ├── hooks/         # 自定义 Hooks
│   │   ├── lib/           # API client、工具函数
│   │   ├── assets/        # 图片、字体等静态资源
│   │   └── tests/         # Vitest 前端单测（*.test.js）
│   ├── server/            # Node.js + Fastify 后端服务
│   │   ├── src/
│   │   │   ├── routes/    # API 路由（Fastify plugins）
│   │   │   ├── db/        # Drizzle schema + 迁移文件
│   │   │   ├── plugins/   # Fastify 插件（session、cors 等）
│   │   │   └── lib/       # 服务层、工具函数
│   │   ├── tests/         # Jest 后端单测（*.test.js）
│   │   └── drizzle.config.js
│   └── tests/             # Playwright E2E 测试（*.spec.js）
├── testcases/             # 测试用例描述文件
├── specs/                 # 功能规格文档
│   ├── templates/         # Spec 模板
│   ├── active/            # 当前进行中 Spec
│   └── completed/         # 已完成 Spec
├── scripts/
│   └── ci/                # CI 接口脚本（技术栈无关，换栈只改这里）
│       ├── install.sh         # 安装依赖
│       ├── lint.sh            # 代码风格检测
│       ├── build.sh           # 生产构建
│       ├── test.sh            # 运行测试用例
│       ├── db-reset.sh        # 清空数据库（幂等）
│       ├── db-setup.sh        # 生成 schema 产物（非破坏性）
│       ├── db-migrate.sh      # 执行迁移、创建/更新表结构
│       ├── server-start.sh    # 启动后端服务器
│       ├── server-url.sh      # 输出后端健康检查 URL
│       ├── fullstack-start.sh # 同时启动前后端
│       └── frontend-url.sh    # 输出前端健康检查 URL
├── .env                   # 环境配置（模型 + 业务，需提交 Git）
├── test.env               # 测试用例执行变量（WEB_URL、账号密码等，需提交 Git）
├── .github/               # Actions + Issue 模板
└── CLAUDE.md              # 本文件
```

---

## 💻 编码规范

### 核心命名规则（速查）

| 类型 | 规范 | 示例 |
|------|------|------|
| 路由文件 | kebab-case + `.jsx` | `memo-detail.jsx` |
| 组件文件 | PascalCase + `.jsx` | `MemoCard.jsx` |
| Hook 文件 | `use-` + camelCase + `.js` | `use-memos.js` |
| DB 表名 | snake_case | `memo_tags` |
| 函数/变量 | camelCase | `fetchMemos` |
| 常量 | UPPER_SNAKE_CASE | `MAX_CONTENT_LENGTH` |

### 统一 API 响应格式

```js
// 成功
{ data: value, message: string }
// 失败
{ data: null, error: string, message: string }
```

---

## 🔒 安全红线

1. **严禁硬编码密钥** — 必须使用环境变量，统一写入根目录 `.env`（需提交 Git）
2. **必须校验用户输入** — 前后端都要校验
3. **必须使用 Drizzle 参数化查询** — 不写原生 SQL 字符串拼接
4. **内容展示必须防 XSS** — 纯文本渲染
5. **输入长度限制** — Memo ≤ 10,000 字符
6. **Session 安全** — Cookie 必须设置 `httpOnly: true`、`sameSite: 'strict'`、生产环境 `secure: true`
7. **CORS** — 仅允许白名单域名

---

## 🧪 测试要求

### 测试框架

| 类型 | 框架 | 文件位置 | 配置文件 |
|------|------|---------|---------|
| 前端单测 | **Vitest** | `apps/mobile/tests/*.test.js` | `vitest.config.js` |
| 后端单测 | **Jest** | `apps/server/tests/*.test.js` | `jest.config.js` |
| E2E 测试 | **@playwright/test** | `apps/tests/*.spec.js` | `playwright.config.js` |

### 前端单测（Vitest）

#### 依赖配置

```json
{
  "devDependencies": {
    "vitest": "^2.1.0",
    "@vitest/ui": "^2.1.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.6.0",
    "jsdom": "^25.0.0"
  },
  "scripts": {
    "test:unit": "vitest",
    "test:unit:ui": "vitest --ui",
    "test:unit:cov": "vitest --coverage",
    "test:unit:watch": "vitest --watch"
  }
}
```

#### vitest.config.js

```javascript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
      exclude: [
        'node_modules/',
        'dist/',
      ],
    },
  },
});
```

### 后端单测（Jest）

#### 依赖配置

```json
{
  "devDependencies": {
    "jest": "^30.0.0-alpha.0",
    "@babel/preset-env": "^7.25.0"
  },
  "scripts": {
    "test:unit": "jest",
    "test:unit:watch": "jest --watch",
    "test:unit:cov": "jest --coverage"
  }
}
```

#### jest.config.js

```javascript
export default {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.d.js',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

### E2E 测试（Playwright）

#### playwright.config.js

```javascript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './apps/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 测试规范

- **单测覆盖率** — 新代码必须达到 **80%** 覆盖率（行、分支、函数、语句）
- **单测文件** — 放在模块同级 `tests/` 目录，命名为 `*.test.js`
- **E2E 测试文件** — 放在 `apps/tests/`，命名为 `*.spec.js`
- **命令分离** — `pnpm test` 执行 Playwright E2E 测试，`pnpm test:unit` 执行前后端单测
- **CI 质量门禁顺序** — `lint` → `build` → `test:unit` → `test`（E2E）
- **参考文档**
  - [Vitest 官方文档](https://vitest.dev/)
  - [Jest 官方文档](https://jestjs.io/)
  - [Playwright 官方文档](https://playwright.dev/docs/intro)

---

## ⚙️ CI 脚本接口规范（AI 必读）

CI workflow 通过 `scripts/ci/` 下的 shell 脚本与项目交互，**不直接调用技术栈命令**。
换栈（npm → pip、SQLite → PostgreSQL 等）时只改对应脚本，workflow 文件不动。

| 脚本 | 职责 | 当前实现 |
|------|------|---------|
| `install.sh` | 安装依赖 | `pnpm install` |
| `lint.sh` | 代码风格检测 | `pnpm lint` |
| `build.sh` | 生产构建 | `pnpm build` |
| `test.sh` | 运行测试用例 | `pnpm test` |
| `db-reset.sh` | 清空数据库（幂等） | `pnpm db:reset -w apps/server` |
| `db-setup.sh` | 生成 schema 产物（非破坏性） | `pnpm db:generate -w apps/server` |
| `db-migrate.sh` | 执行迁移、创建/更新表结构 | `pnpm db:migrate -w apps/server` |
| `server-start.sh` | 启动后端（前台，调用方后台化） | `pnpm dev -w apps/server` |
| `server-url.sh` | 输出后端健康检查 URL | `http://localhost:${PORT:-3000}` |
| `fullstack-start.sh` | 同时启动前后端 | `pnpm dev` |
| `frontend-url.sh` | 输出前端健康检查 URL | `http://localhost:8082` |

### 禁止行为
- ❌ 不要在 workflow `.yml` 文件中直接写 `pnpm install`、`rm -f *.db`、`pnpm dev` 等技术细节
- ❌ 不要在 workflow 中硬编码端口号（`3000`、`8082` 等）
- ✅ 统一通过 `bash scripts/ci/<script>.sh` 调用

### 换栈示例
切换到 Python + PostgreSQL 时，只需修改对应脚本：
```bash
# db-reset.sh
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# server-start.sh
exec uvicorn apps.server.main:app --reload --port 3000

# server-url.sh
echo "http://localhost:3000"
```

---

## 🚀 部署规范

- **目标环境**: 自有 VPS（阿里云 / 腾讯云）
- **进程守护**: pm2（`pnpm prod` 内部调用 `pm2 start`）
- **静态文件**: Expo Web 产物由 Nginx 托管
- **环境变量**: 通过 `.env.production` 注入，不得提交到 Git

```bash
# 典型上线流程
pnpm build -w apps/server         # 编译后端
pnpm prod  -w apps/server         # pm2 启动 / 重载
pnpm build -w apps/mobile         # 编译前端 Web 产物
# 将 apps/mobile/dist/ 同步到 Nginx 静态目录
```

---


## ⚙️ Workspace 配置注意事项

### pnpm workspace 最佳实践

1. **仅在 `pnpm-workspace.yaml` 中声明实际存在的子包** — 避免引用不存在的目录导致命令失败
2. **根 `package.json` 脚本使用 `--filter` 参数** — 不使用 `-w` 参数，避免递归循环
3. **子包命名规范** — 使用 scoped name（如 `@aiflomo/server`），便于 filter 引用

示例配置：

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/server'
  # 当 apps/mobile 创建后再添加: - 'apps/mobile'
```

```json
// package.json
{
  "scripts": {
    "dev": "pnpm --filter @aiflomo/server dev",
    "build": "pnpm --filter @aiflomo/server build",
    "lint": "pnpm --filter @aiflomo/server lint"
  }
}
```

---

## ⚡ 故障排查指南

### 模块找不到错误（Cannot find module）

**问题症状**：运行代码或构建时出现 `Cannot find module 'xxx'` 错误

**排查步骤**：

1. **确认依赖是否在 `package.json` 中声明**
   ```bash
   # 在相关子包目录检查
   cd apps/server  # 或 apps/mobile
   grep -r "模块名" package.json
   ```
   - 如果**不存在**，先添加依赖

2. **添加缺失的依赖**
   ```bash
   # 方式一：在子包目录安装
   cd apps/server
   pnpm add 模块名

   # 方式二：在根目录为指定子包安装
   pnpm --filter @aiflomo/server add 模块名
   ```

3. **刷新依赖树**
   ```bash
   # 重新安装所有依赖
   pnpm install

   # 或清除 node_modules 后重装
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```

4. **验证安装成功**
   ```bash
   # 确认模块存在
   ls node_modules/模块名

   # 重新运行构建/dev 命令
   pnpm dev
   ```

**常见原因**：
- ❌ 直接修改 `package.json`，未执行 `pnpm install`
- ❌ 在 monorepo 中安装到错误的子包
- ❌ `pnpm-lock.yaml` 与 `package.json` 不同步
- ❌ Node.js 版本过旧导致某些包不兼容

---

## 🔄 Git 规范

### 分支命名
- `feature/<name>` — 新功能
- `bugfix/<name>` — 修复

### Commit Message
```
feat: 新增 Memo 快速输入功能
fix: 修复标签解析中的特殊字符问题
```

---

## 🤖 AI Agent 专用指令

1. **先读 Spec** — 实现功能前先读 `specs/active/`
2. **先制定计划** — 明确文件与实现顺序
3. **增量实现** — 先后端（Drizzle schema → Fastify 路由）再前端（Expo 组件 → Context）
4. **能跑就跑** — 尽量运行构建/检查命令

### 禁止行为
- ❌ 不要引入 TypeScript（非必要场景）— 默认用 JavaScript
- ❌ 不要删除已有测试
- ❌ 不要直接操作生产数据库
- ❌ 不要使用 Next.js / Express — 后端统一用 **Fastify**
- ❌ 新增/修改子包时不得缺少 `dev` / `build` / `lint` / `prod` 四条标准脚本
- ❌ 不要使用 Redux / Zustand — 状态管理统一用 **React Context + useReducer**
