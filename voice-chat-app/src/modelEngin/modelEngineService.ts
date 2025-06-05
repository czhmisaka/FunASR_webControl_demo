import axios from "axios";
import type { ModelConfig, Message, MessageType } from "./types";
import { Supervisor } from './supervisor';
import { queryElement } from "./domOperations";
import { roleTypes } from "element-plus";

/**
 * 模型引擎服务类
 */
export class ModelEngineService {
    public readonly supervisor: Supervisor;
    private modelConfig: ModelConfig;
    private agentMessages: Message[] = []; // 存储代理消息

    constructor() {
        // 使用默认配置初始化
        this.modelConfig = {
            // model: "qwen3-0.6b",
            model: "qwen/qwen3-8b",
            // model: "qwen/qwen3-14b",
            // model: "qwen3-30b-a3b",
            // model: "deepseek-chat",
            // url: "http://192.168.31.126:1234/v1/chat/completions",
            apiKey: '',
            // url: " https://api.deepseek.com/v1/chat/completions",
            url: "http://127.0.0.1:1234/v1/chat/completions",



            // model: "GLM-4-Flash-250414",
            // url: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
        };
        this.supervisor = new Supervisor(this, this.modelConfig);
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

    private readonly basePowerPrompts = `
你是一个综合智能体，你具备 planning 、action 、review 三种模式。
不同模式的简介：
planning：根据用户输入进行任务规划，分析并生成下一步的任务指令供 action 执行。
action：执行单一的 元素生成、元素编辑、元素删除的指令。
review：检查任务执行结果，在review模式中，你能查看到当前页面的所有元素。可以判断运行结果，若判断任务为能完成，可以通过指令输出修改建议。只需要输出下一步建议即可，不需要输出其他内容。
`

    // 模式专用提示词
    private readonly modePrompts = {
        planning: (userinput?: string) => `
${this.basePowerPrompts}
当前处于planning，模式
当前用户的要求是：${userinput}
        `,
        action: () => `
        ${this.basePowerPrompts}
        当前处于 action 模式

请严格按照以下 JSON 格式输出操作指令，确保语法正确且字段完整：
{
"type": "操作类型", // 可选值：dom/create（创建元素）、dom/modify（修改元素）、dom/delete（删除元素）
"payload": {
"tag": "元素标签名", // 例如 div、span、button，create 类型必填
"attrs": {"属性名": "属性值", ...}, // 元素属性，无属性时留空对象 {} 推荐使用 style 作为主要修改属性
"content": "元素内容", // 文本内容或 HTML 片段，create 类型必填，query 类型用于返回结果
"selector": "选择器", // 用于 modify/delete/query 类型，格式如.class、#id、element 标签名
"modifications": {"属性修改": "新值", ...} //modify 类型必填，指定需要修改的属性及值
}
}

注意事项：
用原始json格式输出，不要使用markdown标签包裹
所有元素应当默认使用绝对定位,默认使用top和 left处理定位，例如 top:0px; left: 0px;你可以使用dom/modify 修改元素定位来移动元素
type 字段必须从可选值中选择，严禁自定义（如错误写成 "dom-create"）
payload 字段必填规则：
dom/create：必须包含 tag、content，attrs 可选（如 {style: "color: red"}） 其中当你想删除某个属性，则需要把这属性的对应值改为none,所有的样式或定位都应该在style里明确输出
dom/modify：必须包含 selector、modifications（如 {textContent: "新文本"}）
dom/delete：必须包含 selector（如 #footer 或 div.container）

严格遵循 JSON 语法规范：
所有字符串使用双引号包裹（如 "div" 而非 'div'）
键名必须与示例完全一致（如 modifications 而非 modification）
禁止出现注释、多余逗号或非 JSON 格式内容
选择器规范：
确保选择器唯一性（避免修改 / 删除多个元素时出错）`,
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
     * 发送模型请求 (公共逻辑)
     */
    private async sendModelRequest(messages: any[], modelConfig: ModelConfig): Promise<any> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (modelConfig.apiKey) {
            headers["Authorization"] = `Bearer ${modelConfig.apiKey}`;
        }

        const response = await axios.post(
            modelConfig.url,
            {
                model: modelConfig.model,
                messages,
                temperature: 0.7,
                // max_tokens: ,
                stream: false,
            },
            { headers }
        );

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
                    // 需要增加当前容器内的元素列表
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
            console.log('fuck______action', instruction)
            return await this.sendModelRequest([
                {
                    role: "system",
                    content: this.modePrompts.action()
                },
                isModify ? {
                    role: 'user',
                    // 需要增加当前容器内的元素列表
                    content: `当前页面元素列表：\n${queryElement(document.getElementById('model-instructions') as any)}`,
                } : null,
                {
                    role: "user",
                    content: instruction + "\n /no_think"
                }
            ].filter(Boolean), modelConfig);
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
                    // 需要增加当前容器内的元素列表
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
