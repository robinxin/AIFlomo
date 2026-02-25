⏺ 好的，我用中文给你解释 Agent 团队协作方式。

  Claude Code 中的 Agent 协作机制

  我可以访问多个专门化的 Agent，它们可以并行工作处理任务的不同方面：

  可用的 Agent 类型：
  - Explore - 快速搜索和理解代码库
  - Plan - 设计架构和实现策略
  - Bash - 执行命令和终端操作
  - General-purpose - 研究复杂问题、多步骤任务
  - StatusLine-setup - 配置设置
  - Claude-code-guide - 回答 Claude Code 相关问题

  协作模式

  1. 顺序协作 - 一个 Agent 完成工作后，将结果传给下一个
    - 例：Explore Agent 搜索文件 → Plan Agent 设计方案 → Bash Agent 实现
  2. 并行协作 - 多个 Agent 同时处理独立任务
    - 例：Explore Agent 搜索代码库 同时 Plan Agent 查看文档
  3. 分层协作 - Agent 将工作分配给专门工具
    - 例：主 Agent 生成 Explore Agent 进行调查，然后用结果做决策

  工作流示例

  如果你要求"给应用添加认证功能"，我会：
  1. Explore Agent（并行）- 调查现有认证代码
  2. Plan Agent（并行）- 设计实现方案
  3. 你审批该方案
  4. Bash/Edit Agent - 实现变更