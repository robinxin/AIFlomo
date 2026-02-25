/**
 * Coordinator Agent - 任务编排和流程管理
 * 负责：
 * 1. 任务调度和 Agent 分配
 * 2. 依赖关系分析和执行计划优化
 * 3. 并行和顺序执行的管理
 * 4. 错误处理和重试
 * 5. 结果汇总
 */

import {
  ICoordinator,
  AgentMetadata,
  AgentStatus,
  Task,
  TaskStatus,
  AgentExecutionRequest,
  AgentExecutionResult,
  ExecutionContext,
  CollaborationWorkflow,
  WorkflowResult,
  TaskDependencyGraph,
  ExecutionPlan,
  ExecutionMode,
  TaskResult,
} from '../types/agent';

interface RegistrationAgent {
  id: string;
  capabilities: string[];
  execute: (req: AgentExecutionRequest) => Promise<AgentExecutionResult>;
  getStatus: () => AgentStatus;
}

export class CoordinatorAgent implements ICoordinator {
  metadata: AgentMetadata;
  status: AgentStatus;
  private registeredAgents: Map<string, RegistrationAgent> = new Map();
  private workflows: Map<string, CollaborationWorkflow> = new Map();
  private executingTasks: Map<string, Promise<TaskResult>> = new Map();
  private taskResults: Map<string, TaskResult> = new Map();

  constructor() {
    this.metadata = {
      id: 'coordinator',
      name: 'Coordinator Agent',
      description: '负责任务编排和流程管理的协调器',
      version: '1.0.0',
      capabilities: [
        'task_scheduling',
        'resource_allocation',
        'progress_tracking',
        'result_aggregation',
        'error_handling',
      ],
      max_concurrent_tasks: 20,
      timeout_ms: 120000,
      dependencies: [],
    };

    this.status = {
      agent_id: 'coordinator',
      is_alive: false,
      current_tasks: 0,
      max_tasks: this.metadata.max_concurrent_tasks,
      success_rate: 1.0,
      avg_execution_time_ms: 0,
      last_heartbeat: new Date().toISOString(),
      error_count: 0,
    };
  }

  /**
   * 初始化 Coordinator
   */
  async initialize(): Promise<void> {
    console.log('[Coordinator] 初始化协调器...');
    this.status.is_alive = true;
    this.status.last_heartbeat = new Date().toISOString();
  }

  /**
   * 注册 Agent
   */
  registerAgent(agent: RegistrationAgent): void {
    if (this.registeredAgents.has(agent.id)) {
      throw new Error(`Agent ${agent.id} 已被注册`);
    }
    this.registeredAgents.set(agent.id, agent);
    console.log(`[Coordinator] 已注册 Agent: ${agent.id}`);
  }

  /**
   * 创建工作流
   */
  async createWorkflow(workflow: CollaborationWorkflow): Promise<void> {
    this.workflows.set(workflow.id, workflow);
    console.log(`[Coordinator] 创建工作流: ${workflow.name}`);
  }

