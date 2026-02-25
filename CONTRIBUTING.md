# 工程规范

## 一、分支管理

### 分支命名

| 类型 | 格式 | 示例 |
|------|------|------|
| 功能开发 | `feat/<描述>` | `feat/user-auth` |
| 问题修复 | `fix/<描述>` | `fix/login-redirect` |
| 工作流/运维 | `workflow-<描述>` | `workflow-jl` |
| 紧急修复 | `hotfix/<描述>` | `hotfix/session-expire` |
| 重构 | `refactor/<描述>` | `refactor/api-routes` |

### 分支策略

- `main` 为主分支，始终保持可发布状态
- 所有变更通过 PR 合入 `main`，禁止直接推送
- 分支生命周期：创建 → 开发 → PR → Code Review → 合并 → 删除

## 二、提交规范

### Commit Message 格式

```
<type>(<scope>): <subject>

[body]

[footer]
```

### type 类型

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 bug |
| `docs` | 文档变更 |
| `style` | 格式调整（不影响逻辑） |
| `refactor` | 重构（非新功能、非修复） |
| `test` | 测试相关 |
| `chore` | 构建工具、CI 配置等 |

### 示例

```
feat(notes): add edit functionality for notes

- Add inline editing UI with save/cancel buttons
- Call PATCH /api/notes/[id] to persist changes
- Support editing title, content, and tags

Closes #12
```

### 规则

- subject 使用英文，不超过 72 个字符
- subject 使用动词原形开头（add, fix, update, remove）
- body 可使用中文或英文，说明变更原因和细节
- 一个 commit 只做一件事，保持提交粒度合理

## 三、Pull Request 规范

### PR 标题

格式与 Commit Message 的 type + subject 一致：

```
feat(flomo): add note editing feature
```

### PR 描述模板

```markdown
## 变更说明
- 简要描述本次 PR 的改动内容

## 改动类型
- [ ] 新功能
- [ ] Bug 修复
- [ ] 重构
- [ ] 文档
- [ ] CI/CD

## 测试方式
- 描述如何验证本次改动

## 关联 Issue
Closes #xxx
```

### 合并规则

- 至少 1 人 Approve 后方可合并
- Claude Code Review 自动审查通过（无严重问题）
- 合并方式：优先使用 **Squash and merge**，保持 main 分支提交历史整洁
- 合并后删除源分支

## 四、代码风格规范

### TypeScript 通用规范

- 使用 `strict` 模式
- 优先使用 `const`，需要重新赋值时用 `let`，禁止 `var`
- 使用明确的类型标注，避免 `any`（无法避免时使用 `unknown`）
- 使用 `async/await` 处理异步，避免回调嵌套

### 命名约定

| 元素 | 风格 | 示例 |
|------|------|------|
| 变量、函数 | camelCase | `getUserNotes` |
| 类、接口、类型 | PascalCase | `NoteCard`, `SessionUser` |
| 常量 | UPPER_SNAKE_CASE | `SESSION_DAYS` |
| 文件名（组件） | PascalCase 或 kebab-case | `NotesApp.tsx` 或 `notes-app.tsx` |
| 文件名（工具/配置） | kebab-case | `auth.ts`, `prisma.ts` |
| CSS 类名 | kebab-case | `note-card`, `top-bar` |

### 导入顺序

```typescript
// 1. 外部依赖
import { NextRequest, NextResponse } from 'next/server';
import { useState } from 'react';

// 2. 内部模块
import { prisma } from '../lib/prisma';
import { getSessionUser } from '../lib/auth';

// 3. 类型
import type { SessionUser } from '../lib/auth';
```

### 注释规范

- 代码应自解释，仅在逻辑不自明时添加注释
- 公共 API 函数添加 JSDoc 注释
- TODO 格式：`// TODO: 描述`
- 禁止提交被注释掉的代码

## 五、目录结构规范

```
AIFlomo/
├── .github/
│   └── workflows/           # GitHub Actions 工作流
├── apps/
│   └── flomo/               # Flomo 笔记应用
│       ├── app/             # Next.js App Router 页面和 API
│       │   ├── api/         # API 路由（按资源分目录）
│       │   ├── login/       # 登录页
│       │   ├── register/    # 注册页
│       │   └── notes/       # 笔记页
│       ├── lib/             # 工具函数（auth, prisma, validators）
│       └── prisma/          # 数据库 Schema 和迁移
├── src/                     # Agent 协作框架
│   ├── agents/              # Agent 实现
│   ├── types/               # 类型定义
│   └── workflows/           # 工作流定义
├── CONTRIBUTING.md           # 本文件 - 工程规范
└── README.md                # 项目说明
```

### 目录约定

- 按功能模块组织，不按文件类型
- API 路由按资源分目录：`api/auth/`, `api/notes/`, `api/tags/`
- 共享工具放在 `lib/` 目录
- 类型定义集中放在 `types/` 目录
- 新增页面在 `app/` 下创建对应目录

## 六、环境配置规范

### 环境变量

- 必须提供 `.env.example` 文件，列出所有必需的环境变量
- `.env` 文件禁止提交到 Git（已在 `.gitignore` 中排除）
- 敏感信息（API Key、密码）只通过环境变量或 GitHub Secrets 传递

### .env.example 示例

```
DATABASE_URL="file:./dev.db"
SESSION_DAYS=14
```

### 数据库

- 使用 Prisma 管理 Schema 和迁移
- Schema 变更必须通过 `prisma migrate dev` 生成迁移文件
- 迁移文件需要提交到 Git
- 禁止手动修改 `dev.db` 文件

## 七、CI/CD 规范

### 工作流配置

- 工作流文件统一放在 `.github/workflows/` 下
- 文件名使用 kebab-case：`claude-codereview.yml`
- Runner 使用 self-hosted，标签为 `ai-runner`
- Secrets 通过 GitHub 仓库设置管理，禁止硬编码

### 自动化审查标准

Claude Code Review 会检查以下方面：

**PR 审查：**
- 代码质量和最佳实践
- 潜在 bug 和逻辑问题
- 安全风险
- 性能优化空间
- 与现有代码的兼容性

**Push 审查：**
- 语法错误或运行时问题
- 临时调试代码或敏感信息泄露
- 提交粒度是否合理

### 部署流程

```
功能分支开发 → PR 到 main → Claude 自动审查 → 人工 Review → 合并 → 部署
```

## 八、安全规范

- 密码使用 bcryptjs 加密，salt rounds >= 10
- Session Token 使用 `crypto.randomBytes(32)` 生成
- Cookie 设置 `httpOnly: true` 和 `sameSite: 'lax'`
- API 路由必须验证用户身份（调用 `getSessionUserFromRequest`）
- 禁止在日志中输出密码、Token 等敏感信息
- 禁止在前端代码中硬编码 API Key 或密钥
