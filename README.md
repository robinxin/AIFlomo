# AIFlomo

仿 Flomo 的全栈笔记应用，支持 Web 和 Mac 桌面端，集成 GitHub Actions 自动化 CI/CD 流水线。

## 项目简介

AIFlomo 包含三部分：
1. **Flomo Web 应用** — 基于 Next.js + TypeScript 的全栈笔记应用
2. **Flomo Mac 桌面应用** — 基于 Electron，内嵌 Next.js 服务器，离线可用
3. **CI/CD 流水线** — 基于 GitHub Actions 的自动化代码审查、测试、构建和部署

## 应用功能

| 模块 | 功能 |
|------|------|
| 用户 | 注册、登录、登出、昵称设置 |
| 笔记 | 创建、编辑、删除（软删除 + 回收站恢复）、全文搜索 |
| 标签 | 创建标签、按标签筛选、标签计数、无标签筛选 |
| 图片 | 上传图片（JPG/PNG/GIF/WebP，≤5MB）、插入笔记、有图片筛选 |
| 链接 | 插入链接、自动渲染为可点击链接、有链接筛选 |
| 统计 | 笔记数、标签数、天数统计、64 天活动热力图 |
| 会员 | PRO 功能入口（微信输入、每日回顾、AI 洞察、随机漫步） |
| 桌面端 | Mac 桌面应用，内嵌 Next.js 服务器，完全离线可用 |

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 14 (App Router) + React 18 |
| 语言 | TypeScript (Strict) |
| 数据库 | SQLite + Prisma ORM |
| 认证 | bcryptjs + HttpOnly Cookie Session（14 天有效期） |
| 桌面端 | Electron 33（内嵌 Next.js 生产服务器） |
| 样式 | 原生 CSS + CSS 变量（暗色主题） |
| CI/CD | GitHub Actions（6 个工作流） |
| AI 审查 | Claude Code Action（Claude Sonnet 4.5） |

## 快速开始

### Web 应用

```bash
cd apps/flomo
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

浏览器打开 http://localhost:3000

### Mac 桌面应用（开发模式）

```bash
# 1. 先启动 Web 应用
cd apps/flomo
npm run dev

# 2. 新开终端，启动桌面应用
cd apps/flomo-desktop
npm install
npm run dev
```

### Mac 桌面应用（打包 .dmg）

```bash
# 一键打包（自动构建 Next.js + 打包 Electron）
cd apps/flomo-desktop
npm run build
```

打包完成后，`.dmg` 安装包在 `apps/flomo-desktop/release/` 目录下。安装后完全离线可用，数据存储在 `~/Library/Application Support/Flomo-印象笔记/`。

## 项目结构

```
AIFlomo/
├── .github/workflows/
│   ├── claude-codereview.yml     # Claude AI 代码审查
│   ├── test.yml                  # 测试 + 类型检查
│   ├── build.yml                 # 构建验证
│   ├── lint.yml                  # 代码规范 + 安全检查
│   ├── prisma-check.yml          # 数据库 Schema 检查
│   └── deploy-preview.yml        # PR 预览构建报告
├── apps/
│   ├── flomo/                    # Next.js Web 应用
│   │   ├── app/                  # 页面和 API 路由
│   │   │   ├── api/
│   │   │   │   ├── auth/         # 登录、注册、登出
│   │   │   │   ├── notes/        # 笔记 CRUD、回收站、恢复
│   │   │   │   ├── tags/         # 标签管理
│   │   │   │   ├── search/       # 全文搜索
│   │   │   │   └── upload/       # 图片上传
│   │   │   ├── login/            # 登录页
│   │   │   ├── register/         # 注册页
│   │   │   └── notes/            # 笔记主页面
│   │   ├── lib/                  # 工具函数
│   │   │   ├── auth.ts           # 认证（Session、密码哈希、Cookie）
│   │   │   ├── prisma.ts         # 数据库客户端（单例模式）
│   │   │   └── validators.ts     # 输入验证（邮箱、密码、标签）
│   │   ├── prisma/               # 数据库 Schema 和迁移
│   │   └── public/uploads/       # 用户上传的图片
│   └── flomo-desktop/            # Electron 桌面应用
│       ├── main.ts               # 主进程（窗口管理、服务器启动）
│       ├── preload.ts            # 预加载脚本（平台检测）
│       └── next-server.js        # 内嵌 Next.js 生产服务器
├── CONTRIBUTING.md               # 工程规范
└── README.md                     # 本文件
```

## API 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册（邮箱、密码、昵称） |
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/logout` | 用户登出 |
| GET | `/api/notes` | 获取笔记列表（支持 `?type=notag` 筛选无标签笔记） |
| POST | `/api/notes` | 创建笔记（标题、内容、标签） |
| PATCH | `/api/notes/[id]` | 编辑笔记 |
| DELETE | `/api/notes/[id]` | 删除笔记（`?permanent=true` 永久删除） |
| GET | `/api/notes/trash` | 获取回收站笔记 |
| POST | `/api/notes/[id]/restore` | 恢复已删除笔记 |
| GET | `/api/tags` | 获取标签列表（含笔记计数） |
| GET | `/api/search` | 全文搜索（`?q=关键词`，搜索标题和内容） |
| POST | `/api/upload` | 上传图片（FormData，≤5MB） |

