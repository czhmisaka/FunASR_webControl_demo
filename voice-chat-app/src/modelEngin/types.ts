/*
 * @Date: 2025-06-04 09:29:09
 * @LastEditors: CZH
 * @LastEditTime: 2025-06-04 09:29:24
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

// 指令负载类型
export interface InstructionPayload {
    tag?: string;
    attrs?: Record<string, string>;
    content?: string;
    selector?: string;
    modifications?: Record<string, any>;
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
