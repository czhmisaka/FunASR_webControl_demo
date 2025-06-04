/*
 * @Date: 2025-06-04 09:29:09
 * @LastEditors: CZH
 * @LastEditTime: 2025-06-04 13:34:50
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
            executeDirective: (directive: Directive) => string;
        };
    }
}

// 指令负载类型
export interface InstructionPayload {
    tag?: string;
    selector?: string;
    attrs?: Record<string, string | number | boolean>;
    content?: string;
    modifications?: Record<string, any>;
}

// 新增指令类型
export type DOMAction = 'clickElement' | 'setInputValue';
export interface Directive {
    action: DOMAction;
    params: any[];
}

// 消息类型
export interface Message {
    text: string;
    type: string;
    duration?: number;
}

// 消息分组类型
export interface MessageGroup {
    type: string;
    messages: Message[];
}

// 代理模式枚举
export enum AgentMode {
    PLANNING = 'planning',
    ACTION = 'action',
    REVIEW = 'review',
    EVALUATION = 'evaluation'
}

// 模式转换记录
export interface ModeTransition {
    from: AgentMode;
    to: AgentMode;
    timestamp: Date;
    reason: string;
}

// 模型引擎服务接口
export interface ModelEngineService {
    executeModelInstruction(
        instruction: string,
        mode: 'planning' | 'action' | 'review' | 'evaluation',
        modelConfig: ModelConfig
    ): Promise<any>;
}

// 代理接口
export interface IAgent {
    id: string;
    currentMode: AgentMode;
    modeHistory: ModeTransition[];
    transitionMode(newMode: AgentMode, reason: string): void;
    executeTask(task: string): Promise<any>;
}
