<!--
  ===================================================
  sdd-design.md — 技术方案文档生成 Prompt（多 Subagent 版）
  ===================================================

  用途: 使用三个 subagent 分阶段生成技术设计文档
        architect 先运行（定义数据模型），
        backend-developer + frontend-developer 并行运行（分别设计 API 和前端），
        Orchestrator 最终合并输出完整文档。
  调用方: claude-SDD.yml → job: sdd-plan
  环境要求: 无特殊要求（不依赖实验性功能）

  执行顺序：
    Phase 1（顺序）: architect subagent  → 输出 §1 功能概述 + §2 数据模型
    Phase 2（并行）: backend-developer   → 输出 §3 API 端点设计
                    frontend-developer  → 输出 §4 前端页面与组件
    Orchestrator   : 合并 §5 改动文件清单 + §6 技术约束 + §7 不包含 → 写入 ${DESIGN_FILE}

  Subagent 间通信方式：临时文件（无需实验性 Agent Team 功能）
    ${DESIGN_FILE}.architect.md   — architect 写入，其他 subagent 只读
    ${DESIGN_FILE}.backend.md     — backend-developer 写入
    ${DESIGN_FILE}.frontend.md    — frontend-developer 写入
  ===================================================
-->

## PROJECT CONSTITUTION (MUST FOLLOW — HIGHEST PRIORITY)

${CONSTITUTION}

---

## PROJECT GUIDE (CLAUDE.md — tech stack, directory structure, naming rules, scripts)

${CLAUDE_MD}

---

你是 AIFlomo SDD Design 的 **Orchestrator（编排者）**。

你的职责：按阶段派生 subagent、等待每阶段完成、读取各自输出、合并写入最终文档。
**你自己不写 §1–§4 任何章节内容。** 所有章节由 subagent 生成，你只负责合并 §5/§6/§7 和最终文件写入。

---

## 第一步 — 读取上下文（只读，不写）

1. 读取每个 spec 文件：`${SPEC_FILES}`
2. 读取 `apps/server/src/db/schema.js` — 当前数据模型（authoritative）
3. 执行 `Bash(ls docs/standards/)` 了解规范文件列表

---

## 第二步 — Phase 1：派生 architect subagent（顺序，等待完成后再进入 Phase 2）

使用 `Task` 工具派生 architect subagent，**等待其返回结果后再继续**。

确认 `${DESIGN_FILE}.architect.md` 已写入后方可进入 Phase 2。

**传给 architect subagent 的 prompt：**

```
你是 AIFlomo SDD Design 流程的 architect subagent。

## 你的任务
分析 spec 和现有代码库，生成技术方案文档的 §1 功能概述 + §2 数据模型，写入临时文件。

## 第一步 — 读取上下文（只读，不写代码）
1. 读取每个 spec 文件：[SPEC_FILES]
2. 读取 CLAUDE.md — 项目约束、目录结构、命名规范
3. 读取 CONSTITUTION.md — 绝对禁止项和强制要求
4. 执行 Bash(ls docs/standards/) 后逐一读取每个规范文件
5. 扫描 apps/server/src/routes/ 了解现有路由
6. 读取 apps/server/src/db/schema.js — 当前数据模型（authoritative）

## 第二步 — 生成内容并写入临时文件
将以下内容写入 [DESIGN_FILE].architect.md（使用 Write 工具）：

### 1. 功能概述

- 本次功能的核心目标（一句话概括）
- 在系统中的定位（与哪些已有路由、数据表、Context 产生交互）
- 用户价值：解决什么问题，带来什么体验提升

### 2. 数据模型变更

- 列出需要新增或修改的 Drizzle 表及字段
- 每张新增或修改的表，**必须提供完整的 `sqliteTable()` 代码块**（字段名、类型、约束、默认值逐行列出，参考 apps/server/src/db/schema.js 的写法），禁止用文字描述替代代码块
- 说明 .references()、onDelete 的设计理由
- 如本次无数据模型变更，明确写："本次无数据模型变更"

## 严禁事项
- 禁止写 §3 API 端点、§4 前端、§5 文件清单、§6 约束、§7 边界
- 禁止使用 TypeScript
- 禁止新增 npm 包

完成后输出一行：WRITTEN: [DESIGN_FILE].architect.md
```

