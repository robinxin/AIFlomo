<!--
  ===================================================
  sdd-design.md — 技术方案文档生成 Prompt
  ===================================================

  用途: 根据 spec 文件和现有代码结构，生成一份完整的技术设计文档
  调用方: claude-SDD.yml → job: sdd-plan

  运行时变量（由 GitHub Actions 在运行时注入）:
    ${CONSTITUTION}   — CONSTITUTION.md 全文（项目宪法，最高优先级约束）
    ${SPEC_FILES}     — 本次变更的 spec 文件路径，空格分隔
    ${DESIGN_FILE}    — 技术方案文档的输出路径（通常为 specs/active/xxx-design.md）

  输出: 中文技术方案文档，通过 Write 工具保存到 ${DESIGN_FILE}
  ===================================================
-->

## PROJECT CONSTITUTION (MUST FOLLOW — HIGHEST PRIORITY)

${CONSTITUTION}

---

## PROJECT GUIDE (CLAUDE.md — tech stack, directory structure, naming rules, scripts)

${CLAUDE_MD}

---

You are a senior software architect for AIFlomo.
Tech stack, conventions, and project structure are defined in `CLAUDE.md` and `CONSTITUTION.md` — read them in Step 1 before doing anything else.

## Your Task

Read the spec files and existing codebase, then generate a complete technical design document in **Chinese**.

**Step 1 — Read all inputs first (do not write anything yet):**

1. Read each spec file: `${SPEC_FILES}`
2. Read `CLAUDE.md` — project-wide rules, directory structure, and conventions
3. Read `CONSTITUTION.md` — absolute prohibitions and mandatory requirements
4. List all `.md` files in `docs/standards/` using `Bash(ls: docs/standards/)`, then read each one — coding patterns for backend and frontend
5. Scan `apps/server/src/routes/` to understand existing backend routes
6. Scan `apps/mobile/app/` to understand existing frontend screen structure
7. Read `apps/server/src/db/schema.js` — current Drizzle schema (authoritative data model)

**Step 2 — Generate the design document:**

Write the complete document in **Chinese** to: `${DESIGN_FILE}`

---

### 1. 功能概述

- 本次功能的核心目标（一句话概括）
- 在系统中的定位（与哪些已有路由、数据表、Context 产生交互）
- 用户价值：解决什么问题，带来什么体验提升

### 2. 数据模型变更

- 列出需要新增或修改的 Drizzle 表及字段
- 提供完整可直接复制的 schema 片段（JS 格式，参考 `apps/server/src/db/schema.js` 的写法）
- 说明 `.references()`、`onDelete` 的设计理由
- 如本次无数据模型变更，明确写："**本次无数据模型变更**"

### 3. API 端点设计

每个新增或修改的 Fastify 路由必须包含：

- 路径 + HTTP 方法（如 `POST /api/memos`）
- 对应文件路径（如 `apps/server/src/routes/memos.js`）
- 鉴权：`preHandler: [requireAuth]`（是否需要）
- 请求验证：JSON Schema 格式（Fastify 原生，参考 code-standards-backend.md 写法）
- 成功响应示例（符合 `{ data, message }` 格式）
- 失败响应清单（HTTP 状态码 + error 字段内容）

### 4. 前端页面与组件

- 需要新增的 Screen（文件路径在 `apps/mobile/app/` 下，说明对应的 URL 路径）
- 需要新增的组件（文件路径在 `apps/mobile/components/`，具名 export，说明职责）
- Context/Reducer 变更（新增哪些 action type，影响哪个 Context 文件）
- 自定义 Hook 变更（如有）
- 用户交互流程：用户看到什么 → 操作什么 → 系统如何响应

### 5. 改动文件清单

```
新增:
  后端:
    - apps/server/src/routes/xxx.js       — [说明]
  前端:
    - apps/mobile/app/(app)/xxx.jsx       — [说明]
    - apps/mobile/components/XxxCard.jsx  — [说明]

修改:
  后端:
    - apps/server/src/db/schema.js        — [说明具体改动]
  前端:
    - apps/mobile/context/XxxContext.jsx  — [说明具体改动]
```

### 6. 技术约束与风险

- **输入校验**：每个字段的类型、长度、格式要求（前后端均需校验）
- **安全**：XSS 防护（纯文本渲染）、认证边界
- **性能**：潜在的 N+1 查询及解决方案、是否需要分页
- **兼容性**：与现有功能的兼容性风险

### 7. 不包含（范围边界）

明确列出本次设计不涉及的功能（至少 3 条），防止实现阶段范围蔓延。

---

## Output Requirements

- Language: **Chinese**（整个文档用中文）
- Format: Markdown，使用清晰的标题层级
- 所有 API 端点必须具体到文件路径，使用 JSON Schema 格式描述请求体（不写 TypeScript 类型）
- 改动文件清单必须与"API 端点"和"前端页面与组件"章节完全一致
- 不得引用项目 `package.json` 中不存在的 npm 包
- 完成后使用 Write 工具将文档写入 `${DESIGN_FILE}`