  /**
   * 执行工作流
   */
  async executeWorkflow(
    workflow_id: string,
    input: Record<string, any>
  ): Promise<WorkflowResult> {
    const workflow = this.workflows.get(workflow_id);
    if (!workflow) {
      throw new Error(`工作流 ${workflow_id} 不存在`);
    }

    console.log(`\n[Coordinator] 开始执行工作流: ${workflow.name}`);
    console.log(`[Coordinator] 工作流包含 ${workflow.stages.length} 个阶段\n`);

    const startTime = Date.now();
    const stageResults = new Map<string, TaskResult[]>();
    let overallError: string | undefined;

    try {
      // 执行每个阶段
      for (const stage of workflow.stages) {
        console.log(`\n  ▶ 执行阶段: ${stage.name} (${stage.mode} 模式)`);
        console.log(`    涉及 Agent: ${stage.agents.join(', ')}`);

        try {
          const results = await this.executeStage(stage, input);
          stageResults.set(stage.name, results);

          // 更新输入上下文，供后续阶段使用
          input = {
            ...input,
            previous_stage_results: results,
          };

          console.log(`  ✓ 阶段 ${stage.name} 执行完成`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`  ✗ 阶段 ${stage.name} 执行失败: ${errorMsg}`);
          overallError = errorMsg;
          break;
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      overallError = errorMsg;
    }

    const executionTime = Date.now() - startTime;

    const result: WorkflowResult = {
      workflow_id,
      status: overallError ? 'failed' : 'completed',
      overall_result: input,
      stage_results: stageResults,
      total_execution_time_ms: executionTime,
      error: overallError,
    };

    console.log(`\n[Coordinator] 工作流执行完成`);
    console.log(`  状态: ${result.status.toUpperCase()}`);
    console.log(`  总耗时: ${executionTime}ms\n`);

    return result;
  }

  /**
   * 执行单个阶段
   */
  private async executeStage(
    stage: any,
    input: Record<string, any>
  ): Promise<TaskResult[]> {
    const results: TaskResult[] = [];

    if (stage.mode === 'parallel') {
      // 并行执行多个 Agent
      const promises = stage.agents.map((agent_id: string) =>
        this.executeAgentTask(agent_id, 'process', input, stage.timeout_ms)
      );
      const parallelResults = await Promise.all(promises);
      results.push(...parallelResults);
    } else {
      // 顺序执行 Agent
      for (const agent_id of stage.agents) {
        const result = await this.executeAgentTask(
          agent_id,
          'process',
          input,
          stage.timeout_ms
        );
        results.push(result);

        if (result.status === 'failed') {
          throw new Error(`Agent ${agent_id} 执行失败: ${result.error}`);
        }
      }
    }

    return results;
  }

  /**
   * 执行 Agent 任务
   */
  private async executeAgentTask(
    agent_id: string,
    action: string,
    input: Record<string, any>,
    timeout: number
  ): Promise<TaskResult> {
    const agent = this.registeredAgents.get(agent_id);
    if (!agent) {
      throw new Error(`Agent ${agent_id} 未注册`);
    }

    const request: AgentExecutionRequest = {
      task_id: `task_${Date.now()}_${Math.random()}`,
      agent_id,
      action,
      input,
      context: this.createExecutionContext(),
      priority: 'high',
      timeout_ms: timeout,
    };

    try {
      console.log(`    → 执行 Agent: ${agent_id}`);
      const agentResult = await agent.execute(request);
      const taskResult: TaskResult = {
        task_id: request.task_id,
        agent_id,
        status: agentResult.status as TaskStatus,
        result: agentResult.result,
        error: agentResult.error,
        metadata: {
          execution_time_ms: agentResult.execution_time_ms,
          timestamp: agentResult.timestamp,
          retries: 0,
        },
      };
      this.taskResults.set(request.task_id, taskResult);
      console.log(
        `    ✓ ${agent_id} 完成 (${agentResult.execution_time_ms}ms)`
      );
      return taskResult;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`    ✗ ${agent_id} 失败: ${errorMsg}`);
      return {
        task_id: request.task_id,
        agent_id,
        status: 'failed',
        result: {},
        error: errorMsg,
        metadata: {
          execution_time_ms: 0,
          timestamp: new Date().toISOString(),
          retries: 0,
        },
      };
    }
  }

  /**
   * 创建执行上下文
   */
  private createExecutionContext(): ExecutionContext {
    return {
      workspace_path: process.cwd(),
      project_root: process.cwd(),
      shared_state: {
        project_meta: {},
        cache: new Map(),
        completed_tasks: new Map(this.taskResults),
        variables: new Map(),
        set: (key: string, value: any) => {},
        get: (key: string) => undefined,
        has: (key: string) => false,
        delete: (key: string) => {},
        clear: () => {},
      },
      project_context: {
        name: 'AIFlomo',
        root_path: process.cwd(),
        language: 'typescript',
        metadata: {},
      },
      logger: {
        debug: (msg: string) => console.debug(`[DEBUG] ${msg}`),
        info: (msg: string) => console.log(`[INFO] ${msg}`),
        warn: (msg: string) => console.warn(`[WARN] ${msg}`),
        error: (msg: string) => console.error(`[ERROR] ${msg}`),
      },
      event_bus: {
        on: () => {},
        off: () => {},
        emit: () => {},
      },
    };
  }

  /**
   * 获取任务依赖图
   */
  getTaskDependencyGraph(task_ids: string[]): TaskDependencyGraph {
    return {
      tasks: new Map(),
      dependencies: new Map(),
      reverse_dependencies: new Map(),
    };
  }

  /**
   * 优化执行计划
   */
  optimizeExecutionPlan(graph: TaskDependencyGraph): ExecutionPlan {
    return {
      stages: [],
      estimated_time_ms: 0,
      parallelization_factor: 1,
    };
  }

  /**
   * 执行任务（必需的接口方法）
   */
  async execute(
    request: AgentExecutionRequest
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    try {
      // Coordinator 通过其他方法处理任务
      return {
        task_id: request.task_id,
        agent_id: 'coordinator',
        status: 'completed',
        result: {},
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        task_id: request.task_id,
        agent_id: 'coordinator',
        status: 'failed',
        result: {},
        error: String(error),
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 验证能力
   */
  canHandle(action: string): boolean {
    return this.metadata.capabilities.includes(action);
  }

  /**
   * 获取状态
   */
  getStatus(): AgentStatus {
    this.status.last_heartbeat = new Date().toISOString();
    this.status.current_tasks = this.executingTasks.size;
    return { ...this.status };
  }

  /**
   * 关闭
   */
  async shutdown(): Promise<void> {
    console.log('[Coordinator] 关闭协调器...');
    this.status.is_alive = false;
    this.registeredAgents.clear();
    this.workflows.clear();
    this.executingTasks.clear();
  }
}

export default CoordinatorAgent;
