/tdd-guide 读取 Spec 文件（`${SPEC_FILES}`）、技术方案文档（`${DESIGN_FILE}`），按 TDD 流程实现 Task ${TASK_INDEX} of ${TASK_COUNT}: **${TASK_NAME}**。

${TASK_DESC}

## 开发 Agent 路由

实现代码时，根据**本次 Task 涉及的代码性质**判断调用哪个 agent（Task 工具）：

- 涉及的文件**仅包含**服务端代码（API 路由、数据库操作、服务层逻辑、后台任务等） → **backend-developer**
- 涉及的文件**仅包含**客户端代码（UI 组件、页面、客户端状态管理、样式等） → **frontend-developer**
- 同时涉及服务端和客户端代码 → **fullstack-developer**


## 严禁事项
- **禁止向用户提问或等待确认** — 全程自主运行，遇到歧义以 spec 和技术方案为准
- 已完成任务写入的文件，严禁修改
${ALREADY}