# AIFlomo - Agent 协作框架

## 🎯 项目简介

AIFlomo 是一个展示 **Agent 协作最佳实践** 的完整框架实现。它演示了如何在复杂系统中有效地组织多个智能 Agent，使它们能够协作完成复杂的任务。

### 核心特性

- 🤝 **多 Agent 协作** - 支持多个 Agent 的并行和顺序执行
- 🏗️ **清晰的架构** - 职责分离，易于理解和扩展
- 🔄 **灵活的工作流** - 可视化定义和执行复杂的流程
- 📊 **完善的监控** - 详细的性能指标和执行日志
- 🚀 **高效执行** - 自动优化并行机会，提高系统吞吐量
- 📚 **详细文档** - 从概念到实现的完整指南

## 📁 项目结构

```
AIFlomo/
├── src/
│   ├── agents/
│   │   ├── base-agent.ts          # Agent 基础类
│   │   ├── coordinator.ts         # Coordinator (协调器)
│   │   └── example-agents.ts      # 示例 Agent 实现
│   ├── types/
│   │   └── agent.ts               # TypeScript 类型定义
│   ├── workflows/
│   │   └── feature-development.ts # 工作流示例
│   └── index.ts                   # 主程序
│
├── 📄 AGENT_COLLABORATION_BEST_PRACTICES.md  # 最佳实践指南
├── 📄 IMPLEMENTATION_GUIDE.md                # 实现指南
├── 📄 agent-architecture.json                # 架构配置
├── 📄 package.json                          # 项目配置
└── 📄 tsconfig.json                        # TypeScript 配置
```

## 🚀 快速开始

### 安装依赖

```bash
# 使用 npm
npm install

# 或使用 yarn
yarn install
```

### 运行演示

```bash
# 开发模式（使用 ts-node）
npm run dev

# 或编译后运行
npm run build
npm start
```

## 📖 核心概念

### Agent（代理）

Agent 是一个**独立的、可执行的单元**，负责特定的工作。

```typescript
// 示例: Explorer Agent - 搜索和分析代码
const explorerAgent = new ExplorerAgent();
const result = await explorerAgent.execute({
  task_id: 'task_001',
  agent_id: 'explorer',
  action: 'code_search',
  input: { keywords: ['auth', 'login'] },
  // ... 其他参数
});
```

### Coordinator（协调器）

Coordinator 是**中央调度器**，管理所有 Agent 的协作。

```typescript
const coordinator = new CoordinatorAgent();
await coordinator.initialize();

// 注册 Agent
coordinator.registerAgent({
  id: explorerAgent.metadata.id,
  capabilities: explorerAgent.metadata.capabilities,
  execute: (req) => explorerAgent.execute(req),
  getStatus: () => explorerAgent.getStatus(),
});

// 执行工作流
const result = await coordinator.executeWorkflow(workflowId, input);
```

### Workflow（工作流）

Workflow 定义了一系列**阶段和步骤**。

```typescript
const workflow: CollaborationWorkflow = {
  id: 'feature_dev',
  name: '功能开发工作流',
  stages: [
    {
      name: '分析与设计',
      agents: ['explorer', 'planner'],
      mode: 'parallel',  // 并行执行
      timeout_ms: 30000,
    },
    {
      name: '实现',
      agents: ['executor'],
      mode: 'sequential',
      timeout_ms: 60000,
    },
    {
      name: '验证',
      agents: ['validator'],
      mode: 'sequential',
      timeout_ms: 45000,
    },
  ],
};
```

## 🎓 使用示例

### 示例 1: 功能开发工作流

```typescript
import { demonstrateWorkflow } from './workflows/feature-development';

// 运行完整的功能开发演示
await demonstrateWorkflow();
```

**执行流程：**

```
输入: 用户认证系统功能需求
  ↓
[并行执行]
├─ Explorer Agent: 分析现有代码
└─ Planner Agent: 设计实现方案
  ↓
Executor Agent: 实现功能
  ↓
Validator Agent: 测试和验证
  ↓
输出: 已验证的功能
```

### 示例 2: 创建自定义 Agent

