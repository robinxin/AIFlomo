/**
 * 基础 Agent 类 - 所有具体 Agent 的基类
 * 提供通用的生命周期管理和通信机制
 */

import {
  IAgent,
  AgentMetadata,
  AgentStatus,
  AgentExecutionRequest,
  AgentExecutionResult,
} from '../types/agent';

export abstract class BaseAgent implements IAgent {
  metadata: AgentMetadata;
  protected status: AgentStatus;
  protected totalExecutionTime: number = 0;
  protected totalTasks: number = 0;
  protected successfulTasks: number = 0;

  constructor(metadata: AgentMetadata) {
    this.metadata = metadata;
    this.status = {
      agent_id: metadata.id,
      is_alive: false,
      current_tasks: 0,
      max_tasks: metadata.max_concurrent_tasks,
      success_rate: 1.0,
      avg_execution_time_ms: 0,
      last_heartbeat: new Date().toISOString(),
      error_count: 0,
    };
  }

  /**
   * 初始化 Agent
   */
  async initialize(): Promise<void> {
    console.log(`[${this.metadata.name}] 初始化...`);
    this.status.is_alive = true;
    this.status.last_heartbeat = new Date().toISOString();
  }

  /**
   * 执行任务的模板方法
   */
  async execute(
    request: AgentExecutionRequest
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    this.status.current_tasks++;
    this.totalTasks++;

    try {
      // 验证能力
      if (!this.canHandle(request.action)) {
        throw new Error(
          `Agent ${this.metadata.id} 不支持操作: ${request.action}`
        );
      }

      // 执行具体的业务逻辑
      const result = await this.handleRequest(request);

      // 更新统计信息
      const executionTime = Date.now() - startTime;
      this.totalExecutionTime += executionTime;
      this.successfulTasks++;
      this.updateMetrics();

      return {
        task_id: request.task_id,
        agent_id: this.metadata.id,
        status: 'completed',
        result,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.status.error_count++;
      this.updateMetrics();

      return {
        task_id: request.task_id,
        agent_id: this.metadata.id,
        status: 'failed',
        result: {},
        error: errorMsg,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    } finally {
      this.status.current_tasks--;
      this.status.last_heartbeat = new Date().toISOString();
    }
  }

  /**
   * 处理请求 - 由子类实现
   */
  protected abstract handleRequest(
    request: AgentExecutionRequest
  ): Promise<Record<string, any>>;

  /**
   * 验证能力
   */
  canHandle(action: string): boolean {
    return this.metadata.capabilities.includes(action);
  }

  /**
   * 更新指标
   */
  protected updateMetrics(): void {
    if (this.totalTasks > 0) {
      this.status.success_rate = this.successfulTasks / this.totalTasks;
      this.status.avg_execution_time_ms =
        this.totalExecutionTime / this.totalTasks;
    }
  }

  /**
   * 获取状态
   */
  getStatus(): AgentStatus {
    return { ...this.status };
  }

  /**
   * 关闭 Agent
   */
  async shutdown(): Promise<void> {
    console.log(`[${this.metadata.name}] 关闭...`);
    this.status.is_alive = false;
  }
}
