/tdd 读取 Spec 文件（`${SPEC_FILES}`）、技术方案文档（`${DESIGN_FILE}`）和任务清单（`${TASKS_FILE}`），按 TDD 流程**一次性顺序实现所有未完成任务**。

## 第一步 — 读取全局上下文（只读，不写代码）

1. 读取任务清单 `${TASKS_FILE}`，识别所有未完成任务（`[ ]` 标记），记录任务 ID、名称、目标文件
2. 读取所有 spec 文件：`${SPEC_FILES}`
3. 读取技术方案：`${DESIGN_FILE}`
4. 如有 `CLAUDE.md`，读取项目规范

打印执行计划：
```
执行计划：
共 N 个待完成任务
T1: 任务名称 — 目标文件
T2: 任务名称 — 目标文件
...
```

---

## 第二步 — 逐任务实现（TDD 全周期）

对每个未完成任务（按顺序）执行完整 TDD 周期：

**阶段进度（进入前输出）：**
- `▶ [Task X/N] START — 任务名称`
- `▶ [Task X/N] RED — 写测试文件`
- `▶ [Task X/N] GREEN — 调用 developer agent 实现代码`
- `▶ [Task X/N] REVIEW — code-reviewer 审查`
- `▶ [Task X/N] SECURITY — security-reviewer 安全审查`
- `▶ [Task X/N] FIX — 第 N 次修复`
- `▶ [Task X/N] DONE — 完成`

**阶段结果（完成后输出）：**
- developer agent 写完每个文件后：`WRITTEN: <文件路径>`
- code-reviewer 返回后：`REVIEW: PASS` 或 `REVIEW: ISSUES` 并列出所有 CRITICAL/HIGH 问题
- security-reviewer 返回后：`SECURITY: PASS` 或 `SECURITY: ISSUES` 并列出所有 CRITICAL/HIGH 问题
- 每次修复完成后：`FIX: DONE` 或 `FIX: FAILED: <原因>`

---

## 开发 Agent 路由

实现代码时，根据目标文件路径调用对应 agent（Task 工具）：

- 路径仅含 `apps/server/` → **backend-developer**
- 路径仅含 `apps/mobile/` → **frontend-developer**
- 同时含两者 → **fullstack-developer**

---

## 质量门禁（每个任务 TDD 完成后，循环修复最多 5 次）

1. 依次调用 **code-reviewer** agent 和 **security-reviewer** agent 进行审查
2. 若审查结果存在任意 CRITICAL 或 HIGH 问题，将问题列表传给原 developer agent（路由规则同上）修复
3. 修复后重新执行单测，确认全部通过
4. 重新调用 **code-reviewer** 和 **security-reviewer**，验证问题已解决
5. 无 CRITICAL / HIGH 问题则退出循环，继续下一个任务

---

## 已完成任务的文件保护

- 已完成任务（`[x]` 标记）直接跳过，不执行任何操作
- 当前任务完成后，其写入的文件视为**已保护文件**，后续任务**严禁修改**

---

## 严禁事项

- **禁止向用户提问或等待确认** — 全程自主运行，遇到歧义以 spec 和技术方案为准
- **禁止修改已完成任务写入的文件**
- **禁止使用 TypeScript** — 统一使用 JavaScript
- **禁止新增 npm 包**（除非技术方案明确要求）
- **禁止使用 Redux/Zustand** — 状态管理用 React Context + useReducer
- **禁止跳过任何任务** — 必须按顺序完成所有 `[ ]` 任务