```typescript
import { BaseAgent } from './agents/base-agent';

export class MyAnalyzerAgent extends BaseAgent {
  constructor() {
    super({
      id: 'my_analyzer',
      name: 'My Analyzer',
      description: '我的分析 Agent',
      version: '1.0.0',
      capabilities: ['analyze', 'report', 'process'],
      max_concurrent_tasks: 5,
      timeout_ms: 30000,
      dependencies: [],
    });
  }

  protected async handleRequest(request) {
    switch (request.action) {
      case 'analyze':
        return this.analyze(request.input);
      case 'report':
        return this.generateReport(request.input);
      case 'process':
        return this.process(request.input);
    }
  }

  private async analyze(input) {
    // 实现分析逻辑
    return { analysis_result: '...' };
  }

  private async generateReport(input) {
    // 实现报告生成逻辑
    return { report: '...' };
  }

  private async process(input) {
    // 实现通用处理逻辑
    return { result: '...' };
  }
}
```

### 示例 3: 定义和执行自定义工作流

```typescript
// 定义工作流
const customWorkflow: CollaborationWorkflow = {
  id: 'custom_workflow',
  name: '自定义工作流',
  stages: [
    {
      name: '分析',
      agents: ['my_analyzer'],
      mode: 'sequential',
      timeout_ms: 30000,
    },
  ],
};

// 注册和执行
coordinator.createWorkflow(customWorkflow);
const result = await coordinator.executeWorkflow(
  'custom_workflow',
  { data: 'input data' }
);

console.log(result.overall_result);
```

## 📊 性能指标示例

运行演示后，您会看到类似的输出：

```
================================================================================
Agent 状态统计
================================================================================

[Explorer Agent]
  成功率: 100.00%
  平均执行时间: 125ms
  失败数: 0

[Planner Agent]
  成功率: 100.00%
  平均执行时间: 150ms
  失败数: 0

[Executor Agent]
  成功率: 100.00%
  平均执行时间: 180ms
  失败数: 0

[Validator Agent]
  成功率: 100.00%
  平均执行时间: 145ms
  失败数: 0
```

## 🔍 最佳实践

### 1. 职责分离

```
✓ 每个 Agent 只负责一个职责
✗ 一个 Agent 处理多个不相关的任务
```

### 2. 并行优先

```
✓ 识别可以并行执行的任务
✓ 只在有依赖时才顺序执行
✗ 把所有任务都顺序执行
```

### 3. 清晰的通信

```
✓ 使用标准的请求/响应格式
✓ 明确定义输入和输出
✗ 使用不同的通信协议
```

### 4. 监控和日志

```
✓ 记录每个 Agent 的执行时间
✓ 追踪任务的依赖关系
✗ 缺少必要的监控信息
```

## 📚 文档

详细文档请参考：

- **[最佳实践指南](./AGENT_COLLABORATION_BEST_PRACTICES.md)** - 深入理解 Agent 协作的原理和最佳实践
- **[实现指南](./IMPLEMENTATION_GUIDE.md)** - 从概念到代码的完整实现教程
- **[架构配置](./agent-architecture.json)** - 系统架构和配置详情
- **[类型定义](./src/types/agent.ts)** - 完整的 TypeScript 类型文档

## 🔧 配置

### Agent 配置

编辑 `agent-architecture.json` 来配置 Agent 的属性：

```json
{
  "agents": [
    {
      "id": "explorer",
      "name": "Explorer Agent",
      "capabilities": ["code_search", "file_analysis"],
      "timeout_ms": 30000,
      "max_concurrent_tasks": 5
    }
  ]
}
```

### TypeScript 配置

编辑 `tsconfig.json` 来调整编译选项。

## 🧪 测试

项目包含完整的演示程序：

```bash
# 运行功能开发工作流演示
npm run dev

# 查看并行执行的优势
npm run demo
```

## 🤝 贡献

欢迎贡献代码和改进建议！

## 📝 许可

MIT License

## 🆘 常见问题

### Q: 如何添加新的 Agent？

A: 继承 `BaseAgent` 类，实现 `handleRequest` 方法，然后向 Coordinator 注册。详见[实现指南](./IMPLEMENTATION_GUIDE.md)。

### Q: 如何优化工作流性能？

A: 识别可以并行执行的 Agent，使用 `mode: 'parallel'`。详见[最佳实践指南](./AGENT_COLLABORATION_BEST_PRACTICES.md)。

### Q: 如何处理 Agent 失败？

A: 实现重试逻辑和错误处理。详见[实现指南](./IMPLEMENTATION_GUIDE.md#故障排除)。

## 📞 联系方式

如有问题或建议，欢迎提出 Issue 或 PR。

---

**快乐编码！** 🚀

