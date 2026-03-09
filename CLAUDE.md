# CLAUDE.md — AIFlomo 项目指南

> **最后更新**: 2026-03-06
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
npm run dev -w apps/server           # 启动后端
npm run dev -w apps/mobile           # 启动前端

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

### 表单验证规范

**实时验证要求**：
- 所有表单输入必须同时支持 `onChange` 和 `onBlur` 事件
- `onChange` 时清除错误提示（用户正在输入，不打断）
- `onBlur` 时触发字段验证并显示错误（用户离开字段时立即反馈）
- 提交时进行完整校验

**TextInput 组件规范**：
```jsx
<TextInput
  value={value}
  onChangeText={handleChange}  // 清除错误
  onBlur={handleBlur}           // 触发验证
  error={errorMessage}
/>
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
- **midscene-pc** — AI 驱动的 PC 端 E2E 测试，内置 Playwright，无需单独安装

### package.json 必须包含的测试依赖

```json
{
  "devDependencies": {
    "midscene-pc": "^1.0.4",
    "@midscene/cli": "^1.5.2",
    "dotenv": "^16.6.1"
  },
  "scripts": {
    "test": "npx midscene apps/tests/*.yaml",
    "test:ui": "npx midscene apps/tests/*.yaml",
    "test:report": "playwright show-report"
  }
}
```

### 测试规范
- 测试文件放在 `apps/tests/`，命名为 `*.yaml`
- MVP 阶段允许测试为空，但新增重要功能必须补 E2E 测试
- CI 质量门禁顺序：`lint` → `build` → `test`

---

## ⚙️ CI 脚本接口规范（AI 必读）

CI workflow 通过 `scripts/ci/` 下的 shell 脚本与项目交互，**不直接调用技术栈命令**。
换栈（npm → pip、SQLite → PostgreSQL 等）时只改对应脚本，workflow 文件不动。

| 脚本 | 职责 | 当前实现 |
|------|------|---------|
| `install.sh` | 安装依赖 | `npm install` |
| `lint.sh` | 代码风格检测 | `npm run lint` |
| `build.sh` | 生产构建 | `npm run build` |
| `test.sh` | 运行测试用例 | `npm run test` |
| `db-reset.sh` | 清空数据库（幂等） | `npm run db:reset -w apps/server` |
| `db-setup.sh` | 生成 schema 产物（非破坏性） | `npm run db:generate -w apps/server` |
| `db-migrate.sh` | 执行迁移、创建/更新表结构 | `npm run db:migrate -w apps/server` |
| `server-start.sh` | 启动后端（前台，调用方后台化） | `npm run dev -w apps/server` |
| `server-url.sh` | 输出后端健康检查 URL | `http://localhost:${PORT:-3000}` |
| `fullstack-start.sh` | 同时启动前后端 | `npm run dev` |
| `frontend-url.sh` | 输出前端健康检查 URL | `http://localhost:8082` |

### 禁止行为
- ❌ 不要在 workflow `.yml` 文件中直接写 `npm install`、`rm -f *.db`、`npm run dev` 等技术细节
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
5. **实现后必须自验证** — 见下方「实现后自验证步骤」

### 禁止行为
- ❌ 不要引入 TypeScript（非必要场景）— 默认用 JavaScript
- ❌ 不要删除已有测试
- ❌ 不要直接操作生产数据库
- ❌ 不要使用 Next.js / Express — 后端统一用 **Fastify**
- ❌ 新增/修改子包时不得缺少 `dev` / `build` / `lint` / `prod` 四条标准脚本
- ❌ 不要使用 Redux / Zustand — 状态管理统一用 **React Context + useReducer**
- ❌ `apps/mobile/package.json` 的 `main` 字段不能是 `"expo-router"`（会解析到库文件，页面空白）— 必须是 `"expo-router/entry"`
- ❌ 不要在 React Native `<View>` 的直接子节点写字符串条件渲染 — `{str && <Text>}` 在 `str=''` 时渲染空字符串导致报错，必须用 `{!!str && <Text>}`

---

## 📱 Expo Monorepo 配置规范（AI 必读）

> 违反以下任一条均会导致页面空白或新机器无法启动，**生成代码后必须逐条核对**。

### 1. package.json 入口

