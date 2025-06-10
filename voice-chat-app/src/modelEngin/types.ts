/*
 * @Date: 2025-06-04 09:29:09
 * @LastEditors: CZH
 * @LastEditTime: 2025-06-10 23:40:08
 * @FilePath: /AI编程与MCP使用/voice-chat-app/src/modelEngin/types.ts
 */
/**
 * 模型引擎核心类型定义
 */

// 模型配置类型
export interface ModelConfig {
    url: string;
    model: string;
    apiKey: string;
}

// 扩展全局Window接口
declare global {
    interface Window {
        __directiveAPI: {
            executeDirective: (directive: Directive) => Promise<string>;
        };
    }
}

// === 新增：结构化任务类型 ===
export interface Task {
    task_id: string;
    intent: string;
    params: Record<string, any>;
    priority: 'low' | 'medium' | 'high';
    deadline?: string;
    subtasks?: Subtask[];
}

export interface Subtask {
    subtask_id: string;
    description: string;
    required_capabilities: string[];
    input_data?: any;
    output_format: string;
    timeout?: number;
    resource_limits?: {
        cpu?: number;
        memory?: number;
    };
}

// === 新增：状态机类型 ===
export interface StateTransition {
    state: string;
    time: Date;
    transition_reason: string;
}

// 新增任务定义类型
export interface TaskDefinition {
    id: string;
    priority: 'high' | 'medium' | 'low';
    retryCount: number;
    dependsOn?: string[];
    execute: () => Promise<any>;
}

export interface StateMachine {
    current_state: string;
    state_history: StateTransition[];
}

// === 新增：工具调度器类型 ===
export interface ToolExecutionResult {
    status: 'success' | 'error' | 'forbidden';
    result?: any;
    message?: string;
    suggestion?: string; // 添加错误分析建议
}

// === 新增：Agent 能力扩展 ===
export interface AgentCapabilities {
    planning: boolean;
    action: boolean;
    review: boolean;
    evaluation: boolean;
    [key: string]: boolean;
}

// 指令负载类型
export interface InstructionPayload {
    tagName?: string;
    selector?: string;
    attributes?: Record<string, string | number | boolean>;
    textContent?: string;
    target?: string; // 目标元素的选择器或ID
    style?: { [key: string]: any }

}

// 新增指令类型
export type DOMAction = 'clickElement' | 'setInputValue';
export interface ToolDescriptor {
    name: string;
    description: string;
    parameters: { name: string; type: string }[];
}

export interface Directive {
    action: DOMAction;
    params: any[];
    descriptor?: ToolDescriptor;
}

// 消息类型
export interface Message {
    text: string;
    type: MessageType;
    duration?: number;
    meta?: any; // 用于存储代理消息的元数据
    timestamp: number; // 添加时间戳字段用于排序
}

// 消息类型定义
export type MessageType = 'user' | 'ai' | 'info' | 'error' | 'success' | 'agent-planning' | 'agent-action' | 'agent-result' | 'agent-state' | 'warning' | 'combined';

// 消息分组类型
export interface MessageGroup {
    type: MessageType;
    messages: Message[];
}

// 系统模式枚举（统一代理模式和状态机状态）
export enum SystemMode {
    PLANNING = 'planning',
    ACTION = 'action',
    REVIEW = 'review',
    COMPLETE = 'complete' // 移除EVALUATION
}

// 统一代理响应格式
export interface UnifiedAgentResponse {
    mode: SystemMode;
    agentId: string;
    taskId?: string;
    result: {
        status: 'success' | 'partial' | 'error';
        data: any; // 模式特定数据
    };
    nextActions?: string[];
    progress?: number; // 0-100
}

// 模式决策接口
export interface ModeDecision {
    next_mode: SystemMode;
    reason: string; // 转换原因
    expected_actions: string[]; // 预期下一步动作
}

// 代理模式枚举（兼容旧版）
export enum AgentMode {
    PLANNING = 'planning',
    ACTION = 'action',
    REVIEW = 'review',
    EVALUATION = 'evaluation'
}

// 模式转换记录
export interface ModeTransition {
    from: SystemMode;
    to: SystemMode;
    timestamp: Date;
    reason: string;
}

// 模型引擎服务接口
export interface ModelEngineService {
    judgeUserInput(
        input: string,
        requirement: string
    ): Promise<boolean>; // 修改为返回 boolean
    executeModelInstruction(
        instruction: string,
        mode: 'planning' | 'action' | 'review' | 'evaluation',
        modelConfig: ModelConfig
    ): Promise<any>;
    getModelConfig(): ModelConfig;
    pushAgentMessage(text: string, type: MessageType, meta?: any): void;
    getAgentMessages(): Message[];
    updateModelConfig(config: ModelConfig): void;
}

// 代理接口
export interface IAgent {
    id: string;
    currentMode: SystemMode;
    modeHistory: ModeTransition[];
    transitionMode(newMode: SystemMode, reason: string): void;
    executeTask(task: string): Promise<UnifiedAgentResponse>;
    terminate(): void;
}
