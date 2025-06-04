import axios from "axios";
import type { ModelConfig } from "./types";
import { Supervisor } from './supervisor';

/**
 * 模型引擎服务类
 */
export class ModelEngineService {
    public readonly supervisor: Supervisor;
    private modelConfig: ModelConfig;

    constructor() {
        // 使用默认配置初始化
        this.modelConfig = {
            model: "qwen3-0.6b",
            url: "http://127.0.0.1:1234/v1/chat/completions",
            apiKey: ""
        };
        this.supervisor = new Supervisor(this, this.modelConfig);
    }

    private readonly basePowerPrompts = `
你是一个综合智能体，你具备 planning 、action 、review 三种模式。
不同模式的简介：
planning：根据用户输入进行任务规划，将用户的输入任务拆解为多步骤的 任务指令供 action 执行。
action：执行 单个元素生成、单个元素编辑、单个元素删除的指令。
review：检查任务执行结果，在review模式中，你能查看到当前页面的所有元素。可以判断运行结果，若判断任务为能完成，可以通过指令输出修改建议。
`

    // 模式专用提示词
    private readonly modePrompts = {
        planning: (userinput?: string) => `
${this.basePowerPrompts}
当前处于planning，请根据用户输入进行任务规划。
当前用户的要求是：${userinput}
        `,
        action: () => `
        ${this.basePowerPrompts}
        当前处于 action 模式
当你判断用户只是普通聊天，那就用简短的回答回应用户即可。
当你判断需要进行页面元素操作时，请严格按照以下 JSON 格式输出操作指令，确保语法正确且字段完整：
{
"type": "操作类型", // 可选值：dom/create（创建元素）、dom/modify（修改元素）、dom/delete（删除元素）
"payload": {
"tag": "元素标签名", // 例如 div、span、button，create 类型必填
"attrs": {"属性名": "属性值", ...}, // 元素属性，无属性时留空对象 {}
"content": "元素内容", // 文本内容或 HTML 片段，create 类型必填，query 类型用于返回结果
"selector": "选择器", // 用于 modify/delete/query 类型，格式如.class、#id、element 标签名
"modifications": {"属性修改": "新值", ...} //modify 类型必填，指定需要修改的属性及值
}
}

注意事项：
用原始json格式输出，不要使用markdown标签包裹
所有元素应当默认使用绝对定位,默认使用top和 left处理定位，例如 top:0px; left: 0px;
type 字段必须从可选值中选择，严禁自定义（如错误写成 "dom-create"）
payload 字段必填规则：
dom/create：必须包含 tag、content，attrs 可选（如 {style: "color: red"}） 其中当你想删除某个属性，则需要把这属性的对应值改为none
dom/modify：必须包含 selector、modifications（如 {textContent: "新文本"}）
dom/delete：必须包含 selector（如 #footer 或 div.container）
dom/query：必须包含 selector，查询结果通过 content 字段返回
严格遵循 JSON 语法规范：
所有字符串使用双引号包裹（如 "div" 而非 'div'）
键名必须与示例完全一致（如 modifications 而非 modification）
禁止出现注释、多余逗号或非 JSON 格式内容
选择器规范：
支持 CSS 选择器语法（如 [href^="http"] 匹配链接）
确保选择器唯一性（避免修改 / 删除多个元素时出错）`,
        review: () => `你是一位质量检查专家。你能查看到当前页面的所有元素，请验证任务执行结果。`,
        evaluation: () => `你是一位任务评估专家。请评估任务完成情况。输出格式：{ completed: true, score: 90, feedback: "评估反馈" }`
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
                    content: `你是一个判断专家，判断条件是${requirement}。请根据以下要求进行判断。只输出是或者否即可`
                },
                {
                    role: "user",
                    content: input
                }
            ], this.modelConfig);

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
                max_tokens: -1,
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
            return await this.sendModelRequest([
                {
                    role: "system",
                    content: this.modePrompts.planning(instruction)
                },
                {
                    role: "user",
                    content: instruction + "\n/no_think"
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
            return await this.sendModelRequest([
                {
                    role: "system",
                    content: this.modePrompts.action()
                },
                {
                    role: "user",
                    content: instruction + "\n/no_think"
                }
            ], modelConfig);
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
                },
                {
                    role: "user",
                    content: instruction + "\n/no_think"
                }
            ], modelConfig);
        } catch (error: any) {
            console.error('审查模式请求失败:', error);
            return { error: `审查模式失败: ${error.message}` };
        }
    }

    /**
     * 执行评估指令
     */
    async executeEvaluationInstruction(instruction: string, modelConfig: ModelConfig): Promise<any> {
        try {
            return await this.sendModelRequest([
                {
                    role: "system",
                    content: this.modePrompts.evaluation()
                },
                {
                    role: "user",
                    content: instruction + "\n/no_think"
                }
            ], modelConfig);
        } catch (error: any) {
            console.error('评估模式请求失败:', error);
            return { error: `评估模式失败: ${error.message}` };
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
                case 'evaluation':
                    return await this.executeEvaluationInstruction(instruction, modelConfig);
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
