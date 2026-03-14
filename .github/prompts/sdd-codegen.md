使用 tdd-guide subagent 读取 Spec 文件（`${SPEC_FILES}`）、技术方案文档（`${DESIGN_FILE}`），按 TDD 流程实现 Task ${TASK_INDEX} of ${TASK_COUNT}: **${TASK_NAME}。

${TASK_DESC}

## 生成代码时使用agent的规则：

- 服务端代码使用 backend-developer subagent 生成代码
- 前端代码使用 frontend-developer subagent 生成代码

## 严禁事项
- 禁止向用户提问或等待确认 — 全程自主运行，遇到歧义以 spec 和技术方案为准
- 一定使用tdd-guide subagent做编排，不要自己编排
- 已完成任务写入的文件，严禁修改
 `${ALREADY}`