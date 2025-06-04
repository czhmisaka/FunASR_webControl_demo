/*
 * @Date: 2025-06-04 12:18:00
 * @LastEditors: CZH
 * @FilePath: /AI编程与MCP使用/voice-chat-app/src/modelEngin/agentBase.ts
 */
import { v4 as uuidv4 } from 'uuid';
import { SystemMode } from './types';
import type { IAgent, ModeTransition, ModelConfig, ModelEngineService, UnifiedAgentResponse, ToolExecutionResult } from './types';
import { ToolScheduler } from './toolScheduler';
import { handleInstructions } from './domOperations';

/**
 * 代理基础类
 */
export class AgentBase implements IAgent {
    public id = uuidv4();
    public currentMode: SystemMode = SystemMode.PLANNING;
    public modeHistory: ModeTransition[] = [];

    constructor(
        private modelService: ModelEngineService, // ✅ 通过依赖注入
        private modelConfig: ModelConfig,
        private toolScheduler: ToolScheduler
    ) {
        // 工具注册已移到 Supervisor，此处不再注册
    }

    /**
     * 切换代理模式
     * @param newMode 新模式
     * @param reason 切换原因
     */
    transitionMode(newMode: SystemMode, reason: string): void {
        // 记录模式转换历史
        this.modeHistory.push({
            from: this.currentMode,
            to: newMode,
            timestamp: new Date(),
            reason: reason
        });

        // 更新当前模式
        this.currentMode = newMode;

        // 推送代理状态变更消息
        const modelService = this.modelService as any;
        if (modelService.pushAgentMessage) {
            modelService.pushAgentMessage(
                `代理 ${this.id} 进入 ${newMode} 模式`,
                'agent-state',
                { agentId: this.id, mode: newMode }
            );
        }
    }

    /**
     * 执行任务
     * @param task 任务指令
     * @returns 执行结果
     */
    async executeTask(task: string): Promise<UnifiedAgentResponse> {
        let result: any;
        let status: 'success' | 'partial' | 'error' = 'success';
        let data: any;
        let nextActions: string[] = [];

        switch (this.currentMode) {
            case SystemMode.PLANNING:
                result = await this.handlePlanning(task);
                data = {
                    plan: result.plan,
                    rawResponse: result.rawResponse
                };
                nextActions = result.plan.map((step: string) => `执行: ${step.split('\n')[0]}`);
                break;
            case SystemMode.ACTION:
                result = await this.handleAction(task);
                data = {
                    executed: result.executed,
                    result: result.result,
                    rawResponse: result.rawResponse
                };
                status = result.executed ? 'success' : 'error';
                nextActions = result.executed ? ['验证执行结果'] : ['重试操作'];
                break;
            case SystemMode.REVIEW:
                result = await this.handleReview(task);
                data = {
                    passed: result.passed,
                    issues: result.issues,
                    rawResponse: result.rawResponse
                };
                status = result.passed ? 'success' : 'partial';
                nextActions = result.passed ? ['进行最终评估'] : ['修复问题'];
                break;
            case SystemMode.EVALUATION:
                result = await this.handleEvaluation(task);
                data = {
                    completed: result.completed,
                    score: result.score,
                    feedback: result.feedback,
                    rawResponse: result.rawResponse
                };
                status = result.completed ? 'success' : 'partial';
                nextActions = result.completed ? ['任务完成'] : ['重新规划'];
                break;
            default:
                throw new Error(`未知代理模式: ${this.currentMode}`);
        }

        return {
            mode: this.currentMode,
            agentId: this.id,
            result: {
                status,
                data
            },
            nextActions
        };
    }

    // 规划模式处理 - 调用模型生成任务计划
    private async handlePlanning(task: string) {
        console.log(`[代理 ${this.id}] 规划任务: ${task}`);
        const response = await this.modelService.executeModelInstruction(
            `你是一位任务规划专家。请将以下用户目标分解为可执行的步骤序列：${task}`,
            'planning',
            this.modelConfig
        );
        return {
            plan: response.instructions || [],
            rawResponse: response
        };
    }

    // 行动模式处理 - 调用模型执行任务步骤
    private async handleAction(task: string) {
        console.log(`[代理 ${this.id}] 执行任务: ${task}`);
        let response = await this.modelService.executeModelInstruction(
            `${task}`,
            'action',
            this.modelConfig
        );
        response = JSON.parse(response);
        console.log(`[代理 ${this.id}] 响应:`, response, typeof response);
        // 仅处理DOM指令
        if (response.type && response.type.startsWith("dom/")) {
            const container = document.getElementById('model-instructions');
            if (!container) {
                return {
                    executed: false,
                    result: "找不到容器元素'model-instructions'",
                    rawResponse: response
                };
            }
            console.log(`[代理 ${this.id}] 执行DOM指令:`, response);
            const toolResult = await this.toolScheduler.executeTool("dom", {
                instruction: JSON.stringify(response),
                container: container
            }, this.id) as ToolExecutionResult;
            console.log(`[代理 ${this.id}] 工具执行结果:`, toolResult);

            return {
                executed: toolResult.status === 'success',
                result: toolResult.status === 'success' ? toolResult.result : toolResult.message,
                rawResponse: response
            };
        }

        return {
            executed: false,
            result: `不支持指令类型: ${response.type || '未定义'}`,
            rawResponse: response
        };
    }

    // 检查模式处理 - 调用模型验证执行结果
    private async handleReview(task: string) {
        console.log(`[代理 ${this.id}] 检查任务: ${task}`);
        const response = await this.modelService.executeModelInstruction(
            `你是一位质量检查专家。请验证以下任务执行结果：${task}`,
            'review',
            this.modelConfig
        );
        return {
            passed: response.verification || false,
            issues: response.issues || [],
            rawResponse: response
        };
    }

    // 评价模式处理 - 调用模型评估整体效果
    private async handleEvaluation(task: string) {
        console.log(`[代理 ${this.id}] 评价任务: ${task}`);
        const response = await this.modelService.executeModelInstruction(
            `你是一位任务评估专家。请对以下任务完成情况进行评估：${task}`,
            'evaluation',
            this.modelConfig
        );
        return {
            completed: response.completed || false,
            score: response.score || 0,
            feedback: response.feedback || '',
            rawResponse: response
        };
    }
}
