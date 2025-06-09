import axios from "axios";
import type { ModelConfig, Message, MessageType } from "./types";
import { Supervisor } from './supervisor';
import { queryElement } from "./domOperations";
import { roleTypes } from "element-plus";
import { ToolScheduler } from "./toolScheduler";
import { StateMachineEngine } from "./stateMachine";

/**
 * 模型引擎服务类
 */
export class ModelEngineService {
    public readonly supervisor: Supervisor;
    private modelConfig: ModelConfig;
    private agentMessages: Message[] = []; // 存储代理消息
    private toolScheduler: ToolScheduler;
    private stateMachine: StateMachineEngine;

    constructor() {
        // 使用默认配置初始化
        this.modelConfig = {
            model: "qwen/qwen3-8b",
            apiKey: '',
            url: "http://127.0.0.1:1234/v1/chat/completions",
        };
        this.supervisor = new Supervisor(this, this.modelConfig);
        this.toolScheduler = new ToolScheduler();
        this.stateMachine = new StateMachineEngine(this, this.modelConfig);

        // 注册示例工具
        this.registerTool('calculator', {
            description: '执行数学计算',
            parameters: {
                expression: '数学表达式，例如：1+2'
            },
            handler: async ({ expression }) => {
                try {
                    // 安全评估数学表达式
                    const safeEval = (expr: string) => {
                        return Function(`'use strict'; return (${expr})`)();
                    };
                    return safeEval(expression);
                } catch (error) {
                    if (error instanceof Error) {
                        return `计算错误: ${error.message}`;
                    } else {
                        return `计算错误: 未知错误`;
                    }
                }
            }
        });
    }

    /**
     * 终止所有任务
     */
    public terminateTask() {
        // 终止所有进行中的任务
        this.toolScheduler.terminateAll();
        // 终止监督器任务循环
        this.supervisor.terminate();

        // 更新状态机到终止状态
        this.stateMachine.setNextState('terminated', '用户强制终止任务');

        console.log('所有任务已被强制终止');
    }

    /**
     * MCP 工具适配器
     */
    static MCPAdapter = class {
        /**
         * 注册 MCP 工具
         * @param serverName MCP 服务器名称
         * @param toolName 工具名称
         * @param description 工具描述
         */
        static registerMCPTool(
            serverName: string,
            toolName: string,
            description: string
        ) {
            modelEngineService.registerTool(`mcp:${serverName}/${toolName}`, {
                description: `MCP工具: ${description}`,
                parameters: { type: "object" },
                handler: async (params: any) => {
                    return await this.executeMCPCommand(serverName, toolName, params);
                }
            });
        }

        /**
         * 执行 MCP 命令
         */
        private static async executeMCPCommand(server: string, tool: string, args: object) {
            try {
                // 这里实际会调用 MCP 服务
                console.log(`[MCP调用] ${server}/${tool}`, args);
                return { success: true, data: "MCP调用结果占位符" };
            } catch (error: any) {
                return {
                    success: false,
                    error: `MCP调用失败: ${error.message}`,
                    details: error.response?.data
                };
            }
        }
    }

    /**
     * 推送代理消息
     * @param text 消息文本
     * @param type 消息类型
     * @param meta 元数据
     */
    public pushAgentMessage(text: string, type: MessageType, meta?: any) {
        const newMessage: Message = {
            text,
            type,
            meta
        };
        this.agentMessages.push(newMessage);
        console.log(`[消息推送] 类型:${type}, 内容:${text.substring(0, 50)}...`);
        // 触发事件通知（确保前端能接收到更新）
        window.dispatchEvent(new CustomEvent('agent-message', { detail: newMessage }));
    }

    /**
     * 获取所有代理消息
     */
    public getAgentMessages(): Message[] {
        return [...this.agentMessages];
    }


    // 模式专用提示词
    private toolRegistry: Record<string, {
        description: string;
        parameters?: object;
        handler: (args: any) => Promise<any>;
    }> = {};

    private readonly basePowerPrompts = `
你是一个综合智能体，你具备 planning 、action 、review 三种模式。
不同模式的简介：
planning：根据用户输入进行任务规划，分析并生成下一步的任务指令供 action 执行。
action：具备如下能力<${Object.keys(this.toolRegistry).join(', ')
        }>。
review：检查任务执行结果，在review模式中，你能查看到当前页面的所有元素。可以判断运行结果，若判断任务为能完成，可以通过指令输出修改建议。只需要输出下一步建议即可，不需要输出其他内容。
`


    /**
     * 注册新工具
     * @param name 工具名称
     * @param config 工具配置
     */
    public registerTool(name: string, config: {
        description: string;
        parameters?: object;
        handler: (args: any) => Promise<any>;
    }) {
        this.toolRegistry[name] = config;
        console.log(`[工具注册] ${name}: ${config.description}`);
    }

