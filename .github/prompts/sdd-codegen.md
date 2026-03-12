/tdd 读取 Spec 文件（`${SPEC_FILES}`）、技术方案文档（`${DESIGN_FILE}`），按 TDD 流程实现 Task ${TASK_INDEX} of ${TASK_COUNT}: **${TASK_NAME}**。

${TASK_DESC}

## 进度与结果输出要求

每进入新阶段前，先输出一行进度；每个阶段结束后，输出该阶段结果。格式如下：

**阶段进度（进入前输出）：**
- `▶ [Task ${TASK_INDEX}/${TASK_COUNT}] RED — 写测试文件`
- `▶ [Task ${TASK_INDEX}/${TASK_COUNT}] GREEN — 调用 backend-developer 实现代码`
- `▶ [Task ${TASK_INDEX}/${TASK_COUNT}] REVIEW — code-reviewer 审查`
- `▶ [Task ${TASK_INDEX}/${TASK_COUNT}] SECURITY — security-reviewer 安全审查`
- `▶ [Task ${TASK_INDEX}/${TASK_COUNT}] FIX — 第 N 次修复`
- `▶ [Task ${TASK_INDEX}/${TASK_COUNT}] DONE — 完成`

**阶段结果（完成后输出）：**
- developer agent 写完每个文件后：`WRITTEN: <文件路径>`
- code-reviewer 返回后：`REVIEW: PASS` 或 `REVIEW: ISSUES` 并列出所有 CRITICAL/HIGH 问题
- security-reviewer 返回后：`SECURITY: PASS` 或 `SECURITY: ISSUES` 并列出所有 CRITICAL/HIGH 问题
- 每次修复完成后：`FIX: DONE` 或 `FIX: FAILED: <原因>`

## 开发 Agent 路由

实现代码时，根据目标文件路径调用对应 agent（Task 工具）：

- 路径仅含 `apps/server/` → **backend-developer**
- 路径仅含 `apps/mobile/` → **frontend-developer**
- 同时含两者 → **fullstack-developer**

## TDD 完成后，执行质量门禁

TDD 阶段结束（单测全通过、覆盖率 ≥ 80%）后，自行执行以下内容：

### 循环修复（最多重试 5 次）
1. 依次调用 **code-reviewer** agent 和 **security-reviewer** agent进行代码审查和安全审查
2. 若审查结果存在任意 CRITICAL 或 HIGH 问题，将问题列表传给原 developer agent（路由规则同上）修复
3. 修复后重新执行单测，确认全部通过
4. 重新调用 **code-reviewer** agent 和 **security-reviewer** agent，验证问题已解决
5. 无 CRITICAL / HIGH 问题则退出循环

## 严禁事项
- **禁止向用户提问或等待确认** — 全程自主运行，遇到歧义以 spec 和技术方案为准
- 已完成任务写入的文件，严禁修改
${ALREADY}