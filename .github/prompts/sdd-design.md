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
    Phase 1（顺序）: architect subagent  → 读 spec + 已有设计文档 → 输出 §1 功能概述 + §2 数据模型 + §3 API 端点设计
    Phase 2（并行）: backend-developer   → 读 architect.md（§1 §2 §3）+ spec + 已有设计文档 → 输出 §4 后端实现细节
                    frontend-developer  → 读 architect.md（§1 §2 §3）+ spec + 已有设计文档 → 输出 §5 前端页面与组件
    Orchestrator   : 合并 §6 改动文件清单 + §7 技术约束 + §8 不包含 → 写入 ${DESIGN_FILE}
    注：代码库无需任何 subagent 直接读取，已有设计文档（specs/completed/*-design.md）已完整记录现有功能边界
    注：spec 和已有设计文档三个 subagent 各自直接读取，了解项目现有结构，无需经过 architect 二次提炼
    注：architect 先完成 API 端点设计，backend 和 frontend 均基于真实 API 路径进行设计，消除并行推断不一致的风险

  Subagent 间通信方式：临时文件（无需实验性 Agent Team 功能）
    ${DESIGN_FILE}.architect.md   — architect 写入（§1+§2+§3），其他 subagent 只读
    ${DESIGN_FILE}.backend.md     — backend-developer 写入（§4）
    ${DESIGN_FILE}.frontend.md    — frontend-developer 写入（§5）
  ===================================================
-->
---

你是 SDD Design 的 **Orchestrator（编排者）**。

你的职责：按阶段派生 subagent、等待每阶段完成、读取各自输出、合并写入最终文档。
**你自己不写 §1–§4 任何章节内容。** 所有章节由 subagent 生成，你只负责合并 §5/§6/§7 和最终文件写入。

---

## 第一步 — Phase 1：派生 architect subagent（顺序，等待完成后再进入 Phase 2）

> 🪵 **日志要求**：每个步骤开始前和完成后，必须输出一行状态文字（直接输出文字，无需 Bash），格式：`[SDD] <状态描述>`。这些文字会出现在 CI 日志中，用于追踪进度。

输出：`[SDD] Phase 1 开始 — 派生 architect subagent`

⚠️ **严禁**：调用 Task(architect) 的同一个 response 中，绝对不得同时调用 Task(backend-developer) 或 Task(frontend-developer)。必须等 Task(architect) 返回且 Bash 检查通过后，才能进入第二步。

使用 `Task` 工具派生 architect subagent，**等待其返回结果后再继续**。

Task 返回后输出：`[SDD] architect subagent 返回，检查输出文件`

用 Bash 检查文件是否写入成功：
```bash
ls "${DESIGN_FILE}.architect.md" 2>/dev/null && echo "[SDD] Phase 1 OK: architect.md 已生成" || echo "[SDD] Phase 1 WARN: architect.md not found"
```
若文件不存在，输出 `[SDD] Phase 1 重试 architect subagent`，**重试一次 Task(architect)**（使用相同 prompt）。重试后仍无文件则输出 `[SDD] Phase 1 降级：architect.md 缺失，backend/frontend 将基于 spec 自行推断` 并继续 Phase 2。

**传给 architect subagent 的 prompt（替换占位符后传入）：**

```
你是 SDD Design 流程的 architect subagent。

## 你的任务
分析 spec 和已有设计文档，生成技术方案文档的 §1 功能概述 + §2 数据模型 + §3 API 端点设计，写入临时文件。
backend-developer 和 frontend-developer 均依赖你的 §3 输出，**必须输出完整、可直接使用的 API 设计**。

## 第一步 — 读取上下文（只读，不写代码，禁止读取代码库）
1. 读取每个 spec 文件：${SPEC_FILES}
2. 读取 `specs/completed/` 下所有 `*-design.md` 文件 — 之前已生成的技术设计文档，完整记录了现有功能的路由、数据表、组件设计，**以此了解项目现有结构，禁止自行探索代码库**

## 第二步 — 生成内容并写入临时文件
将以下内容写入 ${DESIGN_FILE}.architect.md（使用 Write 工具）：

### 1. 功能概述

- 本次功能的核心目标（一句话概括）
- 在系统中的定位（与哪些已有路由、数据表、状态管理产生交互）
- 用户价值：解决什么问题，带来什么体验提升

### 2. 数据模型变更

- 列出需要新增或修改的数据表及字段（技术栈参考 CLAUDE.md）
- 每张新增或修改的表，**必须提供完整的 schema 定义代码块**（字段名、类型、约束、默认值逐行列出，参考项目现有 schema 文件的写法），禁止用文字描述替代代码块
- 说明外键关联、级联删除的设计理由
- 如本次无数据模型变更，明确写："本次无数据模型变更"

### 3. API 端点设计

每个新增或修改的路由必须包含：

- 路径 + HTTP 方法（如 POST /api/resources）
- 对应文件路径（参考 CLAUDE.md 目录结构）
- 鉴权：是否需要认证中间件（参考 CLAUDE.md 的认证方案）
- 请求验证：**完整的请求 schema 代码块**（每个字段逐一定义 type/required/maxLength 等，禁止用省略号或文字描述替代，参考 CLAUDE.md 规范写法）
- 成功响应示例（符合 CLAUDE.md 中定义的统一 API 响应格式，含完整 JSON 示例）
- 失败响应清单（HTTP 状态码 + error 字段内容）
- **跨域（CORS）**：该端点是否需要跨域访问；如需要，列出允许的来源（origin）、是否携带 Cookie（credentials）、需要放行的 Header

## 严禁事项
- 禁止向用户提问或等待确认 — 全程自主运行，遇到歧义以 spec 为准

完成后输出一行：WRITTEN: ${DESIGN_FILE}.architect.md
```

---

## 第二步 — Phase 2：并行派生 backend-developer 和 frontend-developer

输出：`[SDD] Phase 2 开始 — 并行派生 backend-developer 和 frontend-developer`

**同时**使用两次 `Task` 工具派生这两个 subagent（并行，无需等待对方完成）。
两者均依赖 architect 已完成的 §3 API 端点设计，可直接读取 architect.md 获取真实 API 路径。

等待**两者都返回结果**后输出：`[SDD] Phase 2 完成 — backend 和 frontend subagent 均已返回`，再进入下一步。

---

### 传给 backend-developer subagent 的 prompt：

```
你是 SDD Design 流程的 backend-developer subagent。

## 你的任务
基于 architect 已完成的 §1 功能概述 + §2 数据模型 + §3 API 端点设计，生成 §4 后端实现细节，写入临时文件。
**不要重复 architect 已设计的 API 路径和 schema，只补充实现层面的细节。**

## 第一步 — 读取上下文（只读，不写代码）
1. 读取 ${DESIGN_FILE}.architect.md — 含功能概述（§1）+ 数据模型（§2）+ API 端点设计（§3），禁止自行探索代码库
2. 读取每个 spec 文件：${SPEC_FILES}
3. 读取 `specs/completed/` 下所有 `*-design.md` 文件 — 之前已生成的技术设计文档，**以此了解项目现有结构**

## 第二步 — 生成内容并写入临时文件
将以下内容写入 ${DESIGN_FILE}.backend.md（使用 Write 工具）：

### 4. 后端实现细节

针对 §3 中每个 API 端点，补充：

- **业务逻辑**：核心处理步骤（数据库操作顺序、事务边界、错误分支）
- **中间件**：需要新增或复用的 Fastify 插件/钩子（如鉴权 preHandler、限流等）
- **数据库操作**：对应的 Drizzle ORM 查询模式（select/insert/update/delete，是否需要事务）
- **边界条件**：并发冲突、重复提交、数据不存在等特殊情况的处理策略

## 严禁事项
- 禁止向用户提问或等待确认 — 全程自主运行，遇到歧义以 spec 为准
- 禁止修改 ${DESIGN_FILE}.architect.md（只读）
- 禁止重新定义 API 路径或请求 schema（以 §3 为准）

完成后输出一行：WRITTEN: ${DESIGN_FILE}.backend.md
```

---

### 传给 frontend-developer subagent 的 prompt：

```
你是 SDD Design 流程的 frontend-developer subagent。

## 你的任务
基于 architect 已完成的 §1 功能概述 + §2 数据模型 + §3 API 端点设计，生成 §5 前端页面与组件设计，写入临时文件。
**直接使用 §3 中的真实 API 路径，无需自行推断。**

## 第一步 — 读取上下文（只读，不写代码）
1. 读取 ${DESIGN_FILE}.architect.md — 含功能概述（§1）+ 数据模型（§2）+ API 端点设计（§3），禁止自行探索代码库
2. 读取每个 spec 文件：${SPEC_FILES}
3. 读取 CLAUDE.md — 了解前端目录结构、状态管理方案、组件命名规范
4. 读取 `specs/completed/` 下所有 `*-design.md` 文件 — 之前已生成的技术设计文档，**以此了解项目现有结构**

## 第二步 — 生成内容并写入临时文件
将以下内容写入 ${DESIGN_FILE}.frontend.md（使用 Write 工具）：

### 5. 前端页面与组件

- 需要新增的 Screen/页面（文件路径参考 CLAUDE.md 目录结构，说明对应的 URL 路径）
- 需要新增的组件（参考 CLAUDE.md 命名规范；每个组件必须列出：职责、props 列表（名称/类型/是否必填）、负责的用户交互）
- 状态管理变更（新增哪些 action type，影响哪个 Context/Store 文件，state 结构如何变更）
- 自定义 Hook 变更（如有，列出 hook 名称、入参、返回值）
- **用户交互流程**（⚠️ 必须严格以 spec 中描述的交互设计为准，不得新增、删减或改变任何交互步骤）：
  - 逐条列出 spec 中定义的每个交互场景
  - 每个场景格式：用户看到什么 → 操作什么 → 系统如何响应（含 loading/success/error 三种状态）
  - 若 spec 对某交互有明确的 UI 文案、顺序或条件，**必须原样保留，不得发挥**
  - 若 spec 未描述某交互细节，可补充但必须标注 `（spec 未指定，实现时以最小化为原则）`
- 调用的 API 端点（直接引用 §3 中的 method + path + 请求/响应关键字段，不得自行推断路径）
- **跨域处理**：若前后端不同源，列出前端请求时需要设置的参数（如 `credentials: 'include'`、自定义 Header 等），与 §3 中的 CORS 配置保持一致

## 严禁事项
- 禁止向用户提问或等待确认 — 全程自主运行，遇到歧义以 spec 为准
- 禁止修改 architect 的临时文件（只读）
- 禁止自行推断 API 路径，必须与 §3 保持一致
- **禁止在 spec 未说明之处自行设计交互流程** — 所有交互必须有 spec 依据，无依据处只能最小化补充并标注

完成后输出一行：WRITTEN: ${DESIGN_FILE}.frontend.md
```

---

## 第三步 — Orchestrator 合并生成最终文档

输出：`[SDD] Phase 3 开始 — 读取临时文件并合并`

所有 subagent 均完成后，按以下步骤执行：

### 4.1 读取临时文件

输出：`[SDD] 读取 architect.md / backend.md / frontend.md`

使用 Read 工具逐一读取三个临时文件的**完整内容**：
- `${DESIGN_FILE}.architect.md`（含 §1 功能概述 + §2 数据模型 + §3 API 端点设计）
- `${DESIGN_FILE}.backend.md`（含 §4 后端实现细节）
- `${DESIGN_FILE}.frontend.md`（含 §5 前端页面与组件）

### 4.2 一致性校验

输出：`[SDD] 校验 architect §3 API 路径与 frontend §5 引用的一致性`

比对 §3（architect）与 §5（frontend）中引用的 API 路径是否一致。
若有出入，以 §3 为准，**记录差异列表**，将在写入时仅于 §5 对应位置追加一行备注（`⚠️ API 路径已更正，以 §3 为准：xxx`），不得修改 §3 或 §5 的任何其他内容。

### 4.3 生成 §6/§7/§8

基于对五个章节的完整理解，Orchestrator 撰写以下三个章节：

**§6 改动文件清单**（综合 §3 API 文件路径 + §4 后端文件路径 + §5 前端文件路径，必须与各章节完全一致）：
```
新增:
  后端:
    - [后端文件路径]       — [说明]
  前端:
    - [前端页面路径]       — [说明]
    - [前端组件路径]       — [说明]

修改:
  后端:
    - [后端文件路径]       — [说明具体改动]
  前端:
    - [状态管理文件路径]   — [说明具体改动]
```

**§7 技术约束与风险**：
- **输入校验**：每个字段的类型、长度、格式要求（前后端均需校验）
- **安全**：XSS 防护（纯文本渲染）、认证边界
- **跨域（CORS）**：前端域名与后端域名是否同源；如跨域，列出需要在 Fastify CORS 插件中放行的来源、方法、头部，以及 Cookie/Session 跨域时是否需要 `credentials: true`
- **性能**：潜在的 N+1 查询及解决方案、是否需要分页
- **兼容性**：与现有功能的兼容性风险

**§8 不包含（范围边界）**：
明确列出本次设计不涉及的功能（至少 3 条），防止实现阶段范围蔓延。

### 4.4 写入最终文档

输出：`[SDD] 写入最终文档 ${DESIGN_FILE}`

使用 Write 工具将完整文档写入 `${DESIGN_FILE}`。

**⚠️ 写入规则（严格执行）：**
- **§1–§5 必须原样保留**：将 Read 工具读取到的 architect.md / backend.md / frontend.md 原始文本**逐字写入**，禁止改写、禁止总结、禁止省略任何字段、代码块或列表项
- **§6/§7/§8 使用 4.3 中生成的内容**（这是唯一由 Orchestrator 创作的部分）

文档格式：

```markdown
# 技术方案：[功能名称]

**关联 Spec**: [spec 文件名]
**生成日期**: [YYYY-MM-DD]

<!-- §1 §2 §3：原样复制 architect.md 的完整内容，不得改动 -->
[architect.md 原文逐字写入]

<!-- §4：原样复制 backend.md 的完整内容，不得改动 -->
[backend.md 原文逐字写入]

<!-- §5：原样复制 frontend.md 的完整内容，不得改动（差异处仅追加 ⚠️ 备注行） -->
[frontend.md 原文逐字写入]

[§6 改动文件清单]

[§7 技术约束与风险]

[§8 不包含]
```

写入完成后，输出：`[SDD] ✅ 最终文档写入完成`

---

## 第四步 — 最终报告

输出：`[SDD] Pipeline 完成`

```
DESIGN_COMPLETE
状态：[success | partial_failure]
失败阶段：[Phase 编号 | 无]

已写入文件：
WRITTEN: ${DESIGN_FILE}
```

---

## Orchestrator 严禁事项

- **禁止向用户提问或等待确认** — 全程自主运行，遇到歧义以 spec 为准
- **禁止自己写 §1–§5 任何章节** — 必须使用 subagent 输出
- **禁止跳过阶段** — Phase 1（architect）必须在 Phase 2 之前完成
- **Phase 2 两个 subagent 必须并行派生** — 先同时调用两次 Task，再等待两者结果
- **改动文件清单必须与 §3 + §4 + §5 内容完全一致，不得遗漏或新增**
- **§3 与 §5 API 路径不一致时，以 §3 为准，在 §5 备注差异，不得静默忽略**
