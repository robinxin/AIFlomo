# AIFlomo

仿 Flomo 的全栈笔记应用，集成 GitHub Actions 自动化 CI/CD 流水线。

## 项目简介

AIFlomo 包含两部分：
1. **Flomo 笔记应用** — 基于 Next.js + TypeScript 的全栈笔记应用
2. **CI/CD 流水线** — 基于 GitHub Actions 的自动化代码审查、测试、构建和部署

## 应用功能

| 模块 | 功能 |
|------|------|
| 用户 | 注册、登录、登出 |
| 笔记 | 创建、编辑、删除、搜索 |
| 标签 | 创建标签、按标签筛选、标签计数 |

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 14 (App Router) + React 18 |
| 语言 | TypeScript (Strict) |
| 数据库 | SQLite + Prisma ORM |
| 认证 | bcryptjs + HttpOnly Cookie Session |
| 样式 | 原生 CSS + CSS 变量 |
| CI/CD | GitHub Actions (5 个工作流) |
| AI 审查 | Claude Code Action |

## 快速开始

```bash
cd apps/flomo
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

浏览器打开 http://localhost:3000

## 项目结构

```
AIFlomo/
├── .github/workflows/
│   ├── claude-codereview.yml  # Claude AI 代码审查
│   ├── test.yml               # 测试 + 类型检查
│   ├── build.yml              # 构建验证
│   ├── lint.yml               # 代码规范 + 安全检查
│   ├── prisma-check.yml       # 数据库 Schema 检查
│   └── deploy-preview.yml     # PR 预览构建报告
├── apps/flomo/                # Flomo 笔记应用
│   ├── app/                   # 页面和 API 路由
│   ├── lib/                   # 工具函数
│   └── prisma/                # 数据库 Schema
├── CONTRIBUTING.md            # 工程规范
└── README.md                  # 本文件
```

## CI/CD 工作流

### 工作流总览

| 工作流 | 触发条件 | 功能 |
|--------|----------|------|
| `claude-codereview.yml` | PR / Push → main | Claude AI 自动代码审查 |
| `test.yml` | PR → main / Push → main, workflow-jl | TypeScript 类型检查 + 测试 |
| `build.yml` | PR / Push → main | Next.js 构建验证 |
| `lint.yml` | PR → main | 提交规范、分支命名、代码标准、安全检查 |
| `prisma-check.yml` | PR → main (prisma/ 变更时) | Schema 校验、格式检查、迁移完整性 |
| `deploy-preview.yml` | PR → main | 构建并在 PR 中评论构建报告 |

### 1. Claude AI 代码审查

- **PR 审查**：代码质量、bug、安全、性能、可读性
- **Push 审查**：完整性、语法错误、调试代码、敏感信息
- 运行于 Self-hosted Runner (`ai-runner`)
- 审查结果以 PR 评论和行内批注形式反馈

### 2. 测试 + 类型检查

- 多版本 Node.js 矩阵测试 (18.x, 20.x)
- SQLite 数据库环境
- Prisma Client 生成 + 数据库初始化
- TypeScript 严格类型检查

### 3. 构建验证

- 完整的 Next.js 生产构建
- 验证构建产物是否正常生成
- 输出构建大小统计

### 4. 代码规范检查

| 检查项 | 说明 |
|--------|------|
| Commit Message | 必须符合 `<type>(<scope>): <subject>` 格式 |
| 分支命名 | 必须符合 `feat/`, `fix/`, `workflow-` 等约定 |
| TypeScript 类型检查 | `tsc --noEmit` |
| 禁止 `var` | 必须使用 `const` / `let` |
| 禁止 `console.log` | 生产代码不允许调试输出 |
| 禁止 `any` 类型 | 优先使用具体类型或 `unknown` |
| 禁止注释代码 | 不允许提交被注释的代码 |
| 敏感文件检查 | 禁止提交 `.env`、`.pem`、`.key` 等 |
| 硬编码密钥检查 | 禁止硬编码 password、secret、api_key |
| PR 描述检查 | PR 必须包含有意义的描述 |

### 5. Prisma Schema 检查

- Schema 语法校验 (`prisma validate`)
- Schema 格式检查 (`prisma format`)
- 迁移文件完整性验证
- Schema 变更必须附带迁移文件

### 6. PR 预览构建报告

- 自动构建 PR 分支
- 在 PR 中评论构建统计（大小、页面数、API 路由数）
- 更新已有评论，避免重复

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
