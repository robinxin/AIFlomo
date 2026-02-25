/**
 * AIFlomo - Agent 协作框架主程序
 * 演示如何在实际项目中应用 Agent 协作最佳实践
 */

import {
  demonstrateWorkflow,
  demonstrateParallelization,
} from './workflows/feature-development';

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                            ║');
  console.log('║                   AIFlomo - Agent 协作框架演示                            ║');
  console.log('║                                                                            ║');
  console.log('║        这是一个展示 Agent 协作最佳实践的完整框架实现                       ║');
  console.log('║                                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

  try {
    // 演示 1: 完整的功能开发工作流
    console.log('\n【演示 1】完整功能开发工作流');
    console.log('-'.repeat(80));
    await demonstrateWorkflow();

    // 演示 2: 并行执行优势
    console.log('\n【演示 2】并行执行优势演示');
    console.log('-'.repeat(80));
    await demonstrateParallelization();

    // 总结
    printSummary();
  } catch (error) {
    console.error('❌ 执行出错:', error);
    process.exit(1);
  }
}

/**
 * 打印总结
 */
function printSummary(): void {
  console.log('\n' + '═'.repeat(80));
  console.log('Agent 协作最佳实践总结');
  console.log('═'.repeat(80) + '\n');

  const practices = [
    {
      title: '职责分离（Separation of Concerns）',
      description:
        '每个 Agent 都有明确的、单一的职责。Explorer 搜索，Planner 设计，Executor 实现，Validator 验证。',
      benefit: '降低耦合度，提高代码可维护性',
    },
    {
      title: '并行执行',
      description:
        '无依赖的任务可以并行执行，如 Explorer 和 Planner 可以同时工作。',
      benefit: '显著提高系统吞吐量和响应速度',
    },
    {
      title: '清晰的通信契约',
      description:
        '所有 Agent 通过标准的请求/响应格式通信，包括输入、输出、错误处理。',
      benefit: '简化调试，提高系统可预测性',
    },
    {
      title: '结构化的工作流',
      description:
        '通过定义工作流阶段和步骤，使复杂的过程变得可管理和可复用。',
      benefit: '减少重复工作，提高一致性',
    },
    {
      title: '依赖管理',
      description:
        'Coordinator 管理 Agent 之间的依赖关系，确保正确的执行顺序。',
      benefit: '自动处理复杂的任务协调',
    },
    {
      title: '错误处理和恢复',
      description:
        '每个 Agent 都有独立的错误处理机制，Coordinator 可以实现重试和回退。',
      benefit: '提高系统的鲁棒性和可靠性',
    },
  ];

  practices.forEach((practice, index) => {
    console.log(`${index + 1}. ${practice.title}`);
    console.log(`   └─ 描述: ${practice.description}`);
    console.log(`   └─ 优点: ${practice.benefit}\n`);
  });

  console.log('═'.repeat(80));
  console.log('应用建议');
  console.log('═'.repeat(80) + '\n');

  const suggestions = [
    '✓ 设计清晰的 Agent 职责边界，避免功能重叠',
    '✓ 使用标准的消息格式确保 Agent 间的兼容性',
    '✓ 通过工作流定义重复的过程，提高代码复用率',
    '✓ 实现完善的监控和日志记录，便于调试和优化',
    '✓ 为常见场景（如功能开发、Bug 修复）创建预定义的工作流',
    '✓ 定期评估 Agent 的性能，优化瓶颈',
    '✓ 保持 Agent 接口的稳定性，便于扩展',
    '✓ 使用类型系统强制执行通信契约',
  ];

  suggestions.forEach((suggestion) => {
    console.log(suggestion);
  });

  console.log('\n' + '═'.repeat(80));
  console.log('项目结构');
  console.log('═'.repeat(80) + '\n');

  const structure = `
src/
├── agents/
│   ├── base-agent.ts          # Agent 基类
│   ├── coordinator.ts          # Coordinator 实现
│   └── example-agents.ts       # 示例 Agent 实现
├── types/
│   └── agent.ts               # TypeScript 类型定义
├── workflows/
│   └── feature-development.ts # 工作流实现
└── index.ts                   # 主程序

AGENT_COLLABORATION_BEST_PRACTICES.md  # 最佳实践文档
agent-architecture.json                # 架构配置
  `;

  console.log(structure);

  console.log('═'.repeat(80));
  console.log('快速开始');
  console.log('═'.repeat(80) + '\n');

  const quickStart = `
1. 定义 Agent 类，继承 BaseAgent
2. 实现 handleRequest 方法处理具体逻辑
3. 创建 Coordinator 实例
4. 向 Coordinator 注册 Agent
5. 定义工作流（CollaborationWorkflow）
6. 调用 coordinator.executeWorkflow() 执行工作流
  `;

  console.log(quickStart);

  console.log('═'.repeat(80) + '\n');
  console.log('✅ 演示完成！您现在拥有一个完整的 Agent 协作框架。\n');
}

// 运行主函数
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
