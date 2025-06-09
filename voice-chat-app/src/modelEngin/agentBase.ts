/*
 * @Date: 2025-06-04 12:18:00
 * @LastEditors: CZH
 * @FilePath: /AI编程与MCP使用/voice-chat-app/src/modelEngin/agentBase.ts
 */
import { v4 as uuidv4 } from 'uuid';
import { SystemMode } from './types';
import type { IAgent, ModeTransition, ModelConfig, ModelEngineService, UnifiedAgentResponse, ToolExecutionResult, TaskDefinition } from './types';
import { ToolScheduler } from './toolScheduler';
import { domPlugin } from '../pluginSystem/domPlugin';
import type { PluginInstruction } from '../pluginSystem/types';
import { DOMOperation } from '../pluginSystem/types';

/**
 * 代理基础类
 */
export class AgentBase implements IAgent {
    public id = uuidv4();
    public currentMode: SystemMode = SystemMode.PLANNING;
    public modeHistory: ModeTransition[] = [];
    public lastEvaluationResult: any = null; // 存储最近一次评估结果
    private isActive = true; // 代理活动状态标志

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
                `代理进入 ${newMode} 模式`,
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
        console.log(`[代理 ${this.id}] 执行任务: ${task}`)
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
                console.log(`tasktasktasktasktask 执行操作: ${task}`);
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
                nextActions = result.passed ? ['规划下一步'] : ['修复问题'];
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
        let prompt = task

        // // 注入历史评估结果
        // if (this.lastEvaluationResult) {
        //     prompt += `\n\n### 历史评估结果\n`
        //         + `完成状态: ${this.lastEvaluationResult.completed ? "是" : "否"}\n`
        //         + `评分: ${this.lastEvaluationResult.score}/100\n`
        //         + `反馈: ${this.lastEvaluationResult.feedback}`;
        // }

        const response = await this.modelService.executeModelInstruction(
            prompt,
            'planning',
            this.modelConfig
        );

        // 将步骤数组转换为任务对象数组（添加顺序和依赖关系）
        const steps: string[] = response.instructions || [];
        const plan = steps.map((step: string, index: number) => ({
            id: `task-${Date.now()}-${index}`,
            order: index + 1,
            description: step,
            dependsOn: index > 0 ? [`task-${Date.now()}-${index - 1}`] : []
        }));

        return {
            plan,
            rawResponse: response
        };
    }

    // 行动模式处理 - 调用模型执行任务步骤
    private async handleAction(task: string) {
        console.log(`[代理 ${this.id}] 执行任务: ${task}`);
        const response = await this.modelService.executeModelInstruction(
            `${task}`,
            'action',
            this.modelConfig
        );
        const parsedResponse = JSON.parse(response);
        console.log(`[代理 ${this.id}] action响应:`, parsedResponse, typeof parsedResponse);

        // 仅处理DOM指令
        if (parsedResponse.tool) {
            const container = document.getElementById('model-instructions');
            try {
                // 将指令映射为插件格式
                const instruction = this.mapToDOMOperation(parsedResponse);
                // 通过插件执行DOM操作
                const result = await domPlugin.execute(instruction);
                return {
                    executed: true,
                    result: "DOM指令已执行",
                    rawResponse: result
                };
            } catch (e: any) {
                console.error(`[代理 ${this.id}] DOM指令执行失败:`, e);
                return {
                    executed: false,
                    result: `执行失败: ${e.message}`,
                    rawResponse: parsedResponse
                };
            }
        }

        return {
            executed: false,
            result: `不支持指令类型: ${parsedResponse.tool || '未定义'}`,
            rawResponse: parsedResponse
        };
    }

    /**
     * 将原始指令映射为DOM插件指令格式
     * @param instruction 原始指令
     * @returns 映射后的插件指令
     */
    private mapToDOMOperation(instruction: any): PluginInstruction {
        const operationMap: Record<string, DOMOperation> = {
            'dom/create': DOMOperation.CREATE,
            'dom/modify': DOMOperation.MODIFY,
            'dom/delete': DOMOperation.DELETE,
            'dom/query': DOMOperation.QUERY
        };

        if (!operationMap[instruction.name]) {
            throw new Error(`不支持的DOM操作类型: ${instruction.name}`);
        }

        return {
            type: operationMap[instruction.name],
            payload: instruction.payload
        };
    }

    // 检查模式处理 - 调用模型验证执行结果
    private async handleReview(task: string) {
        console.log(`[代理 ${this.id}] 检查任务: ${task}`);
        const response = await this.modelService.executeModelInstruction(
            task,
            'review',
            this.modelConfig
        );
        return {
            passed: response.verification || false,
            issues: response.issues || [],
            rawResponse: response
        };
    }

    /**
     * 终止代理执行
     */
    public terminate() {
        this.isActive = false;
    }

}