## 数据模型

```
User ──┬── Session（token 认证，14 天有效期）
       ├── Note ──── NoteTag ──── Tag
       └── Tag（用户级别唯一）

Note 支持软删除（deletedAt 字段）
```

| 模型 | 主要字段 |
|------|----------|
| User | email, passwordHash, nickname, createdAt |
| Session | token (unique), expiresAt |
| Note | title?, content, createdAt, updatedAt, deletedAt? |
| Tag | name (用户级别唯一) |
| NoteTag | noteId + tagId（多对多关联） |

## Mac 桌面应用架构

```
Electron 主进程
  ├── 自动分配空闲端口
  ├── 初始化 SQLite 数据库（~/Library/Application Support/）
  ├── fork 子进程运行 Next.js 生产服务器
  ├── 等待服务器就绪后加载页面
  └── 退出时清理子进程

开发模式：直接连接 localhost:3000
生产模式：内嵌 Next.js 服务器 + 本地 SQLite
```

## CI/CD 工作流

### 工作流总览

| 工作流 | 触发条件 | 功能 |
|--------|----------|------|
| `claude-codereview.yml` | PR / Push → main | Claude AI 自动代码审查 |
| `test.yml` | PR → main / Push → main, workflow-jl | TypeScript 类型检查 + Jest 测试 |
| `build.yml` | PR / Push → main | Next.js 构建验证 + 产物大小统计 |
| `lint.yml` | PR → main | 提交规范、分支命名、代码标准、安全检查 |
| `prisma-check.yml` | PR → main (prisma/ 变更时) | Schema 校验、格式检查、迁移完整性 |
| `deploy-preview.yml` | PR → main | 构建并在 PR 中评论构建报告 |

### Claude AI 代码审查

- **PR 审查**：代码质量、bug、安全、性能、可读性
- **Push 审查**：完整性、语法错误、调试代码、敏感信息
- 运行于 Self-hosted Runner (`ai-runner`)
- 审查结果以 PR 评论和行内批注形式反馈

### 代码规范检查

| 检查项 | 说明 |
|--------|------|
| Commit Message | 必须符合 `<type>(<scope>): <subject>` 格式 |
| 分支命名 | 必须符合 `feat/`, `fix/`, `workflow-` 等约定 |
| TypeScript | `tsc --noEmit` 严格类型检查 |
| 代码质量 | 禁止 `var`、`console.log`、`any`、注释代码 |
| 安全 | 禁止提交 `.env`、`.pem`、`.key`、硬编码密钥 |
| PR 描述 | 必须包含有意义的描述（≥20 字符） |

### Prisma Schema 检查

- `prisma validate` 语法校验
- `prisma format` 格式检查
- 迁移文件完整性验证（Schema 变更必须附带迁移）

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | SQLite 数据库路径 | `file:./dev.db` |
| `SESSION_DAYS` | Session 有效天数 | `14` |

## 前置条件

### GitHub Secrets

| Secret | 说明 |
|--------|------|
| `ANTHROPIC_API_KEY` | Anthropic API 密钥（用于 Claude 审查） |

### Self-hosted Runner

Claude 代码审查需要 self-hosted runner：
- 标签：`ai-runner`
- 已安装 `gh` CLI
- 可访问 `https://claude.hatch.yinxiang.com/api`

## 工程规范

详见 [CONTRIBUTING.md](CONTRIBUTING.md)，涵盖分支管理、提交规范、PR 流程、代码风格、安全规范等。

## 许可证

MIT
