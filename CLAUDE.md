# CLAUDE.md — AIFlomo 项目指南

> **最后更新**: 2026-02-25
> **审核频率**: 每周

---

## 📋 项目概述

**项目名称**: AIFlomo
**一句话描述**: 一个以 Flomo 体验为目标的全栈 MVP（快速记录 + 标签 + 搜索）
**核心理念**: 低摩擦记录，先打通“输入→存储→回看”闭环

### 技术栈

- **前端**: Next.js (App Router) + React 18 + TypeScript
- **后端**: Next.js Route Handlers (API)
- **数据库**: SQLite（MVP 阶段）
- **ORM**: Prisma
- **测试**: 预留（后续补齐）
- **包管理**: npm

---

## 🔧 常用命令

```bash
# 安装依赖
cd apps/flomo
npm install

# 生成 Prisma Client
npm run db:generate

# 数据库迁移
npm run db:migrate -- --name init

# 启动开发服务器
npm run dev
```

---

## 📁 目录结构

```
AIFlomo/
├── apps/
│   └── flomo/             # Flomo MVP 应用
│       ├── app/           # Next.js 页面 + API
│       ├── lib/           # 服务/工具
│       ├── prisma/        # Prisma schema
│       └── scripts/       # 一键启动脚本
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

### API 规范
- RESTful 风格
- 统一 JSON 结构：`{ data, error, message }`
- 使用 HTTP 状态码表达结果

### 错误处理
- 统一返回结构化错误
- 生产环境不暴露堆栈

---

## 🔒 安全红线

1. **严禁硬编码密钥** — 必须使用环境变量
2. **必须校验用户输入** — 前后端都要校验
3. **必须使用 Prisma 参数化查询** — 不写原生 SQL
4. **内容展示必须防 XSS** — 纯文本渲染
5. **输入长度限制** — 例如 Memo ≤ 10,000 字符

---

## 🧪 测试要求

- MVP 阶段允许测试为空，但新增重要功能必须补测试
- 默认质量门禁会运行 `npm run build`

---

## 🔄 Git 规范

### 分支命名
- `feature/<name>` — 新功能
- `bugfix/<name>` — 修复
- `feat/lss` — 当前开发分支

### Commit Message
```
feat: 新增 Memo 快速输入功能
fix: 修复标签解析中的特殊字符问题
```

---

## 🤖 AI Agent 专用指令

1. **先读 Spec** — 实现功能前先读 `specs/active/`
2. **先制定计划** — 明确文件与实现顺序
3. **增量实现** — 先后端再前端
4. **能跑就跑** — 尽量运行构建/检查命令

### 禁止行为
- ❌ 不要使用 `any` 类型
- ❌ 不要使用 `@ts-ignore`
- ❌ 不要删除已有测试
- ❌ 不要直接操作生产数据库