    /**
     * 获取动态动作提示词
     */
    private getDynamicActionPrompt(): string {
        let toolSection = '';

        // 添加 DOM 操作说明
        const basePrompt = `
        ${this.basePowerPrompts}
        当前处于 action 模式
        
        请严格按照以下 JSON 格式输出操作指令：
        {
          "type": "操作类型", // 可选值：${this.toolRegistry}}
          ... // 根据类型变化的字段
        }
        `;

        // 添加工具调用说明
        if (Object.keys(this.toolRegistry).length > 0) {
            toolSection += '\n\n## 可用工具：\n';
            Object.entries(this.toolRegistry).forEach(([name, tool]) => {
                toolSection += `- **${name}**: ${tool.description}\n`;
                if (tool.parameters) {
                    toolSection += `  参数格式: ${JSON.stringify(tool.parameters)}\n`;
                }
            });

            toolSection += `
            \n## 工具调用格式：
            {
              "type": "tool_call",
              "tool": "工具名称",
              "parameters": {
                // 工具特定参数
              }
            }`;
        }

        return basePrompt + toolSection;
    }

    private readonly modePrompts = {
        planning: (userinput?: string) => `
${this.basePowerPrompts}
当前处于planning，模式
当前用户的要求是：${userinput}
        `,
        action: () => this.getDynamicActionPrompt(),
        review: () => `当前处于 review 模式你会在审查模式中检查任务执行结果。请根据当前页面的元素状态和任务要求，判断任务是否完成。若任务没有完成，则给出下一步建议。`
    };

    /**
     * 处理用户目标输入
     * @param goal 用户目标
     */
    async executeUserGoal(goal: string, that: any): Promise<void> {
        await this.supervisor.executeGoal(goal);
    }

    /**
     * 简单判断用户的输入是否符合要求
     * @param input 用户输入
     * @param requirement 判断条件
     * @returns 是否符合条件
     */
    async judgeUserInput(input: string, requirement: string): Promise<boolean> {
        try {
            const response = await this.sendModelRequest([
                {
                    role: "system",
                    content: `你是一个判断专家，判断条件是
                    ${requirement}
                    。请根据要求进行判断。只输出 是 或者 否 ,不要输出其他任何思考内容。`
                },
                {
                    role: "user",
                    content: input + '/no_think'
                }
            ], this.modelConfig);
            console.log('用户输入判断结果:', response, input, requirement);
            return response.indexOf("是") > -1;
        } catch (error: any) {
            console.error('用户输入判断失败:', error);
            return false;
        }
    }

    /**
     * 更新模型配置
     * @param config 新模型配置
     */
    updateModelConfig(config: ModelConfig): void {
        this.modelConfig = config;
    }

    /**
     * 获取当前模型配置
     */
    public getModelConfig(): ModelConfig {
        return this.modelConfig;
    }

    /**
     * 发送模型请求 (公共逻辑)
     */
    private async sendModelRequest(messages: any[], modelConfig: ModelConfig): Promise<any> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (modelConfig.apiKey) {
            headers["Authorization"] = `Bearer ${modelConfig.apiKey}`;
        }
        console.log('调用大模型 - 模型发送信息', `${messages.map(x => x.content).join('\n')}`)

