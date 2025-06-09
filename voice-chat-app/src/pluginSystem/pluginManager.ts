/*
 * @Date: 2025-06-09 13:37:11
 * @LastEditors: CZH
 * @LastEditTime: 2025-06-09 13:37:40
 * @FilePath: /AI编程与MCP使用/voice-chat-app/src/pluginSystem/pluginManager.ts
 */
import type { Plugin, PluginInstruction, ToolDescriptor, ResourceRequest, ResourceResponse } from './types';

/**
 * 插件管理器
 */
export class PluginManager {
    private plugins: Record<string, Plugin> = {};

    /**
     * 注册插件
     * @param plugin 插件实例
     */
    registerPlugin(plugin: Plugin): void {
        if (this.plugins[plugin.name]) {
            console.warn(`覆盖已存在的插件: ${plugin.name}`);
        }
        this.plugins[plugin.name] = plugin;
        console.log(`插件已注册: ${plugin.name}@${plugin.version}`);
    }

    /**
     * 初始化所有插件
     */
    async initPlugins(): Promise<void> {
        for (const plugin of Object.values(this.plugins)) {
            try {
                await plugin.init();
                console.log(`插件初始化成功: ${plugin.name}`);
            } catch (error) {
                console.error(`插件初始化失败: ${plugin.name}`, error);
            }
        }
    }

    /**
     * 执行指令
     * @param instruction 插件指令
     */
    async executeInstruction(instruction: PluginInstruction): Promise<any> {
        const [namespace] = instruction.type.split('/');
        const pluginName = `${namespace}-plugin`;

        const plugin = this.plugins[pluginName];
        if (!plugin) {
            throw new Error(`找不到处理 ${instruction.type} 指令的插件`);
        }

        return plugin.execute(instruction);
    }

    /**
     * 获取所有可用工具
     */
    async getAllTools(): Promise<ToolDescriptor[]> {
        const tools: ToolDescriptor[] = [];
        for (const plugin of Object.values(this.plugins)) {
            if (plugin.getTools) {
                try {
                    tools.push(...await plugin.getTools());
                } catch (error) {
                    console.error(`获取工具失败: ${plugin.name}`, error);
                }
            }
        }
        return tools;
    }

    /**
     * 访问资源
     * @param request 资源请求
     */
    async accessResource(request: ResourceRequest): Promise<ResourceResponse> {
        const [pluginName] = request.uri.split('/');
        const fullPluginName = `${pluginName}-plugin`;

        const plugin = this.plugins[fullPluginName];
        if (!plugin || !plugin.accessResource) {
            return {
                status: 'error',
                error: `找不到提供资源 ${request.uri} 的插件`
            };
        }

        return plugin.accessResource(request);
    }
}

// 创建并导出默认插件管理器实例
export const pluginManager = new PluginManager();
