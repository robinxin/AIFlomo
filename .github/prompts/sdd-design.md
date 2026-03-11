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
- 提供完整可直接复制的 schema 片段（JS 格式，参考 apps/server/src/db/schema.js 的写法）
- 说明 .references()、onDelete 的设计理由
- 如本次无数据模型变更，明确写："本次无数据模型变更"

## 项目宪法
[粘贴 CONSTITUTION 全文]

## 项目指南（CLAUDE.md）
[粘贴 CLAUDE_MD 全文]

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
- 请求验证：JSON Schema 格式（Fastify 原生，参考 code-standards-backend.md 写法）
- 成功响应示例（符合 CLAUDE.md 中定义的统一 API 响应格式）
- 失败响应清单（HTTP 状态码 + error 字段内容）

## 项目宪法
[粘贴 CONSTITUTION 全文]

## 项目指南（CLAUDE.md）
[粘贴 CLAUDE_MD 全文]

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
- 需要新增的组件（文件路径在 apps/mobile/components/，具名 export，说明职责）
- Context/Reducer 变更（新增哪些 action type，影响哪个 Context 文件）
- 自定义 Hook 变更（如有）
- 用户交互流程：用户看到什么 → 操作什么 → 系统如何响应
- 调用的 API 端点（根据数据模型推断，遵循 REST 惯例）

## 项目宪法
[粘贴 CONSTITUTION 全文]

## 项目指南（CLAUDE.md）
[粘贴 CLAUDE_MD 全文]

## 严禁事项
- 只写 §4，禁止写其他章节
- 禁止使用 TypeScript 或 Redux/Zustand
- 禁止新增 npm 包
- 禁止修改 architect 的临时文件（只读）

完成后输出一行：WRITTEN: [DESIGN_FILE].frontend.md
```

---

## 第四步 — Orchestrator 合并生成最终文档

两个 Phase 2 subagent 均完成后：

1. 读取三个临时文件：
   - `${DESIGN_FILE}.architect.md`（含 §1 §2）
   - `${DESIGN_FILE}.backend.md`（含 §3）
   - `${DESIGN_FILE}.frontend.md`（含 §4）

2. 校对 §3 与 §4 的 API 路径是否一致；若有出入，以 §3（backend-developer）为准，在 §4 备注中标明差异。

3. 基于以上内容，Orchestrator 自行撰写：

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

4. 使用 Write 工具将完整文档写入 `${DESIGN_FILE}`，格式：

```markdown
# 技术方案：[功能名称]

**关联 Spec**: [spec 文件名]
**生成日期**: [YYYY-MM-DD]

[§1 内容 from architect]

[§2 内容 from architect]

[§3 内容 from backend-developer]

[§4 内容 from frontend-developer]

[§5 改动文件清单 by orchestrator]

[§6 技术约束与风险 by orchestrator]

[§7 不包含 by orchestrator]
```

5. 删除三个临时文件：
   ```bash
   rm -f "${DESIGN_FILE}.architect.md" "${DESIGN_FILE}.backend.md" "${DESIGN_FILE}.frontend.md"
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
