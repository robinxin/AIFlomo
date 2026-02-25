/**
 * Agent Collaboration Framework - Type Definitions
 * 定义所有 Agent 协作的数据类型和接口
 */

// ============= 基础类型 =============

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export type ExecutionMode = 'sequential' | 'parallel';
export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type AgentCapability = string;

// ============= Task 相关类型 =============

/**
 * 任务定义
 */
export interface Task {
  id: string;
  name: string;
  description?: string;
  type: string; // 任务类型：feature, bugfix, refactor 等
  priority: Priority;
  input: Record<string, any>;
  dependencies: string[]; // 依赖的任务 ID
  timeout_ms: number;
  created_at: string;
  updated_at: string;
  status: TaskStatus;
  assigned_to?: string; // 分配给的 Agent ID
}

/**
 * 任务执行结果
 */
export interface TaskResult {
  task_id: string;
  agent_id: string;
  status: TaskStatus;
  result: Record<string, any>;
  error?: string;
  metadata: {
    execution_time_ms: number;
    timestamp: string;
    retries: number;
  };
}

/**
 * 任务依赖图
 */
export interface TaskDependencyGraph {
  tasks: Map<string, Task>;
  dependencies: Map<string, string[]>; // task_id -> [dependent_task_ids]
  reverse_dependencies: Map<string, string[]>; // task_id -> [prerequisite_task_ids]
}

// ============= Agent 相关类型 =============

/**
 * Agent 元数据
 */
export interface AgentMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  capabilities: AgentCapability[];
  max_concurrent_tasks: number;
  timeout_ms: number;
  dependencies: string[]; // 依赖的其他 Agent ID
}

/**
 * Agent 状态
 */
export interface AgentStatus {
  agent_id: string;
  is_alive: boolean;
  current_tasks: number;
  max_tasks: number;
  success_rate: number;
  avg_execution_time_ms: number;
  last_heartbeat: string;
  error_count: number;
}

/**
 * Agent 执行请求
 */
export interface AgentExecutionRequest {
  task_id: string;
  agent_id: string;
  action: string;
  input: Record<string, any>;
  context: ExecutionContext;
  priority: Priority;
  timeout_ms: number;
  retry_count?: number;
}

/**
 * Agent 执行结果
 */
export interface AgentExecutionResult {
  task_id: string;
  agent_id: string;
  status: TaskStatus;
  result: Record<string, any>;
  error?: string;
  execution_time_ms: number;
  timestamp: string;
}

/**
 * Agent 接口 - 所有 Agent 必须实现
 */
export interface IAgent {
  metadata: AgentMetadata;
  status: AgentStatus;

  /**
   * 初始化 Agent
   */
  initialize(): Promise<void>;

  /**
   * 执行任务
   */
  execute(request: AgentExecutionRequest): Promise<AgentExecutionResult>;

  /**
   * 验证能力
   */
  canHandle(action: string): boolean;

  /**
   * 获取当前状态
   */
  getStatus(): AgentStatus;

  /**
   * 关闭 Agent
   */
  shutdown(): Promise<void>;
}

// ============= 执行上下文 =============

/**
 * 执行上下文 - 包含执行一个任务所需的所有信息
 */
export interface ExecutionContext {
  workspace_path: string;
  project_root: string;
  shared_state: SharedState;
  project_context: ProjectContext;
  logger: Logger;
  event_bus: EventBus;
}

/**
 * 共享状态 - 所有 Agent 可以访问的状态
 */
export interface SharedState {
  // 项目级别的信息
  project_meta: Record<string, any>;

  // 缓存数据
  cache: Map<string, any>;

  // 已完成的任务结果
  completed_tasks: Map<string, TaskResult>;

  // 全局变量
  variables: Map<string, any>;

  // 添加数据
  set(key: string, value: any): void;
  get(key: string): any;
  has(key: string): boolean;
  delete(key: string): void;
  clear(): void;
}

/**
 * 项目上下文
 */
export interface ProjectContext {
  name: string;
  root_path: string;
  language: string;
  framework?: string;
  metadata: Record<string, any>;
}

// ============= 协作器 =============

/**
 * 协作阶段定义
 */
export interface CollaborationStage {
  name: string;
  description: string;
  agents: string[]; // Agent IDs
  mode: ExecutionMode; // sequential or parallel
  timeout_ms: number;
}

/**
 * 协作工作流
 */
export interface CollaborationWorkflow {
  id: string;
  name: string;
  description: string;
  stages: CollaborationStage[];
  created_at: string;
}

/**
 * Coordinator Agent 的接口
 */
export interface ICoordinator extends IAgent {
  /**
   * 创建工作流
   */
  createWorkflow(workflow: CollaborationWorkflow): Promise<void>;

  /**
   * 执行工作流
   */
  executeWorkflow(
    workflow_id: string,
    input: Record<string, any>
  ): Promise<WorkflowResult>;

  /**
   * 获取任务依赖图
   */
  getTaskDependencyGraph(task_ids: string[]): TaskDependencyGraph;

  /**
   * 优化执行计划
   */
  optimizeExecutionPlan(graph: TaskDependencyGraph): ExecutionPlan;
}

/**
 * 执行计划
 */
export interface ExecutionPlan {
  stages: ExecutionStage[];
  estimated_time_ms: number;
  parallelization_factor: number;
}

/**
 * 执行阶段
 */
export interface ExecutionStage {
  stage_number: number;
  mode: ExecutionMode;
  tasks: string[]; // Task IDs
  timeout_ms: number;
}

/**
 * 工作流执行结果
 */
export interface WorkflowResult {
  workflow_id: string;
  status: TaskStatus;
  overall_result: Record<string, any>;
  stage_results: Map<string, TaskResult[]>;
  total_execution_time_ms: number;
  error?: string;
}

// ============= 日志和事件 =============

/**
 * 日志接口
 */
export interface Logger {
  debug(message: string, metadata?: Record<string, any>): void;
  info(message: string, metadata?: Record<string, any>): void;
  warn(message: string, metadata?: Record<string, any>): void;
  error(message: string, error?: Error, metadata?: Record<string, any>): void;
}

/**
 * 事件总线
 */
export interface EventBus {
  on(event: string, handler: (data: any) => void): void;
  off(event: string, handler: (data: any) => void): void;
  emit(event: string, data: any): void;
}

/**
 * 事件类型
 */
export enum AgentEvent {
  AGENT_STARTED = 'agent:started',
  AGENT_STOPPED = 'agent:stopped',
  TASK_STARTED = 'task:started',
  TASK_COMPLETED = 'task:completed',
  TASK_FAILED = 'task:failed',
  WORKFLOW_STARTED = 'workflow:started',
  WORKFLOW_COMPLETED = 'workflow:completed',
  ERROR_OCCURRED = 'error:occurred',
}

// ============= 监控和指标 =============

/**
 * Agent 性能指标
 */
export interface AgentMetrics {
  agent_id: string;
  total_tasks: number;
  successful_tasks: number;
  failed_tasks: number;
  success_rate: number;
  avg_execution_time_ms: number;
  min_execution_time_ms: number;
  max_execution_time_ms: number;
  total_execution_time_ms: number;
  last_updated: string;
}

/**
 * 系统性能指标
 */
export interface SystemMetrics {
  total_tasks_processed: number;
  total_workflows_completed: number;
  system_uptime_ms: number;
  avg_workflow_time_ms: number;
  system_success_rate: number;
  agent_metrics: AgentMetrics[];
  timestamp: string;
}
