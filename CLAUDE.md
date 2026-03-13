# CLAUDE.md — 前端项目指南

> **最后更新**: 2026-03-13
> **审核频率**: 每周

---

## 📋 项目概述

**一句话描述**: 跨端前端应用，支持 Web、Android、iOS 三端（Expo + React Native）
**核心理念**: 低摩擦开发，AI 驱动的 Spec 自动化流水线
**技术定位**: 前端为主，Node.js 轻量后端支撑

### 技术栈

| 层级 | 技术选型 |
|------|---------|
| 前端（跨端） | Expo (React Native) + **JavaScript** — Web / Android / iOS |
| 后端 | Node.js + **Fastify** + **JavaScript** |
| 数据库 | SQLite（MVP 阶段） |
| ORM | Drizzle ORM |
| 认证 | Session + Cookie（Session 存储于 SQLite 同库） |
| 状态管理 | React Context + useReducer |
| 测试 | @playwright/test ^1.51+（E2E）、Vitest（前端单测）、Jest（后端单测）|
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
pnpm prod              # pm2 start dist/index.js --name server
pnpm db:generate       # 生成 Drizzle client
pnpm db:migrate        # 执行数据库迁移

# ── 前端（apps/mobile，Expo）──
cd apps/mobile
pnpm dev               # pnpm dlx expo start（交互式选择平台）
pnpm build             # pnpm dlx expo export（Web 静态产物）
pnpm lint              # ESLint 检测
pnpm prod              # 构建 + 部署 Web 静态产物到服务器

# ── 单测 ──
pnpm test:unit         # 运行前后端单测

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
/
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
│   └── ci/                # CI 接口脚本（技术栈无关）
├── .env                   # 环境配置（需提交 Git，不含密钥）
├── test.env               # 测试执行变量（WEB_URL 等，需提交 Git）
├── .github/               # Actions + Issue 模板
└── CLAUDE.md              # 本文件
```

---

## 💻 编码规范

### 核心命名规则

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

1. **严禁硬编码密钥** — 必须使用环境变量，统一写入根目录 `.env`
2. **必须校验用户输入** — 前后端都要校验
3. **必须使用 Drizzle 参数化查询** — 不写原生 SQL 字符串拼接
4. **内容展示必须防 XSS** — 纯文本渲染
5. **Session 安全** — Cookie 必须设置 `httpOnly: true`、`sameSite: 'strict'`、生产环境 `secure: true`
6. **CORS** — 仅允许白名单域名

---

## 🧪 测试要求

### 测试框架

| 类型 | 框架 | 文件位置 |
|------|------|---------|
| 前端单测 | **Vitest** | `apps/mobile/tests/*.test.js` |
| 后端单测 | **Jest** | `apps/server/tests/*.test.js` |
| E2E 测试 | **@playwright/test** | `apps/tests/*.spec.js` |

### 测试规范

- **单测覆盖率** — 新代码必须达到 **80%** 覆盖率（行、分支、函数、语句）
- **单测文件** — 放在模块同级 `tests/` 目录，命名为 `*.test.js`
- **E2E 测试文件** — 放在 `apps/tests/`，命名为 `*.spec.js`
- **命令分离** — `pnpm test` 执行 Playwright E2E，`pnpm test:unit` 执行前后端单测
- **CI 质量门禁顺序** — `lint` → `build` → `test:unit` → `test`（E2E）

---

## ⚙️ CI 脚本接口规范（AI 必读）

CI workflow 通过 `scripts/ci/` 下的 shell 脚本与项目交互，**不直接调用技术栈命令**。
换栈时只改对应脚本，workflow 文件不动。

| 脚本 | 职责 | 当前实现 |
|------|------|---------|
| `install.sh` | 安装依赖 | `pnpm install` |
| `lint.sh` | 代码风格检测 | `pnpm lint` |
| `build.sh` | 生产构建 | `pnpm build` |
| `test.sh` | 运行测试用例 | `pnpm test` |
| `db-reset.sh` | 清空数据库（幂等） | `pnpm db:reset -w apps/server` |
| `db-setup.sh` | 生成 schema 产物（非破坏性） | `pnpm db:generate -w apps/server` |
| `db-migrate.sh` | 执行迁移、创建/更新表结构 | `pnpm db:migrate -w apps/server` |
| `server-start.sh` | 启动后端（前台） | `pnpm dev -w apps/server` |
| `server-url.sh` | 输出后端健康检查 URL | `http://localhost:${PORT:-3000}` |
| `fullstack-start.sh` | 同时启动前后端 | `pnpm dev` |
| `frontend-url.sh` | 输出前端健康检查 URL | `http://localhost:8082` |

### 禁止行为
- ❌ 不要在 workflow `.yml` 中直接写技术栈命令（`pnpm install`、`pnpm dev` 等）
- ❌ 不要在 workflow 中硬编码端口号
- ✅ 统一通过 `bash scripts/ci/<script>.sh` 调用

---

## 🚀 部署规范

- **目标环境**: 自有 VPS
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

## 🔄 Git 规范

### 分支命名
- `feat/<name>` — 新功能
- `bugfix/<name>` — 修复

### Commit Message
```
feat: 新增快速输入功能
fix: 修复标签解析中的特殊字符问题
chore: 更新依赖版本
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
