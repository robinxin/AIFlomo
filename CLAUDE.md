# CLAUDE.md — AIFlomo 项目指南

> **最后更新**: 2026-03-04
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
| 测试 | midscene-pc ^1.0.4（AI 驱动 E2E，内置 Playwright） |
| 包管理 | npm workspaces（Monorepo） |
| 进程守护 | pm2（VPS 部署） |

---

## 🔧 常用命令

> **每个子包的 `package.json` 必须支持以下四条标准脚本：**
>
> | 脚本 | 作用 |
> |------|------|
> | `npm run dev` | 启动开发服务器 / 运行项目 |
> | `npm run build` | 生产构建 |
> | `npm run lint` | 语法与代码风格检测 |
> | `npm run prod` | 启动线上服务器（pm2 管理） |

```bash
# ── 根目录（Monorepo）──
npm install                          # 安装所有子包依赖
npm run dev                          # 同时启动后端和前端
npm run dev -w apps/server           # 仅启动后端
npm run dev -w apps/mobile           # 仅启动前端

# ── 后端（apps/server）──
cd apps/server
npm run dev               # 启动 Fastify 开发服务器（node --watch）
npm run build             # 打包到 dist/
npm run lint              # ESLint 检测
npm run prod              # pm2 start dist/index.js --name aiflomo-server
npm run db:generate       # 生成 Drizzle client
npm run db:migrate        # 执行数据库迁移

# ── 前端（apps/mobile，Expo）──
cd apps/mobile
npm run dev               # npx expo start（交互式选择平台）
npm run build             # npx expo export（Web 静态产物）
npm run lint              # ESLint 检测
npm run prod              # 构建 + 部署 Web 静态产物到服务器
                          # 其他：npx expo start --web | --android | --ios

# ── 测试 ──
npm run test              # playwright test
npm run test:ui           # playwright test --ui
npm run test:report       # playwright show-report
```

---

## 📁 目录结构

```
AIFlomo/
├── package.json           # 根 package.json（npm workspaces）
├── apps/
│   ├── mobile/            # Expo 跨端应用（Web + Android + iOS）
│   │   ├── app/           # Expo Router 页面（文件路由）
│   │   ├── components/    # 通用 UI 组件
│   │   ├── context/       # React Context 状态管理
│   │   ├── hooks/         # 自定义 Hooks
│   │   ├── lib/           # API client、工具函数
│   │   └── assets/        # 图片、字体等静态资源
│   ├── server/            # Node.js + Fastify 后端服务
│   │   ├── src/
│   │   │   ├── routes/    # API 路由（Fastify plugins）
│   │   │   ├── db/        # Drizzle schema + 迁移文件
│   │   │   ├── plugins/   # Fastify 插件（session、cors 等）
│   │   │   └── lib/       # 服务层、工具函数
│   │   └── drizzle.config.js
│   └── tests/             # Midscene E2E 测试
│       └── *.yaml
├── testcases/             # 测试用例描述文件
├── docs/                  # 详细技术文档
│   ├── code-standards-frontend.md   # 前端代码规范
│   └── code-standards-backend.md    # 后端代码规范
├── specs/                 # 功能规格文档
│   ├── templates/         # Spec 模板
│   ├── active/            # 当前进行中 Spec
│   └── completed/         # 已完成 Spec
├── .env                   # 环境配置（模型 + 业务，需提交 Git）
├── test.env               # 测试用例执行变量（WEB_URL、账号密码等，需提交 Git）
├── .github/               # Actions + Issue 模板
└── CLAUDE.md              # 本文件
```

---

## 💻 编码规范

详细规范见独立文档（AI Agent 实现前必须阅读）：

- **前端**：[`docs/code-standards-frontend.md`](./docs/code-standards-frontend.md) — Expo Router、组件结构、Context、API Client
- **后端**：[`docs/code-standards-backend.md`](./docs/code-standards-backend.md) — Fastify Plugin、路由、Drizzle Schema、错误处理、响应格式

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
- **@midscene/cli v1.5.2** — AI 驱动的 Web E2E 自动化，YAML 脚本格式，全局安装后通过 `npx midscene` 调用
- 无需额外 Playwright 配置，midscene 内部管理浏览器

### 环境变量加载
- **模型配置**（`MIDSCENE_MODEL_*`）写入根目录 `.env`，midscene CLI 自动加载
- **测试变量**（`WEB_URL`、账号密码等）写入根目录 `test.env`，通过 `--env-file` 显式传入
- 根 `package.json` 的测试脚本示例：

```json
{
  "scripts": {
    "test": "node --env-file=.env --env-file=test.env node_modules/.bin/midscene 'apps/tests/*.yaml'",
    "test:headed": "node --env-file=.env --env-file=test.env node_modules/.bin/midscene 'apps/tests/*.yaml' --headed",
    "test:report": "npx playwright show-report"
  }
}
```

### YAML 脚本格式（`apps/tests/*.yaml`）

```yaml
# 用环境变量引用 URL 和账号
web:
  url: ${WEB_URL}            # 从 test.env 注入
  viewportWidth: 1280
  viewportHeight: 960

agent:
  groupName: "功能名称"

tasks:
  - name: 用例名称
    flow:
      - aiInput: 用户名输入框
        value: ${WEB_USERNAME}
      - aiInput: 密码输入框
        value: ${WEB_PASSWORD}
      - aiTap: 登录按钮
      - sleep: 1000
      - aiAssert: 页面已跳转到主应用，显示欢迎信息
```

### 可用 flow 操作

| 操作 | 说明 |
|------|------|
| `ai: <prompt>` | 自然语言交互（通用） |
| `aiTap: <prompt>` | 点击元素 |
| `aiInput: <prompt>` + `value: <text>` | 向输入框填写内容 |
| `aiAssert: <prompt>` | 断言（失败时测试不通过） |
| `aiWaitFor: <prompt>` | 等待条件成立 |
| `aiQuery: <prompt>` + `name: <key>` | 提取数据到 JSON |
| `sleep: <ms>` | 等待毫秒数 |
| `javascript: <code>` | 执行页面内 JS |

### 测试规范
- 测试文件放在 `apps/tests/`，命名为 `*.yaml`
- 环境变量通过 `${VAR_NAME}` 在 YAML 中引用，值来源于 `test.env`
- MVP 阶段允许测试为空，但新增重要功能必须补 E2E 测试
- CI 质量门禁顺序：`lint` → `build` → `test`
- 运行前须确保 `WEB_URL` 指向的服务已启动

---

## 🚀 部署规范

- **目标环境**: 自有 VPS（阿里云 / 腾讯云）
- **进程守护**: pm2（`npm run prod` 内部调用 `pm2 start`）
- **静态文件**: Expo Web 产物由 Nginx 托管
- **环境变量**: 通过 `.env.production` 注入，不得提交到 Git

```bash
# 典型上线流程
npm run build -w apps/server         # 编译后端
npm run prod  -w apps/server         # pm2 启动 / 重载
npm run build -w apps/mobile         # 编译前端 Web 产物
# 将 apps/mobile/dist/ 同步到 Nginx 静态目录
```

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

## Active Technologies
- JavaScript (Node.js ESM, `"type": "module"`) + React Native (Expo SDK) (001-login-page)
- SQLite（`better-sqlite3`）via Drizzle ORM；Session 使用内存 store（MVP） (001-login-page)

## Recent Changes
- 001-login-page: Added JavaScript (Node.js ESM, `"type": "module"`) + React Native (Expo SDK)