        const response = await axios.post(
            modelConfig.url,
            {
                model: modelConfig.model,
                messages,
                temperature: 0.7,
                stream: false,
            },
            { headers }
        );
        console.log('调用大模型 - 模型响应', response.data.choices[0].message.content.replace("```json", "")
            .replace("```", "")
            .trim());
        return response.data.choices[0].message.content
            .replace("```json", "")
            .replace("```", "")
            .trim();
    }

    /**
     * 执行规划指令
     */
    async executePlanningInstruction(instruction: string, modelConfig: ModelConfig): Promise<any> {
        try {
            console.log('执行规划指令:', instruction, 'ads');
            const testList = instruction.split(':::');
            return await this.sendModelRequest([
                {
                    role: "system",
                    content: this.modePrompts.planning(instruction)
                },
                {
                    role: 'user',
                    content: `当前页面元素列表：\n${queryElement(document.getElementById('model-instructions') as any)}`,
                }, {
                    role: "user",
                    content: '上一步操作的评价为：【' + testList[0] + "】"
                },
                {
                    role: "user",
                    content: '最终目标为：【' + testList[1] + "】"
                },
                {
                    role: 'user',
                    content: `
                        操作指令应当是一句话，例如：
                        1. 创建一个xx色的（方块？圆角矩形？园？都可以），大小为 xxx 像素，使用绝对定位，left:xxx top:xxx，字体颜色为xxx
                        2. 修改元素 xxx(通常是某个id选择器) 的属性，使其向下移动 xxx px
                        3. 删除xxx(通常是某个id选择器)
                        其中，所有style参数都可以使用。
                        你应当充分利用已有页面元素进行操作。同时避免创建过多的元素！
                    `
                },
                {
                    role: "user",
                    content: "请基于长期目标和已有页面元素进行判读，并给出一个操作指令,你的指令应当明确给出必要信息 /no_think"
                }
            ], modelConfig);
        } catch (error: any) {
            console.error('规划模式请求失败:', error);
            return { error: `规划模式失败: ${error.message}` };
        }
    }

    /**
     * 执行操作指令
     */
    async executeActionInstruction(instruction: string, modelConfig: ModelConfig): Promise<any> {
        try {
            const isModify = await this.judgeUserInput(instruction, '是否是修改操作');
            const response = await this.sendModelRequest([
                {
                    role: "system",
                    content: this.modePrompts.action()
                },
                isModify ? {
                    role: 'user',
                    content: `当前页面元素列表：\n${queryElement(document.getElementById('model-instructions') as any)}`,
                } : null,
                {
                    role: "user",
                    content: instruction + "\n /no_think"
                }
            ].filter(Boolean), modelConfig);

            // 尝试解析为工具调用指令
            try {
                const command = JSON.parse(response);
                if (command.type === 'tool_call') {
                    const tool = this.toolRegistry[command.tool];
                    if (!tool) {
                        throw new Error(`未注册的工具: ${command.tool}`);
                    }
                    console.log(`[工具调用] ${command.tool}`, command.parameters);
                    const result = await tool.handler(command.parameters);
                    return {
                        tool: command.tool,
                        result
                    };
                }
            } catch (e) {
                // 不是有效的工具调用指令，按原样返回
                console.log('返回指令不是工具调用，按原指令处理', response);
            }

            return response;
        } catch (error: any) {
            console.error('操作模式请求失败:', error);
            return { error: `操作模式失败: ${error.message}` };
        }
    }

    /**
     * 执行审查指令
     */
    async executeReviewInstruction(instruction: string, modelConfig: ModelConfig): Promise<any> {
        try {
            return await this.sendModelRequest([
                {
                    role: "system",
                    content: this.modePrompts.review()
                }, {
                    role: 'user',
                    content: `当前页面元素列表：\n${queryElement(document.getElementById('model-instructions') as any)}`,
                },
                {
                    role: "user",
                    content: `最终目标是: ${instruction} 
                    现在请仔细检查 页面元素信息 并告诉我你的评价,你的评价应当明确给出简要的信息，最好用一句话概括是否可以结束任务。
                    /no_think
                    `
                }
            ], modelConfig);
        } catch (error: any) {
            console.error('审查模式请求失败:', error);
            return { error: `审查模式失败: ${error.message}` };
        }
    }

    /**
     * 执行模型指令（代理专用）
     */
    async executeModelInstruction(
        instruction: string,
        mode: 'planning' | 'action' | 'review' | 'evaluation',
        modelConfig: ModelConfig
    ): Promise<any> {
        const startTime = Date.now();

        try {
            switch (mode) {
                case 'planning':
                    return await this.executePlanningInstruction(instruction, modelConfig);
                case 'action':
                    return await this.executeActionInstruction(instruction, modelConfig);
                case 'review':
                    return await this.executeReviewInstruction(instruction, modelConfig);
                default:
                    throw new Error(`未知模式: ${mode}`);
            }
        } catch (error: any) {
            console.error(`模型请求失败 (${mode}模式):`, error);
            return {
                error: `模型请求失败: ${error.message || '未知错误'}`,
                duration: Date.now() - startTime
            };
        }
    }
}

// 导出全局服务实例
export const modelEngineService = new ModelEngineService();

/**
 * 测试工具调用功能
 */
async function testToolCalls() {
    // 注册MCP工具
    ModelEngineService.MCPAdapter.registerMCPTool(
        "weather-server",
        "get_forecast",
        "获取天气预报"
    );

    // // 模拟工具调用指令
    // const toolCallCommand = JSON.stringify({
    //     type: "tool_call",
    //     tool: "mcp:weather-server/get_forecast",
    //     parameters: { city: "北京", days: 3 }
    // });

    // // 执行工具调用
    // console.log("测试工具调用...");
    // const result = await modelEngineService.executeActionInstruction(
    //     toolCallCommand,
    //     modelEngineService.getModelConfig()
    // );

    // console.log("工具调用结果:", result);

    // // 测试计算器工具
    // const calculatorCall = JSON.stringify({
    //     type: "tool_call",
    //     tool: "calculator",
    //     parameters: { expression: "2 + 3 * 4" }
    // });

    // console.log("测试计算器工具...");
    // const calcResult = await modelEngineService.executeActionInstruction(
    //     calculatorCall,
    //     modelEngineService.getModelConfig()
    // );

    // console.log("计算器结果:", calcResult);
}

// 执行测试
testToolCalls();
