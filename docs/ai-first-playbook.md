# AI优先开发实战演练
## 以 Flomo MVP「快速记录 Memo」功能为例的完整流程示范

**日期**: 2026年2月10日  
**目的**: 展示从"人写需求"到"AI完成全部代码"的完整AI优先开发流程  
**说明**: 本文档包含该流程中**所有需要准备的材料**，但不包含实际代码

---

## 📋 目录

| 阶段 | 内容 | 负责人 |
|------|------|--------|
| [阶段0：项目规划](#阶段0项目规划) | 确定MVP范围和技术选型 | 👤 人 |
| [阶段1：项目初始化](#阶段1项目初始化) | CLAUDE.md + 仓库配置 | 👤 人 |
| [阶段2：写Feature Spec](#阶段2写feature-spec) | 功能规格文档 | 👤 人 |
| [阶段3：创建Issue](#阶段3创建github-issue) | 在GitHub上提交任务 | 👤 人 |
| [阶段4：AI执行](#阶段4ai执行实现) | AI自动实现 | 🤖 AI |
| [阶段5：AI自测](#阶段5ai自测) | AI运行测试 | 🤖 AI |
| [阶段6：AI创建PR](#阶段6ai创建pr) | AI提交代码审查 | 🤖 AI |
| [阶段7：AI Review PR](#阶段7另一个ai-review-pr) | 另一个AI审查代码 | 🤖 AI |
| [阶段8：人Review](#阶段8人review关键变化) | 人审查关键部分 | 👤 人 |
| [阶段9：合并部署](#阶段9合并与部署) | CI/CD自动完成 | 🤖 自动 |

---

## 阶段0：项目规划

> 👤 **谁来做**：人（产品/技术负责人）  
> ⏱️ **预计耗时**：30分钟

### 0.1 Flomo MVP 功能范围定义

**Flomo 是什么**：一个"无压力记录想法"的笔记工具，核心理念是像发微博一样记录思考碎片。

**MVP 功能列表**：

| 功能 | 本次示例 | 说明 |
|------|---------|------|
| ✅ 快速记录 Memo | ⭐ 本次演示 | 输入框 + 标签解析 + 存储 + 展示 |
| 标签管理 | | 多级标签树 |
| 每日回顾 | | 随机推送历史 Memo |
| 记录热力图 | | 可视化记录习惯 |
| 用户认证 | | 注册/登录 |
| 数据导出 | | Markdown/JSON |

**本次只演示第一个功能「快速记录 Memo」**——它是 Flomo 的核心，一个功能就能展示完整的 AI 优先开发流程。

### 0.2 技术选型

```
前端：React 19 + TypeScript + Vite
样式：Tailwind CSS 4
后端：Node.js 20 + Express + TypeScript
数据库：SQLite（MVP阶段，轻量部署）
ORM：Prisma
测试：Vitest + React Testing Library + Supertest
部署：Docker
```

---

## 阶段1：项目初始化

> 👤 **谁来做**：人（开发者）  
> ⏱️ **预计耗时**：20分钟

### 1.1 创建仓库和基本结构

```bash
# 创建项目
mkdir flomo-mvp && cd flomo-mvp
git init

# 初始化前端
npm create vite@latest client -- --template react-ts

# 初始化后端
mkdir server && cd server && npm init -y

# 创建AI优先开发所需的目录
mkdir -p specs/templates specs/active specs/completed
mkdir -p .github/workflows .github/ISSUE_TEMPLATE
```

### 1.2 CLAUDE.md（项目的"AI宪法"）

以下是为 Flomo MVP 项目量身定制的 `CLAUDE.md`，详见本文档内容。

---

## 阶段2：写Feature Spec

**文件位置**：`specs/active/2026-02-10-quick-memo.md`

---

## 阶段3：创建GitHub Issue

```bash
gh issue create \
  --title "feat: 快速记录 Memo — 输入、标签解析、列表展示" \
  --body "..." \
  --label "ai-task,feature"
```

---

## 阶段4-9：AI 实现 + 自测 + PR + Review + 合并

详见本文档上文流程说明。
