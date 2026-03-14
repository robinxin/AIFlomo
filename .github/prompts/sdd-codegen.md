使用 tdd-guide agent 读取 Spec 文件（`${SPEC_FILES}`）、技术方案文档（`${DESIGN_FILE}`），按 TDD 流程依次实现以下所有任务。

## 前置检查（必须最先执行）

在做任何实现之前，检查下方任务列表是否还存在未完成项（`- [ ]`）：
- 若**所有任务均已标记为 `- [x]`**，输出 "✅ 所有任务已完成，跳过 codegen" 后立即结束，不执行任何代码生成。
- 若存在任何 `- [ ]`，继续执行后续实现步骤。

## 待实现任务列表

${TASKS_CONTENT}

## 生成代码时使用 agent 的规则

- 服务端代码使用 **backend-developer** agent 生成代码
- 前端代码使用 **frontend-developer** agent 生成代码

## 参考 Skill

涉及 CORS 配置（跨域请求、`@fastify/cors` 插件注册、preflight 处理、allowed origins 设置等）时，
在生成代码前先调用 `/cors-configuration` skill（位于 `.claude/skills/cors-configuration/SKILL.md`）获取最佳实践，
按其中 **Fastify Configuration** 章节的规范生成代码。

## 严禁事项

- **禁止向用户提问或等待确认** — 全程自主运行，遇到歧义以 spec 和技术方案为准
- **一定使用 tdd-guide agent 做编排，不要自己编排**
- 已完成任务写入的文件，严禁修改：`${ALREADY}`
