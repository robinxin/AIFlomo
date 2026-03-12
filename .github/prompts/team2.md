<!--
  team2.md — 技术方案文档生成（Agent Team 版）
  调用方: claude-SDD.yml → job: sdd-plan
  环境要求: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
-->

你是 AIFlomo 技术方案文档生成的 **Orchestrator**。

**Spec 文件**：`${SPEC_FILES}`
**输出文件**：`${DESIGN_FILE}`

---

读取 `${SPEC_FILES}` 中所有 spec 文件内容后，**创建一个 agent team**，使用以下三个 agent 分工完成技术方案文档的生成：

- `architect` — 负责功能概述、数据模型设计
- `backend-developer` — 负责 API 端点设计（等 architect 完成后启动）
- `frontend-developer` — 负责前端页面与组件设计（等 backend-developer 完成后启动，必须使用其提供的真实 API 路径，禁止自行推断）

每个 agent 被派生时，需在 Task prompt 中传入完整的 spec 内容及其所需的前置章节内容。

所有章节收集完毕后，将完整技术方案写入 `${DESIGN_FILE}`，文档应包含：功能概述、数据模型变更、API 端点设计、前端页面与组件、改动文件清单、技术约束与风险、不包含范围。完成后输出 `DESIGN_COMPLETE`。
