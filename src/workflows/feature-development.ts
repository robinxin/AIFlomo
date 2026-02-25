/**
 * 功能开发工作流示例
 * 展示如何使用 Agent 协作完成一个完整的功能开发周期
 */

import CoordinatorAgent from '../agents/coordinator';
import {
  ExplorerAgent,
  PlannerAgent,
  ExecutorAgent,
  ValidatorAgent,
} from '../agents/example-agents';
import { CollaborationWorkflow } from '../types/agent';

/**
 * 创建功能开发工作流
 */
export function createFeatureDevelopmentWorkflow(): CollaborationWorkflow {
  return {
    id: 'feature_development_v1',
    name: '功能开发工作流',
    description: '完整的功能开发生命周期，包括设计、实现、测试和验证',
    stages: [
      {
        name: '分析与规划阶段',
        description: '并行进行代码分析和方案设计',
        agents: ['explorer', 'planner'],
        mode: 'parallel',
        timeout_ms: 30000,
      },
      {
        name: '实现阶段',
        description: '基于规划结果进行代码实现',
        agents: ['executor'],
        mode: 'sequential',
        timeout_ms: 60000,
      },
      {
        name: '验证阶段',
        description: '对实现结果进行测试和质量检查',
        agents: ['validator'],
        mode: 'sequential',
        timeout_ms: 45000,
      },
    ],
    created_at: new Date().toISOString(),
  };
}

/**
 * 快速 Bug 修复工作流
 */
export function createBugFixWorkflow(): CollaborationWorkflow {
  return {
    id: 'bug_fix_v1',
    name: 'Bug 修复工作流',
    description: '快速定位和修复 Bug',
    stages: [
      {
        name: '问题分析',
        description: '定位 Bug 所在位置',
        agents: ['explorer'],
        mode: 'sequential',
        timeout_ms: 20000,
      },
      {
        name: '方案设计',
        description: '设计修复方案',
        agents: ['planner'],
        mode: 'sequential',
        timeout_ms: 15000,
      },
      {
        name: '实施修复',
        description: '实现修复',
        agents: ['executor'],
        mode: 'sequential',
        timeout_ms: 30000,
      },
      {
        name: '验证修复',
        description: '确认 Bug 已修复',
        agents: ['validator'],
        mode: 'sequential',
        timeout_ms: 25000,
      },
    ],
    created_at: new Date().toISOString(),
  };
}

/**
 * 代码重构工作流
 */
export function createRefactoringWorkflow(): CollaborationWorkflow {
  return {
    id: 'refactoring_v1',
    name: '代码重构工作流',
    description: '优化现有代码的结构和质量',
    stages: [
      {
        name: '现状分析',
        description: '分析现有代码并识别改进机会',
        agents: ['explorer', 'planner'],
        mode: 'parallel',
        timeout_ms: 30000,
      },
      {
        name: '重构实施',
        description: '执行代码重构',
        agents: ['executor'],
        mode: 'sequential',
        timeout_ms: 60000,
      },
      {
        name: '质量验证',
        description: '确保重构不破坏现有功能',
        agents: ['validator'],
        mode: 'sequential',
        timeout_ms: 45000,
      },
    ],
    created_at: new Date().toISOString(),
  };
}

/**
 * 演示协作工作流的执行
 */
