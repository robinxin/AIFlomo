# Frontend Project

前端项目，采用 AI 优先开发流程（SDD）——开发者编写 Spec，CI 自动完成代码生成、测试、审查与发布。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端（跨端） | Expo (React Native) + JavaScript — Web / Android / iOS |
| 工具 | Node.js |
| 认证 | Session + Cookie |
| 状态管理 | React Context + useReducer |
| 前端测试 | Vitest |
| E2E 测试 | @playwright/test |
| 包管理 | pnpm workspaces（Monorepo）|
| 进程守护 | pm2（VPS 部署）|
| CI/CD | GitHub Actions + Claude Code |

## 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器（前后端）
pnpm dev

# 仅启动前端
pnpm dev -w apps/mobile
```

运行测试：

```bash
pnpm test              # E2E 测试
pnpm test:unit         # 前后端单测
```

## 项目结构

```
.
├── apps/
│   ├── mobile/        # Expo 跨端前端（Web + Android + iOS）
│   └── tests/         # Playwright E2E 测试
├── specs/
│   ├── active/        # 待实现的 Feature Spec（触发 SDD Pipeline）
│   ├── templates/     # Spec 模板
│   └── completed/     # 已完成归档
├── scripts/ci/        # CI 接口脚本（技术栈无关）
├── testcases/         # 测试用例描述文件
└── .github/workflows/ # CI/CD 工作流
```

## AI 优先开发流程（SDD Pipeline）

本项目采用 Spec 驱动开发（SDD）：开发者只需编写功能规格，CI 自动完成后续工作。

```
开发者写 Spec
    └── push 到 feat/** 分支
          └── SDD Pipeline 自动运行
                ├── 1. Spec Review    — AI 检查规格完整性
                ├── 2. Design         — AI 生成技术方案（人工审批）
                ├── 3. Task Breakdown — AI 拆解任务清单（人工审批）
                ├── 4. Code Gen       — AI 生成功能代码
                ├── 5. Testcase Gen   — AI 生成测试用例（人工审批）
                ├── 6. Test Code Gen  — AI 生成可执行测试代码（人工审批）
                └── 7. Quality Gate   — lint → build → test:unit → E2E → Release PR
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
|--------|---------|------|
| SDD Pipeline | push `feat/**`（specs 有变更）/ workflow_dispatch | Spec → 代码生成 → 质量门禁 → Release PR |
| Claude Code Review | push `feat/**`（apps/scripts 有变更）/ PR 到 main | AI 自动代码审查，结果发布为 PR 评论或 Issue |
| Deploy | push `main` | 自动部署到自托管服务器 |
