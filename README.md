# AIFlomo

Flomo 核心功能的全栈复刻，采用 AI 优先开发流程——开发者编写 Spec，CI 自动完成代码生成、测试、审查与发布。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 14 (App Router) + TypeScript |
| 后端 | Next.js Route Handlers |
| 数据库 | SQLite + Prisma |
| 认证 | Session Cookie |
| 测试 | Vitest + coverage |
| CI/CD | GitHub Actions + Claude Code |

## 计划功能

以下功能通过 SDD Pipeline 逐步生成，main 分支为骨架状态：

- 用户注册 / 登录 / 登出
- 快速记录 Memo（Notes CRUD）
- 标签自动创建与关联
- 全文搜索

## 本地开发

```bash
cd apps/flomo

# 安装依赖
npm install

# 初始化数据库
npm run db:migrate

# 启动开发服务器
npm run dev
```

运行测试（SDD 生成测试文件后）：

```bash
npm run test           # 单次运行
npm run test:coverage  # 带覆盖率
```

## 项目结构

```
.
├── apps/flomo/          # Next.js 应用骨架
│   ├── app/             # App Router（API routes 由 SDD 生成）
│   ├── lib/
│   │   └── prisma.ts    # Prisma client 单例
│   ├── prisma/          # 数据模型与迁移
│   └── tests/           # 测试（由 SDD 生成）
├── specs/
│   ├── active/          # 待实现的 Feature Spec（触发 SDD Pipeline）
│   └── templates/       # Spec 模板
├── docs/                # 开发文档
└── .github/workflows/   # CI/CD 工作流
```

## AI 优先开发流程（SDD Pipeline）

本项目采用 Spec 驱动开发（SDD）：开发者只需编写功能规格，CI 自动完成后续工作。

```
开发者写 Spec
    └── push 到 feat/** 分支
          └── SDD Pipeline 自动运行
                ├── 1. Spec Review   — AI 检查规格完整性
                ├── 2. Code Gen      — AI 生成功能代码
                ├── 3. Test Gen      — AI 生成测试用例
                ├── 4. Quality Gate  — build + test:coverage
                └── 5. Release PR    — 自动创建 PR 到 main
```

### 新增功能

1. 从 main checkout 新分支：

```bash
git checkout -b feat/your-feature main
```

2. 在 `specs/active/` 创建 Spec 文件（参考 `specs/templates/`）：

```bash
cp specs/templates/feature-spec-template.md specs/active/your-feature.md
# 编辑 your-feature.md
```

3. 提交并推送：

```bash
git add specs/active/your-feature.md
git commit -m "feat(spec): add your-feature spec"
git push origin feat/your-feature
```

推送后 SDD Pipeline 自动运行，生成代码并在 Quality Gate 通过后创建 Release PR。

## CI/CD 工作流

| 工作流 | 触发条件 | 说明 |
|---|---|---|
| SDD Pipeline | push `feat/**`（specs 有变更）/ workflow_dispatch | Spec → 代码生成 → 质量门禁 → Release PR |
| Claude Code Review | push `feat/**` / PR 到 main | AI 自动代码审查，结果发布为 PR 评论或 Issue |
| Deploy | push `main` | 自动部署到自托管服务器 |

## API 设计（待实现）

以下接口通过 SDD Pipeline 生成，详见 `apps/flomo/SDD.md`：

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /api/auth/register | 注册 |
| POST | /api/auth/login | 登录 |
| POST | /api/auth/logout | 登出 |
| GET | /api/notes | 获取笔记列表 |
| POST | /api/notes | 创建笔记 |
| GET | /api/notes/:id | 获取单条笔记 |
| PATCH | /api/notes/:id | 更新笔记 |
| DELETE | /api/notes/:id | 删除笔记 |
| GET | /api/tags | 获取标签列表 |
| GET | /api/search?q= | 全文搜索 |