`apps/mobile/package.json` 必须使用：
```json
"main": "expo-router/entry"
```
`"expo-router"` 会经 Node 模块解析走到 `expo-router/build/index.js`（仅库导出，不含 `renderRootComponent`），导致页面永久空白。

### 2. metro.config.js

`apps/mobile/metro.config.js` 必须存在，且必须调用 `getDefaultConfig`：

```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '../..')];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '../../node_modules'),
];

module.exports = config;
```

原因：`getDefaultConfig` 启用 `require.context`（expo-router 路由发现的前提），并配置 monorepo 模块解析路径。缺少此文件会导致路由全部失效。

### 3. babel-preset-expo 版本管理

- `babel-preset-expo` 必须安装在**根 `package.json`** 的 `devDependencies`，版本锁定为 `~12.0.0`（Expo SDK 52 对应版本）
- 同时在根 `package.json` 加 `overrides` 防止子包传递依赖引入高版本：
  ```json
  "overrides": { "babel-preset-expo": "~12.0.0" }
  ```
- `apps/mobile/package.json` 中**不要声明** `babel-preset-expo`，由根目录统一管控
- `12.x` 将 `process.env.EXPO_PUBLIC_*` 直接内联；`55.x+` 生成 `require('expo/virtual/env')` 导致 Metro 报错

验证：`npm ls babel-preset-expo` 输出应只有一个版本且为 `12.x`

### 4. npm workspace 依赖提升

npm workspace 的 hoisting 行为不一致：某些包被提升到根 `node_modules`，其 peer dependency 却留在子包中，导致运行时找不到模块。

规则：
- `@fastify/session` 的 peer dependency `@fastify/cookie` 必须安装在**根目录**
- 凡是被提升到根 `node_modules` 的包，其 peer deps 也必须在根 `node_modules`
- 安装方式：`npm install <pkg>` 在根目录执行（不加 `-w`）

### 5. 并行启动脚本

根目录 `dev` 脚本必须使用 `concurrently` 并行启动前后端：
```json
"dev": "concurrently \"npm run dev -w apps/server -- --clear\" \"npm run dev -w apps/mobile\""
```
`npm run dev --workspaces` 是串行执行，服务端 `node --watch` 为常驻进程会阻塞前端启动。

### 6. 数据库目录自动创建

`apps/server/src/db/index.js` 必须在打开数据库前自动创建目录，防止新机器首次启动报错：
```js
import { mkdirSync } from 'fs';
import { dirname } from 'path';
const dbPath = process.env.DB_PATH ?? './data/aiflomo.db';
mkdirSync(dirname(dbPath), { recursive: true });
```

### 7. Expo Router 路由组规范（⚠️ 违反会导致全站 404）

**CRITICAL（关键）**：违反此规范会导致所有页面返回 404 错误，E2E 测试全部失败。

**路由文件放置规则**：
- **所有路由页面**（login、register、memo 等）必须直接放在 `apps/mobile/app/` 根目录下
- **禁止使用路由组**（如 `(auth)/`、`(tabs)/` 等）包裹页面文件，除非该组确实需要独立的布局或嵌套导航
- 路由组 `(groupName)` 不会出现在 URL 路径中，但如果组内有 `_layout.jsx`，Expo Router 会为该组创建独立的导航栈，导致所有路由返回 404

**错误示例**（会导致全站 404）：
```
apps/mobile/app/
  (auth)/
    _layout.jsx      ← ❌ 创建了独立导航栈，阻断了所有路由匹配
    login.jsx        ← ❌ 无法通过 /login 访问（404）
    register.jsx     ← ❌ 无法通过 /register 访问（404）
```

**正确示例**：
```
apps/mobile/app/
  _layout.jsx        ← ✅ 根布局
  index.jsx          ← ✅ 根路由（重定向逻辑）
  login.jsx          ← ✅ 可通过 /login 访问
  register.jsx       ← ✅ 可通过 /register 访问
  memo.jsx           ← ✅ 可通过 /memo 访问
```

**何时使用路由组**：
- 仅在需要为一组页面提供共享布局时使用（如 tabs 导航）
- 组内的 `_layout.jsx` 应只定义布局，不应阻断路由匹配
- 若无共享布局需求，直接将页面放在 `app/` 根目录

