/*
 * @Date: 2025-06-09 13:27:39
 * @LastEditors: CZH
 * @LastEditTime: 2025-06-10 04:40:00
 * @FilePath: /AI编程与MCP使用/voice-chat-app/src/pluginSystem/types.ts
 */
/**
 * 插件系统核心类型定义
 */

// 统一插件接口
export interface Plugin {
    name: string;
    version: string;

    // 初始化插件
    init(): Promise<void>;

    // 执行插件功能
    execute(instruction: PluginInstruction): Promise<any>;

    // 获取工具描述（如果是工具插件）
    getTools?(): ToolDescriptor[];

    // 获取资源URI列表（如果提供资源）
    getResources?(): string[];

    // 访问资源（如果提供资源）
    accessResource?(request: ResourceRequest): Promise<ResourceResponse>;
}

// 统一指令格式
export interface PluginInstruction {
    tool: string;       // 工具名称
    parameters: {
        [key: string]: any;
    } // 工具参数
}

// 工具描述规范
export interface ToolDescriptor {
    name: string;
    description: string;
    parameters: {
        name: string;
        type: string;
        description?: string;
        required?: boolean;
    }[];
}

// DOM操作类型
export enum DOMOperation {
    CREATE = 'createElement',
    MODIFY = 'modifyElement',
    DELETE = 'deleteElement',
    QUERY = 'queryElements'
}

// 资源访问请求
export interface ResourceRequest {
    uri: string;        // 资源标识符
    params?: any;       // 访问参数
}

// 资源访问响应
export interface ResourceResponse {
    status: 'success' | 'error';
    data?: any;
    error?: string;
}
