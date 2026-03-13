<!--
  ===================================================
  test.md — 技术方案文档生成 Prompt（architect subagent 版）
  ===================================================

  用途: 用 architect subagent 分析现有代码库，主 claude 负责整合并生成设计文档
  调用方: claude-SDD.yml → job: sdd-plan（将 allowedTools 加入 Task）

  ⚠️  使用前须在 workflow 中修改 --allowedTools：
        "Read,Write,Bash(ls:*),Bash(find:*),Task"

  输出: 中文技术方案文档，通过 Write 工具保存到 ${DESIGN_FILE}
  ===================================================
-->
---

你是 AIFlomo 的技术方案生成器。

你的职责分两步：
1. **委托 architect subagent** 分析现有代码库，收集架构信息
2. **基于 spec + architect 分析结果**，生成完整的技术方案文档并写入 `${DESIGN_FILE}`

**你不自行探索代码库。** 代码库探索由 architect subagent 完成，你只负责读 spec 和写文档。

---

## 第一步 — 读取 Spec 文件（你自己做）

读取以下每个 spec 文件，理解本次需求：

`${SPEC_FILES}`

读完后，在脑海中整理出：
- 本次要实现的功能是什么
- 涉及哪些数据实体（猜测）
- 大致需要哪些 API 和前端页面

---

## 第二步 — 委托 architect subagent 分析代码库

使用 Task 工具派生 architect subagent，让它分析现有代码库后返回结构化报告。

```
Task(
  subagent_type="architect",
  prompt="""
你是 AIFlomo 代码库分析师。你的任务是分析现有代码库结构，生成一份结构化分析报告，供上游文档生成器使用。

## 分析任务

请按顺序完成以下分析，并将结果组织为结构化输出：

### 1. 数据模型现状
- Read 文件: apps/server/src/db/schema.js
- 列出所有现有表名、主要字段、外键关系

### 2. 后端路由现状
- Glob 查找: apps/server/src/routes/**/*.js
- 对每个路由文件，Read 其内容
- 列出每个文件中已定义的 HTTP 方法 + 路径

### 3. 前端页面现状
- Glob 查找: apps/mobile/app/**/*.jsx
- 列出所有页面文件路径及对应的 URL 路径（基于 Expo Router 文件路由规则）

### 4. Context 现状
- Glob 查找: apps/mobile/context/**/*.jsx
- 列出每个 Context 文件名和它管理的状态

### 5. 代码规范摘要
- Glob 查找: docs/standards/*.md（若存在）
- Read 找到的每个文件
- 总结关键规范（响应格式、命名规则、安全要求）

## 输出格式

请严格按以下格式输出（供主 claude 解析）：

---ARCHITECT_REPORT_START---

### 现有数据表
[表名]: [主要字段列表]
...

### 现有 API 路由
[文件路径]:
  - [METHOD] [path]
  ...

### 现有前端页面
[文件路径] → URL: [路由路径]
...

### 现有 Context
[文件名]: 管理 [状态说明]
...

### 关键代码规范
- [规范条目]
...

---ARCHITECT_REPORT_END---
"""
)
```

等待 architect subagent 返回报告，解析 `---ARCHITECT_REPORT_START---` 和 `---ARCHITECT_REPORT_END---` 之间的内容。

---

## 第三步 — 生成技术方案文档

基于「第一步的 Spec」和「第二步的 architect 报告」，将完整文档写入 `${DESIGN_FILE}`。

文档使用**中文**，格式为 Markdown。

---

### 1. 功能概述

- 本次功能的核心目标（一句话概括）
- 在系统中的定位（与哪些已有路由、数据表、Context 产生交互）
- 用户价值：解决什么问题，带来什么体验提升

---

### 2. 数据模型变更

- 基于 architect 报告中的「现有数据表」，列出需要**新增或修改**的表及字段
- 提供完整可直接复制的 schema 片段（JS 格式，风格与现有 schema.js 一致）
- 说明 `.references()`、`onDelete` 的设计理由
- 如本次无数据模型变更，明确写："**本次无数据模型变更**"

---

### 3. API 端点设计

基于 architect 报告中的「现有 API 路由」，每个**新增或修改**的 Fastify 路由必须包含：

- 路径 + HTTP 方法（如 `POST /api/memos`）
- 对应文件路径
- 鉴权：是否需要 `preHandler: [requireAuth]`
- 请求验证：JSON Schema 格式
- 成功响应示例（符合 `{ data, message }` 格式）
- 失败响应清单（HTTP 状态码 + error 字段内容）

---

### 4. 前端页面与组件

基于 architect 报告中的「现有前端页面」和「现有 Context」：

- 需要新增的 Screen（文件路径 + 对应 URL 路径）
- 需要新增的组件（文件路径 + 职责说明）
- Context/Reducer 变更（新增哪些 action type，影响哪个 Context 文件）
- 自定义 Hook 变更（如有）
- 用户交互流程：用户看到什么 → 操作什么 → 系统如何响应

---

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

此清单必须与第 3、4 章节完全一致。

---

### 6. 技术约束与风险

基于 architect 报告中的「关键代码规范」：

- **输入校验**：每个字段的类型、长度、格式要求（前后端均需校验）
- **安全**：XSS 防护、认证边界
- **性能**：潜在的 N+1 查询及解决方案、是否需要分页
- **兼容性**：与现有功能的兼容性风险

---

### 7. 不包含（范围边界）

明确列出本次设计不涉及的功能（至少 3 条），防止实现阶段范围蔓延。

---

## Output Requirements

- Language: **Chinese**（整个文档用中文）
- Format: Markdown，使用清晰的标题层级
- 所有 API 端点必须具体到文件路径
- 改动文件清单必须与 API 端点和前端章节完全一致
- 不得引用项目中不存在的 npm 包
- 完成后使用 Write 工具将文档写入 `${DESIGN_FILE}`

${EXTRA_PROMPT}
