/*
 * @Date: 2025-06-04 12:18:00
 * @LastEditors: CZH
 * @FilePath: /AI编程与MCP使用/voice-chat-app/src/modelEngin/agentBase.ts
 */
import { v4 as uuidv4 } from 'uuid';
import { AgentMode } from './types';
import type { IAgent, ModeTransition, ModelConfig, ModelEngineService } from './types';

/**
 * 代理基础类
 */
export class AgentBase implements IAgent {
    public id = uuidv4();
    public currentMode: AgentMode = AgentMode.PLANNING;
    public modeHistory: ModeTransition[] = [];

    constructor(
        private modelService: ModelEngineService, // ✅ 通过依赖注入
        private modelConfig: ModelConfig
    ) { }

    /**
     * 切换代理模式
     * @param newMode 新模式
     * @param reason 切换原因
     */
    transitionMode(newMode: AgentMode, reason: string): void {
        // 记录模式转换历史
        this.modeHistory.push({
            from: this.currentMode,
            to: newMode,
            timestamp: new Date(),
            reason: reason
        });

        // 更新当前模式
        this.currentMode = newMode;
    }

    /**
     * 执行任务
     * @param task 任务指令
     * @returns 执行结果
     */
    async executeTask(task: string): Promise<any> {
        switch (this.currentMode) {
            case AgentMode.PLANNING:
                return this.handlePlanning(task);
            case AgentMode.ACTION:
                return this.handleAction(task);
            case AgentMode.REVIEW:
                return this.handleReview(task);
            case AgentMode.EVALUATION:
                return this.handleEvaluation(task);
            default:
                throw new Error(`未知代理模式: ${this.currentMode}`);
        }
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
            status: 'planning',
            plan: response.instructions || [],
            rawResponse: response
        };
    }

    // 行动模式处理 - 调用模型执行任务步骤
    private async handleAction(task: string) {
        console.log(`[代理 ${this.id}] 执行任务: ${task}`);
        const response = await this.modelService.executeModelInstruction(
            `你是一位任务执行专家。请执行以下操作：${task}`,
            'action',
            this.modelConfig
        );
        return {
            status: 'action',
            executed: response.success || false,
            result: response.message || '任务执行完成',
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
            status: 'review',
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
            status: 'evaluation',
            completed: response.completed || false,
            score: response.score || 0,
            feedback: response.feedback || '',
            rawResponse: response
        };
    }
}