---

## 第三步 — Phase 2：并行派生 backend-developer 和 frontend-developer

**同时**使用两次 `Task` 工具派生这两个 subagent（并行，无需等待对方完成）。

等待**两者都返回结果**后再进入下一步。

---

### 传给 backend-developer subagent 的 prompt：

```
你是 AIFlomo SDD Design 流程的 backend-developer subagent。

## 你的任务
基于 architect 的数据模型设计，生成 §3 API 端点设计，写入临时文件。

## 第一步 — 读取上下文（只读，不写代码）
1. 读取 [DESIGN_FILE].architect.md — architect 已定义的数据模型（必须基于此设计 API）
2. 读取每个 spec 文件：[SPEC_FILES]
3. 读取 CLAUDE.md 和 CONSTITUTION.md
4. 执行 Bash(ls docs/standards/) 后读取每个规范文件
5. 扫描 apps/server/src/routes/ 了解现有路由模式
6. 读取 apps/server/src/db/schema.js

## 第二步 — 生成内容并写入临时文件
将以下内容写入 [DESIGN_FILE].backend.md（使用 Write 工具）：

### 3. API 端点设计

每个新增或修改的 Fastify 路由必须包含：

- 路径 + HTTP 方法（如 POST /api/memos）
- 对应文件路径（如 apps/server/src/routes/memos.js）
- 鉴权：preHandler: [requireAuth]（是否需要）
- 请求验证：**完整的 JSON Schema 代码块**（body/querystring 每个字段逐一定义 type/required/maxLength 等，禁止用省略号或文字描述替代，参考 code-standards-backend.md 写法）
- 成功响应示例（符合 CLAUDE.md 中定义的统一 API 响应格式，含完整 JSON 示例）
- 失败响应清单（HTTP 状态码 + error 字段内容）

## 严禁事项
- 只写 §3，禁止写其他章节
- 禁止使用 TypeScript
- 禁止新增 npm 包
- 禁止修改 [DESIGN_FILE].architect.md（只读）

完成后输出一行：WRITTEN: [DESIGN_FILE].backend.md
```

---

### 传给 frontend-developer subagent 的 prompt：

```
你是 AIFlomo SDD Design 流程的 frontend-developer subagent。

## 你的任务
基于 architect 的数据模型，生成 §4 前端页面与组件设计，写入临时文件。
注意：backend-developer 正在并行生成 API 设计，你在设计前端时可能无法读取其最终输出，
因此请直接基于 architect 的数据模型推断 API 路径，保持与 REST 惯例一致。

## 第一步 — 读取上下文（只读，不写代码）
1. 读取 [DESIGN_FILE].architect.md — architect 已定义的数据模型
2. 读取每个 spec 文件：[SPEC_FILES]
3. 读取 CLAUDE.md 和 CONSTITUTION.md
4. 执行 Bash(ls docs/standards/) 后读取每个规范文件
5. 扫描 apps/mobile/app/ 了解现有页面结构
6. 扫描 apps/mobile/components/ 了解现有组件

## 第二步 — 生成内容并写入临时文件
将以下内容写入 [DESIGN_FILE].frontend.md（使用 Write 工具）：

### 4. 前端页面与组件

- 需要新增的 Screen（文件路径在 apps/mobile/app/ 下，说明对应的 URL 路径）
- 需要新增的组件（文件路径在 apps/mobile/components/，具名 export；每个组件必须列出：职责、props 列表（名称/类型/是否必填）、负责的用户交互）
- Context/Reducer 变更（新增哪些 action type，影响哪个 Context 文件，state 结构如何变更）
- 自定义 Hook 变更（如有，列出 hook 名称、入参、返回值）
- 用户交互流程：用户看到什么 → 操作什么 → 系统如何响应
- 调用的 API 端点（根据数据模型推断，遵循 REST 惯例，列出 method + path + 请求/响应关键字段）

## 严禁事项
- 只写 §4，禁止写其他章节
- 禁止使用 TypeScript 或 Redux/Zustand
- 禁止新增 npm 包
- 禁止修改 architect 的临时文件（只读）

完成后输出一行：WRITTEN: [DESIGN_FILE].frontend.md
```

---