export async function demonstrateWorkflow(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('Agent 协作框架 - 功能开发工作流演示');
  console.log('='.repeat(80) + '\n');

  // 创建 Coordinator
  const coordinator = new CoordinatorAgent();
  await coordinator.initialize();

  // 创建并注册 Agent
  const explorer = new ExplorerAgent();
  const planner = new PlannerAgent();
  const executor = new ExecutorAgent();
  const validator = new ValidatorAgent();

  await Promise.all([
    explorer.initialize(),
    planner.initialize(),
    executor.initialize(),
    validator.initialize(),
  ]);

  // 注册 Agent 到 Coordinator
  coordinator.registerAgent({
    id: explorer.metadata.id,
    capabilities: explorer.metadata.capabilities,
    execute: (req) => explorer.execute(req),
    getStatus: () => explorer.getStatus(),
  });

  coordinator.registerAgent({
    id: planner.metadata.id,
    capabilities: planner.metadata.capabilities,
    execute: (req) => planner.execute(req),
    getStatus: () => planner.getStatus(),
  });

  coordinator.registerAgent({
    id: executor.metadata.id,
    capabilities: executor.metadata.capabilities,
    execute: (req) => executor.execute(req),
    getStatus: () => executor.getStatus(),
  });

  coordinator.registerAgent({
    id: validator.metadata.id,
    capabilities: validator.metadata.capabilities,
    execute: (req) => validator.execute(req),
    getStatus: () => validator.getStatus(),
  });

  // 创建并注册工作流
  const workflow = createFeatureDevelopmentWorkflow();
  await coordinator.createWorkflow(workflow);

  // 执行工作流
  const result = await coordinator.executeWorkflow(workflow.id, {
    feature_name: '用户认证系统',
    feature_description: '实现 JWT 认证',
    priority: 'high',
  });

  // 打印结果
  console.log('\n' + '='.repeat(80));
  console.log('工作流执行完成');
  console.log('='.repeat(80));
  console.log(`\n状态: ${result.status.toUpperCase()}`);
  console.log(`总耗时: ${result.total_execution_time_ms}ms`);

  if (result.error) {
    console.log(`错误: ${result.error}`);
  }

  console.log(`\n阶段执行结果:`);
  result.stage_results.forEach((results, stage_name) => {
    console.log(`\n  ${stage_name}:`);
    results.forEach((taskResult) => {
      const status_symbol =
        taskResult.status === 'completed' ? '✓' : '✗';
      console.log(`    ${status_symbol} ${taskResult.agent_id} - ${taskResult.status}`);
      console.log(
        `      耗时: ${taskResult.metadata.execution_time_ms}ms`
      );
    });
  });

  console.log('\n' + '='.repeat(80));
  console.log('Agent 状态统计');
  console.log('='.repeat(80) + '\n');

  const agents = [explorer, planner, executor, validator];
  agents.forEach((agent) => {
    const status = agent.getStatus();
    console.log(`[${agent.metadata.name}]`);
    console.log(`  成功率: ${(status.success_rate * 100).toFixed(2)}%`);
    console.log(`  平均执行时间: ${status.avg_execution_time_ms.toFixed(0)}ms`);
    console.log(`  失败数: ${status.error_count}`);
    console.log();
  });

  // 关闭所有 Agent
  await Promise.all([
    explorer.shutdown(),
    planner.shutdown(),
    executor.shutdown(),
    validator.shutdown(),
    coordinator.shutdown(),
  ]);

  console.log('='.repeat(80));
  console.log('演示完成\n');
}

/**
 * 展示并行执行的优势
 */
export async function demonstrateParallelization(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('并行执行演示 - 对比效率提升');
  console.log('='.repeat(80) + '\n');

  const coordinator = new CoordinatorAgent();
  await coordinator.initialize();

  const explorer = new ExplorerAgent();
  const planner = new PlannerAgent();

  await Promise.all([explorer.initialize(), planner.initialize()]);

  coordinator.registerAgent({
    id: explorer.metadata.id,
    capabilities: explorer.metadata.capabilities,
    execute: (req) => explorer.execute(req),
    getStatus: () => explorer.getStatus(),
  });

  coordinator.registerAgent({
    id: planner.metadata.id,
    capabilities: planner.metadata.capabilities,
    execute: (req) => planner.execute(req),
    getStatus: () => planner.getStatus(),
  });

  // 创建只包含分析与规划阶段的工作流
  const parallelWorkflow: CollaborationWorkflow = {
    id: 'parallel_demo',
    name: '并行执行演示',
    description: '演示 Explorer 和 Planner 并行工作的效率',
    stages: [
      {
        name: '并行分析与规划',
        description: 'Explorer 和 Planner 同时工作',
        agents: ['explorer', 'planner'],
        mode: 'parallel',
        timeout_ms: 30000,
      },
    ],
    created_at: new Date().toISOString(),
  };

  await coordinator.createWorkflow(parallelWorkflow);

  console.log('启动并行执行...\n');
  const startTime = Date.now();

  const result = await coordinator.executeWorkflow(parallelWorkflow.id, {
    task: '分析项目并规划功能实现',
  });

  const parallelTime = Date.now() - startTime;

  console.log(`\n并行执行耗时: ${parallelTime}ms`);
  console.log(
    `理论顺序执行耗时: ~${parallelTime * 2}ms (假设每个 Agent 耗时相同)`
  );
  console.log(`效率提升: ~${(50).toFixed(1)}% 更快`);

  await Promise.all([
    explorer.shutdown(),
    planner.shutdown(),
    coordinator.shutdown(),
  ]);

  console.log('\n' + '='.repeat(80) + '\n');
}