**验证方法**：
```bash
# 检查是否有误用的路由组
find apps/mobile/app -type d -name "(auth)" -o -name "(tabs)" | grep -v node_modules
# 输出应为空，否则需修复
```

**修复方法（如发现误用的路由组）**：
1. 将路由组内的页面文件（如 `login.jsx`, `register.jsx`）移到 `app/` 根目录
2. 在 `apps/mobile/package.json` 的 `dev` 和 `build` 脚本前添加 `rm -rf app/\\(auth\\) &&` 删除路由组目录
3. 示例：
   ```json
   "dev": "rm -rf app/\\(auth\\) && EXPO_USE_METRO_WORKSPACE_ROOT=1 expo start --web --port 8082",
   "build": "rm -rf app/\\(auth\\) && expo export -p web"
   ```

### 8. CI 环境 Expo 配置

在 CI 环境（GitHub Actions、Jenkins 等）运行时，`apps/mobile/package.json` 的 `dev` 脚本**必须**设置 `EXPO_USE_METRO_WORKSPACE_ROOT=1` 环境变量：

```json
"dev": "EXPO_USE_METRO_WORKSPACE_ROOT=1 expo start --web --port 8082"
```

原因：
- Monorepo 环境下，Metro 需要明确知道工作区根目录位置
- 不设置此变量可能导致 Metro 无法正确解析模块路径
- CI 环境下缺少交互式终端，必须明确指定平台（`--web`）和端口

### 9. 环境变量配置（Expo 前端）

Expo 应用需要在其**应用目录**下存在 `.env` 文件才能正确加载环境变量。在 Monorepo 中：

**必需文件（必须提交到 Git）**：
- **根目录** `.env` — 全局环境变量（模型配置、后端环境等）
- **apps/mobile/.env** — 前端专用环境变量（必须包含 `EXPO_PUBLIC_*` 变量）

**apps/mobile/.env 必须包含**：
```bash
EXPO_PUBLIC_API_URL=http://localhost:3000
```

**CRITICAL（关键）**：
- **`apps/mobile/.env` 文件缺失会导致页面空白**，因为 `api-client.js` 中 `process.env.EXPO_PUBLIC_API_URL` 为 undefined，API 请求失败，AuthContext 初始化超时，应用卡在加载状态（`isLoading: true`）
- 此文件**必须提交到 Git**，确保 CI 环境和新机器能正常运行

原因：
- `npm run dev -w apps/mobile` 会将工作目录切换到 `apps/mobile/`
- Expo 只会加载**当前工作目录**下的 `.env` 文件，不会自动读取根目录的 `.env`
- 以 `EXPO_PUBLIC_` 开头的变量会在构建时被内联到前端代码中

验证：构建后检查打包产物中是否包含正确的 API URL：
```bash
npm run build -w apps/mobile
grep -o "http://localhost:3000" apps/mobile/dist/_expo/static/js/web/*.js
```

---

## ✅ 实现后自验证步骤（必须执行）

AI 完成代码生成后，**按顺序执行以下检查**，全部通过才算实现完成：

```bash
# 1. 静态检查
npm run lint --workspaces --if-present

# 2. 核心配置项核对（逐条）
grep '"main"' apps/mobile/package.json          # 应输出 "expo-router/entry"
ls apps/mobile/metro.config.js                  # 文件必须存在
npm ls babel-preset-expo                        # 只有一个版本且为 12.x
ls node_modules/@fastify/cookie                 # 目录必须存在
grep '"dev"' package.json                       # 应包含 concurrently

# 3. 路由结构验证（CRITICAL - 防止全站 404）
find apps/mobile/app -type d \( -name "(auth)" -o -name "(tabs)" \) | grep -v node_modules
# 输出应为空，否则说明路由组配置错误，会导致全站 404

ls apps/mobile/app/*.jsx                        # 应包含 login.jsx、register.jsx 等页面

# 4. Bundle 内容验证（前端核心验证）
cd apps/mobile && npx expo export -p web --output-dir /tmp/expo-dist
grep -c 'renderRootComponent' /tmp/expo-dist/bundles/*.js   # 结果必须 > 0

# 5. 后端健康检查
curl http://localhost:3000/health               # 应返回 {"status":"ok"}

# 6. 前端页面验证
# 访问 http://localhost:8082/ 应重定向到 /login 并渲染登录表单（非空白页）
```