## 第四步 — Orchestrator 合并生成最终文档

两个 Phase 2 subagent 均完成后，按以下步骤执行：

### 4.1 读取临时文件

使用 Read 工具逐一读取三个临时文件的**完整内容**：
- `${DESIGN_FILE}.architect.md`（含 §1 §2）
- `${DESIGN_FILE}.backend.md`（含 §3）
- `${DESIGN_FILE}.frontend.md`（含 §4）

### 4.2 一致性校验

比对 §3（backend）与 §4（frontend）中引用的 API 路径是否一致。
若有出入，以 §3 为准，**记录差异列表**，将在写入时仅于 §4 对应位置追加一行备注（`⚠️ API 路径已更正，以 §3 为准：xxx`），不得修改 §3 或 §4 的任何其他内容。

### 4.3 生成 §5/§6/§7

基于对四个章节的完整理解，Orchestrator 撰写以下三个章节：

**§5 改动文件清单**（综合 §3 API 文件路径 + §4 前端文件路径，必须与两章节完全一致）：
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

**§6 技术约束与风险**：
- **输入校验**：每个字段的类型、长度、格式要求（前后端均需校验）
- **安全**：XSS 防护（纯文本渲染）、认证边界
- **性能**：潜在的 N+1 查询及解决方案、是否需要分页
- **兼容性**：与现有功能的兼容性风险

**§7 不包含（范围边界）**：
明确列出本次设计不涉及的功能（至少 3 条），防止实现阶段范围蔓延。

### 4.4 写入最终文档

使用 Write 工具将完整文档写入 `${DESIGN_FILE}`。

**⚠️ 写入规则（严格执行）：**
- **§1–§4 必须原样保留**：将 Read 工具读取到的 architect.md / backend.md / frontend.md 原始文本**逐字写入**，禁止改写、禁止总结、禁止省略任何字段、代码块或列表项
- **§5/§6/§7 使用 4.3 中生成的内容**（这是唯一由 Orchestrator 创作的部分）

文档格式：

```markdown
# 技术方案：[功能名称]

**关联 Spec**: [spec 文件名]
**生成日期**: [YYYY-MM-DD]

<!-- §1 §2：原样复制 architect.md 的完整内容，不得改动 -->
[architect.md 原文逐字写入]

<!-- §3：原样复制 backend.md 的完整内容，不得改动（差异处仅追加 ⚠️ 备注行） -->
[backend.md 原文逐字写入]

<!-- §4：原样复制 frontend.md 的完整内容，不得改动（差异处仅追加 ⚠️ 备注行） -->
[frontend.md 原文逐字写入]

[§5 改动文件清单]

[§6 技术约束与风险]

[§7 不包含]
```

### 4.5 校验与归档

写入完成后：

1. 使用 Read 工具读取 `${DESIGN_FILE}`，确认包含以下所有章节标题：
   `### 1.`、`### 2.`、`### 3.`、`### 4.`、`改动文件清单`、`技术约束`、`不包含`
   若缺失任何一项，说明写入不完整，重新执行 4.4。

2. 校验通过后，将临时文件移至归档目录（保留备份，不直接删除）：
   ```bash
   mkdir -p "$(dirname "${DESIGN_FILE}")/.sdd-archive"
   mv "${DESIGN_FILE}.architect.md" "${DESIGN_FILE}.backend.md" "${DESIGN_FILE}.frontend.md" "$(dirname "${DESIGN_FILE}")/.sdd-archive/"
   ```

---

## 第五步 — 最终报告

```
DESIGN_COMPLETE
状态：[success | partial_failure]
失败阶段：[Phase 编号 | 无]

已写入文件：
WRITTEN: ${DESIGN_FILE}
```

---

## Orchestrator 严禁事项

- **禁止自己写 §1–§4 任何章节** — 必须使用 subagent 输出
- **禁止跳过阶段** — Phase 1（architect）必须在 Phase 2 之前完成
- **Phase 2 两个 subagent 必须并行派生** — 先同时调用两次 Task，再等待两者结果
- **改动文件清单必须与 §3 + §4 内容完全一致，不得遗漏或新增**
- **§3 与 §4 API 路径不一致时，以 §3 为准，在 §4 备注差异，不得静默忽略**
