# Agent 协作框架 - 实现指南

## 目录

1. [项目概述](#项目概述)
2. [项目结构](#项目结构)
3. [核心概念](#核心概念)
4. [如何创建自定义 Agent](#如何创建自定义-agent)
5. [如何定义工作流](#如何定义工作流)
6. [性能优化](#性能优化)
7. [常见场景](#常见场景)
8. [故障排除](#故障排除)

---

## 项目概述

AIFlomo 是一个展示 Agent 协作最佳实践的完整框架。它演示了如何：

- **解耦不同职责** - 每个 Agent 处理特定的功能
- **并行执行** - 无依赖的任务同时运行
- **集中管理** - Coordinator 统一调度所有 Agent
- **结构化工作流** - 可复用的工作流定义
- **监控和追踪** - 完整的执行信息和性能指标

---

## 项目结构

```
AIFlomo/
├── src/
│   ├── agents/               # Agent 实现
│   │   ├── base-agent.ts     # 基础 Agent 类
│   │   ├── coordinator.ts    # Coordinator 实现
│   │   └── example-agents.ts # 示例 Agent（Explorer, Planner, etc.）
│   │
│   ├── types/               # TypeScript 类型定义
│   │   └── agent.ts         # 所有类型的定义
│   │
│   ├── workflows/           # 工作流实现
│   │   └── feature-development.ts
│   │
│   └── index.ts            # 主程序入口
│
├── AGENT_COLLABORATION_BEST_PRACTICES.md  # 最佳实践指南
├── IMPLEMENTATION_GUIDE.md                 # 本文件
├── agent-architecture.json                 # 架构配置
├── package.json                            # 项目配置
└── tsconfig.json                          # TypeScript 配置
```

---

## 核心概念

### 1. Agent（代理）

Agent 是一个**独立的、可执行的单元**，负责特定的工作。

**主要特性：**
- 有明确的职责范围
- 接收请求，处理后返回结果
- 有自己的状态和性能指标
- 可以与其他 Agent 协作

**示例：**
- **ExplorerAgent** - 搜索和分析代码
- **PlannerAgent** - 设计架构和规划任务
- **ExecutorAgent** - 实现功能
- **ValidatorAgent** - 测试和验证

### 2. Coordinator（协调器）

Coordinator 是 Agent 之间的**中央调度器**。

**职责：**
- 注册和管理 Agent
- 定义和执行工作流
- 管理任务依赖关系
- 处理错误和重试
- 汇总执行结果

### 3. Workflow（工作流）

Workflow 定义了一系列**阶段和步骤**。

**结构：**
```
工作流
  └─ 阶段 1
      ├─ Agent A
      └─ Agent B (并行)
  └─ 阶段 2
      └─ Agent C (顺序)
  └─ 阶段 3
      └─ Agent D
```

### 4. ExecutionContext（执行上下文）

ExecutionContext 包含执行任务所需的所有信息。

**包含内容：**
- 项目路径和配置
- 共享状态
- 日志记录器
- 事件总线

---

## 如何创建自定义 Agent

### 步骤 1：继承 BaseAgent

```typescript
import { BaseAgent } from './base-agent';
import { AgentMetadata, AgentExecutionRequest } from '../types/agent';

export class MyCustomAgent extends BaseAgent {
  constructor() {
    const metadata: AgentMetadata = {
      id: 'my_custom_agent',
      name: 'My Custom Agent',
      description: '我的自定义 Agent 的描述',
      version: '1.0.0',
      capabilities: ['action1', 'action2', 'process'],
      max_concurrent_tasks: 5,
      timeout_ms: 30000,
      dependencies: [],
    };
    super(metadata);
  }

  protected async handleRequest(
    request: AgentExecutionRequest
  ): Promise<Record<string, any>> {
    const { action, input } = request;

    switch (action) {
      case 'action1':
        return await this.doAction1(input);
      case 'action2':
        return await this.doAction2(input);
      case 'process':
        return await this.processInput(input);
      default:
        throw new Error(`未知的操作: ${action}`);
    }
  }

  private async doAction1(input: Record<string, any>) {
    // 实现你的逻辑
    return { result: 'action1 结果' };
  }

  private async doAction2(input: Record<string, any>) {
    // 实现你的逻辑
    return { result: 'action2 结果' };
  }

  private async processInput(input: Record<string, any>) {
    // 实现通用处理逻辑
    return { result: 'process 结果' };
  }
}
```

### 步骤 2：注册 Agent

```typescript
const coordinator = new CoordinatorAgent();
const myAgent = new MyCustomAgent();

coordinator.registerAgent({
  id: myAgent.metadata.id,
  capabilities: myAgent.metadata.capabilities,
  execute: (req) => myAgent.execute(req),
  getStatus: () => myAgent.getStatus(),
});
```

---

## 如何定义工作流

### 基本工作流定义

```typescript
import { CollaborationWorkflow } from '../types/agent';

const myWorkflow: CollaborationWorkflow = {
  id: 'my_workflow_id',
  name: 'My Workflow',
  description: '我的工作流描述',
  stages: [
    {
      name: 'Stage 1: Discovery',
      description: '发现阶段',
      agents: ['explorer'],
      mode: 'sequential',
      timeout_ms: 30000,
    },
    {
      name: 'Stage 2: Analysis & Planning',
      description: '并行分析和规划',
      agents: ['analyzer', 'planner'],
      mode: 'parallel',  // 并行执行这两个 Agent
      timeout_ms: 45000,
    },
    {
      name: 'Stage 3: Implementation',
      description: '实现阶段',
      agents: ['executor'],
      mode: 'sequential',
      timeout_ms: 60000,
    },
    {
      name: 'Stage 4: Validation',
      description: '验证阶段',
      agents: ['validator'],
      mode: 'sequential',
      timeout_ms: 45000,
    },
  ],
  created_at: new Date().toISOString(),
};
```

### 执行工作流

```typescript
const result = await coordinator.executeWorkflow(
  myWorkflow.id,
  {
    project_name: 'My Project',
    requirements: 'Project requirements here',
  }
);

// 检查结果
if (result.status === 'completed') {
  console.log('工作流成功完成');
  console.log(`总耗时: ${result.total_execution_time_ms}ms`);
} else {
  console.error(`工作流失败: ${result.error}`);
}
```

---

## 性能优化

### 1. 识别并行机会

**不好的做法（顺序执行）：**
```typescript
stages: [
  { agents: ['explorer'], mode: 'sequential' },  // 10s
  { agents: ['planner'], mode: 'sequential' },   // 10s
  { agents: ['executor'], mode: 'sequential' },  // 15s
  // 总耗时: 35s
]
```

**好的做法（并行执行）：**
```typescript
stages: [
  { agents: ['explorer', 'planner'], mode: 'parallel' },  // 10s (同时进行)
  { agents: ['executor'], mode: 'sequential' },           // 15s
  // 总耗时: 25s (节省 28% 的时间)
]
```

### 2. 缓存结果

避免重复处理相同的数据：

```typescript
// 在 Coordinator 中缓存结果
coordinator.cacheResult('key', result);

// 检查缓存
const cachedResult = coordinator.getFromCache('key');
if (cachedResult) {
  return cachedResult;
}
```

### 3. 调整超时时间

根据实际情况调整超时，避免不必要的等待：

```typescript
{
  name: 'Quick Analysis',
  agents: ['explorer'],
  mode: 'sequential',
  timeout_ms: 15000,  // 快速操作用较短超时
}

{
  name: 'Complex Processing',
  agents: ['executor'],
  mode: 'sequential',
  timeout_ms: 120000,  // 复杂操作用较长超时
}
```

### 4. 优化 Agent 数量

过多的并发 Agent 会导致资源竞争：

```typescript
{
  name: 'Parallel Analysis',
  agents: [
    'analyzer_1',
    'analyzer_2',
    'analyzer_3',
    // 最多 3 个并行，平衡效率和资源使用
  ],
  mode: 'parallel',
  timeout_ms: 30000,
}
```

---

## 常见场景

### 场景 1: 功能开发

```typescript
stages: [
  {
    name: '分析与设计',
    agents: ['explorer', 'designer'],
    mode: 'parallel',
    timeout_ms: 30000,
  },
  {
    name: '实现',
    agents: ['developer'],
    mode: 'sequential',
    timeout_ms: 120000,
  },
  {
    name: '测试',
    agents: ['tester'],
    mode: 'sequential',
    timeout_ms: 60000,
  },
]
```

### 场景 2: Bug 修复

```typescript
stages: [
  {
    name: '问题诊断',
    agents: ['debugger'],
    mode: 'sequential',
    timeout_ms: 20000,
  },
  {
    name: '制定修复方案',
    agents: ['analyst'],
    mode: 'sequential',
    timeout_ms: 15000,
  },
  {
    name: '实施修复',
    agents: ['developer'],
    mode: 'sequential',
    timeout_ms: 30000,
  },
  {
    name: '验证修复',
    agents: ['tester'],
    mode: 'sequential',
    timeout_ms: 20000,
  },
]
```

### 场景 3: 代码审查

```typescript
stages: [
  {
    name: '并行审查',
    agents: [
      'style_checker',
      'security_checker',
      'performance_checker',
    ],
    mode: 'parallel',
    timeout_ms: 45000,
  },
  {
    name: '生成审查报告',
    agents: ['report_generator'],
    mode: 'sequential',
    timeout_ms: 15000,
  },
]
```

---

## 故障排除

### 问题 1: 工作流总是超时

**原因：** 单个 Agent 的操作时间太长

**解决：**
```typescript
// 增加超时时间
stages: [
  {
    timeout_ms: 120000,  // 增加到 2 分钟
  }
]

// 或者分解大任务为小任务
stages: [
  { agents: ['analyzer_1'], timeout_ms: 30000 },
  { agents: ['analyzer_2'], timeout_ms: 30000 },
  { agents: ['analyzer_3'], timeout_ms: 30000 },
]
```

### 问题 2: Agent 执行失败

**诊断：** 检查错误日志和 Agent 状态

```typescript
const status = agent.getStatus();
console.log(`成功率: ${status.success_rate}`);
console.log(`错误数: ${status.error_count}`);
console.log(`平均耗时: ${status.avg_execution_time_ms}ms`);
```

**解决：** 添加重试逻辑

```typescript
async executeWithRetry(agent, request, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await agent.execute(request);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await this.delay(1000 * Math.pow(2, i)); // 指数退避
    }
  }
}
```

### 问题 3: 内存使用过高

**原因：** Agent 处理过多并发任务

**解决：**
```typescript
// 限制并发任务数
{
  max_concurrent_tasks: 3,  // 从 10 减少到 3
}

// 或者使用任务队列
coordinator.setQueueSize(100);
```

### 问题 4: 工作流结果不一致

**原因：** Agent 间的状态不同步

**解决：** 使用共享状态和锁

```typescript
// 在 ExecutionContext 中使用共享状态
context.shared_state.set('key', value);
const value = context.shared_state.get('key');
```

---

## 总结

这个框架提供了：

✅ **清晰的架构** - 职责分离，易于理解和扩展
✅ **灵活的协作** - 支持并行、顺序和混合执行
✅ **完善的监控** - 详细的性能指标和日志
✅ **可复用的工作流** - 定义一次，重复使用
✅ **强类型支持** - TypeScript 确保安全性

---

## 更多资源

- [最佳实践指南](./AGENT_COLLABORATION_BEST_PRACTICES.md)
- [架构配置](./agent-architecture.json)
- [类型定义](./src/types/agent.ts)
- [示例实现](./src/agents/example-agents.ts)

---

祝你使用 AIFlomo 框架开发愉快！如有问题，欢迎提出建议和反馈。
