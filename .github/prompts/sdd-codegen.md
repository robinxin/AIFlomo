/tdd 读取 Spec 文件（`${SPEC_FILES}`）、技术方案文档（`${DESIGN_FILE}`），按 TDD 流程实现 Task ${TASK_INDEX} of ${TASK_COUNT}: **${TASK_NAME}**。

${TASK_DESC}

## 开发 Agent 路由

实现代码时，根据目标文件路径调用对应 agent（Task 工具）：

- 路径仅含 `apps/server/` → **backend-developer**
- 路径仅含 `apps/mobile/` → **frontend-developer**
- 同时含两者 → **fullstack-developer**

## TDD 完成后，自行依次调用以下 agent

1. **code-reviewer** — 审查所有生成的文件（测试文件 + 业务代码）
2. **security-reviewer** — 安全审查所有生成的文件

## 已完成任务写入的文件 — 严禁修改

${ALREADY}

## 严禁事项

- **禁止向用户提问或等待确认** — 全程自主运行，遇到歧义以 spec 和技术方案为准