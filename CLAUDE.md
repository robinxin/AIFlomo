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
| 前端（跨端） | Expo (React Native) + TypeScript — Web / Android / iOS |
| 后端 | Node.js + **Fastify** + TypeScript |
| 数据库 | SQLite（MVP 阶段） |
| ORM | Drizzle ORM |
| 认证 | Session + Cookie（Session 存储于 SQLite 同库） |
| 状态管理 | React Context + useReducer |
| 测试 | Playwright（E2E）+ Midscene（AI 驱动 UI 测试） |
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
npm run dev -w apps/server           # 启动后端
npm run dev -w apps/mobile           # 启动前端

# ── 后端（apps/server）──
cd apps/server
npm run dev               # 启动 Fastify 开发服务器（tsx watch）
npm run build             # 编译 TypeScript 到 dist/
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
│   └── server/            # Node.js + Fastify 后端服务
│       ├── src/
│       │   ├── routes/    # API 路由（Fastify plugins）
│       │   ├── db/        # Drizzle schema + 迁移文件
│       │   ├── plugins/   # Fastify 插件（session、cors 等）
│       │   └── lib/       # 服务层、工具函数
│       └── drizzle.config.ts
├── tests/                 # Playwright + Midscene E2E 测试
│   └── *.spec.ts
├── specs/                 # 功能规格文档
│   ├── templates/         # Spec 模板
│   ├── active/            # 当前进行中 Spec
│   └── completed/         # 已完成 Spec
├── .github/               # Actions + Issue 模板
└── CLAUDE.md              # 本文件
```

---

## 💻 编码规范

### 命名规则
- **文件名**: kebab-case
- **组件名**: PascalCase
- **函数/变量**: camelCase
- **常量**: UPPER_SNAKE_CASE
- **Drizzle schema 表名**: snake_case（与数据库一致）

### API 规范
- RESTful 风格，Fastify route plugin 组织
- 统一 JSON 结构：`{ data, error, message }`
- 使用 HTTP 状态码表达结果
- Session 通过 `@fastify/session` + `@fastify/cookie` 管理

### 状态管理规范（Expo）
- 全局状态用 React Context + useReducer，文件放在 `apps/mobile/context/`
- Context 按业务域拆分（如 `AuthContext`、`MemoContext`），避免单一巨型 Context
- 组件内局部状态用 `useState`，不要过度提升到全局

### 跨端规范（Expo）
- 优先使用 React Native 核心组件，保持三端一致
- 平台差异代码用 `Platform.select()` 或 `.web.tsx` / `.native.tsx` 后缀隔离
- 样式统一使用 `StyleSheet.create()`，避免内联样式

### 错误处理
- 统一返回结构化错误
- 生产环境不暴露堆栈

---

## 🔒 安全红线

1. **严禁硬编码密钥** — 必须使用环境变量（`.env` 文件不得提交）
2. **必须校验用户输入** — 前后端都要校验
3. **必须使用 Drizzle 参数化查询** — 不写原生 SQL 字符串拼接
4. **内容展示必须防 XSS** — 纯文本渲染
5. **输入长度限制** — Memo ≤ 10,000 字符
6. **Session 安全** — Cookie 必须设置 `httpOnly: true`、`sameSite: 'strict'`、生产环境 `secure: true`
7. **CORS** — 仅允许白名单域名

---

## 🧪 测试要求

### 测试框架
- **Playwright** — E2E 浏览器自动化测试
- **Midscene** — AI 驱动的 UI 语义测试（基于 Playwright）

### package.json 必须包含的测试依赖

```json
{
  "devDependencies": {
    "@playwright/test": "^1.x",
    "@midscene/web": "^0.x"
  },
  "scripts": {
    "test": "playwright test",
    "test:ui": "playwright test --ui",
    "test:report": "playwright show-report"
  }
}
```

### 测试规范
- 测试文件放在根目录 `tests/`，命名为 `*.spec.ts`
- MVP 阶段允许测试为空，但新增重要功能必须补 E2E 测试
- CI 质量门禁顺序：`lint` → `build` → `test`

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
- ❌ 不要使用 `any` 类型
- ❌ 不要使用 `@ts-ignore`
- ❌ 不要删除已有测试
- ❌ 不要直接操作生产数据库
- ❌ 不要使用 Next.js / Express — 后端统一用 **Fastify**
- ❌ 新增/修改子包时不得缺少 `dev` / `build` / `lint` / `prod` 四条标准脚本
- ❌ 不要使用 Redux / Zustand — 状态管理统一用 **React Context + useReducer**
