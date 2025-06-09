/*
 * @Date: 2025-06-09 13:34:32
 * @LastEditors: CZH
 * @LastEditTime: 2025-06-09 13:34:53
 * @FilePath: /AI编程与MCP使用/voice-chat-app/src/pluginSystem/toolPlugin.ts
 */
import type { Plugin, PluginInstruction, ToolDescriptor } from './types';
import { ToolScheduler } from '../modelEngin/toolScheduler';

/**
 * 工具调度插件
 */
export class ToolPlugin implements Plugin {
    name = 'tool-plugin';
    version = '1.0.0';
    private scheduler: ToolScheduler;

    constructor() {
        this.scheduler = new ToolScheduler();
    }

    async init() {
        console.log('工具插件初始化');
    }

    async execute(instruction: PluginInstruction): Promise<any> {
        if (instruction.type !== 'tool/execute') {
            throw new Error(`不支持的工具操作类型: ${instruction.type}`);
        }

        const { toolName, params, agentId } = instruction.payload;
        return this.scheduler.executeTool(toolName, params, agentId);
    }

    getTools(): ToolDescriptor[] {
        // 工具插件本身不提供具体工具，只提供调度能力
        return [];
    }

    /**
     * 注册新工具
     * @param toolId 工具ID
     * @param toolInstance 工具实例
     */
    registerTool(toolId: string, toolInstance: any): void {
        this.scheduler.registerTool(toolId, toolInstance);
    }

    /**
     * 添加新任务
     * @param task 任务定义
     */
    addTask(task: any): void {
        this.scheduler.addTask(task);
    }

    /**
     * 启动任务处理
     */
    startProcessing(): void {
        this.scheduler.startProcessing();
    }

    /**
     * 停止任务处理
     */
    stopProcessing(): void {
        this.scheduler.stopProcessing();
    }
}

// 导出插件实例
export const toolPlugin = new ToolPlugin();
