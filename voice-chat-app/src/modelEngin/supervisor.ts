/*
 * @Date: 2025-06-04 12:20:00
 * @LastEditors: CZH
 * @FilePath: /AI编程与MCP使用/voice-chat-app/src/modelEngin/supervisor.ts
 */
import { v4 as uuidv4 } from 'uuid';
import { AgentMode } from './types';
import type { IAgent, ModelEngineService, ModelConfig, Directive, DOMAction } from './types';
import { AgentBase } from './agentBase';
import { domBaseOperations } from './domOperations';

/**
 * 监督器类，管理多个代理
 */
export class Supervisor {
    private agents: IAgent[] = [];
    private activeGoal: string | null = null;
    private isRunning: boolean = false;
    private modelConfig: ModelConfig;
    private modelService: ModelEngineService;

    // 新增指令执行接口
    public executeDirective(directive: Directive): string {
        try {
            switch (directive.action) {
                case 'clickElement':
                    return domBaseOperations.clickElement(directive.params[0]);
                case 'setInputValue':
                    return domBaseOperations.setInputValue(directive.params[0], directive.params[1]);
                default:
                    throw new Error(`Unsupported action: ${directive.action}`);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return `Error: ${message}`;
        }
    }

    constructor(modelService: ModelEngineService, modelConfig: ModelConfig) {
        this.modelService = modelService;
        this.modelConfig = modelConfig;
        // 初始化代理
        this.addAgent();

        // 暴露API到全局
        window.__directiveAPI = { executeDirective: this.executeDirective.bind(this) };
    }

    /**
     * 添加新代理
     */
    addAgent(): IAgent {
        const newAgent = new AgentBase(this.modelService, this.modelConfig);
        this.agents.push(newAgent);
        return newAgent;
    }

    /**
     * 移除代理
     * @param id 代理ID
     */
    removeAgent(id: string): void {
        this.agents = this.agents.filter(agent => agent.id !== id);
    }

    /**
     * 获取所有代理
     */
    getAllAgents(): IAgent[] {
        return this.agents;
    }

    /**
     * 获取指定代理
     * @param id 代理ID
     */
    getAgent(id: string): IAgent | undefined {
        return this.agents.find(agent => agent.id === id);
    }

    /**
     * 执行用户目标
     * @param goal 用户输入的目标
     */
    async executeGoal(goal: string): Promise<void> {
        this.activeGoal = goal;
        this.isRunning = true;

        // 创建初始规划代理
        const planningAgent = this.addAgent();
        planningAgent.transitionMode(AgentMode.PLANNING, "初始目标规划");

        try {
            while (this.isRunning && this.agents.length > 0) {
                // 选择当前模式最合适的代理
                const activeAgent = this.selectActiveAgent();

                if (!activeAgent) {
                    this.isRunning = false;
                    break;
                }

                // 执行任务并等待结果
                const result = await activeAgent.executeTask(this.activeGoal);
                console.log(`代理执行结果:`, result);

                // 根据结果决定下一步行动
                const nextAction = this.determineNextAction(result, activeAgent);

                // 执行下一步行动
                this.handleNextAction(nextAction, result);

                // 添加延迟避免CPU过载
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } catch (error) {
            console.error("目标执行失败:", error);
            this.isRunning = false;
        }
    }

    /**
     * 选择当前最合适的代理
     */
    private selectActiveAgent(): IAgent | undefined {
        // 选择当前模式最适合的代理
        const modePriority = [
            AgentMode.PLANNING,
            AgentMode.ACTION,
            AgentMode.REVIEW,
            AgentMode.EVALUATION
        ];

        // 按模式优先级选择代理
        for (const mode of modePriority) {
            const agent = this.agents.find(a => a.currentMode === mode);
            if (agent) return agent;
        }

        // 默认返回第一个代理
        return this.agents[0];
    }

    /**
     * 根据执行结果确定下一步行动
     * @param result 代理执行结果
     * @param agent 当前代理
     */
    private determineNextAction(result: any, agent: IAgent): { action: 'switchMode' | 'createAgent' | 'removeAgent' | 'complete', details?: any } {
        // 根据代理当前模式和结果决定下一步
        switch (agent.currentMode) {
            case AgentMode.PLANNING:
                // 规划完成后切换到行动模式
                return {
                    action: 'switchMode',
                    details: {
                        agentId: agent.id,
                        newMode: AgentMode.ACTION,
                        reason: '规划完成，开始执行'
                    }
                };

            case AgentMode.ACTION:
                // 行动完成后切换到检查模式
                return {
                    action: 'switchMode',
                    details: {
                        agentId: agent.id,
                        newMode: AgentMode.REVIEW,
                        reason: '行动完成，开始检查'
                    }
                };

            case AgentMode.REVIEW:
                // 检查完成后切换到评价模式
                return {
                    action: 'switchMode',
                    details: {
                        agentId: agent.id,
                        newMode: AgentMode.EVALUATION,
                        reason: '检查完成，开始评价'
                    }
                };

            case AgentMode.EVALUATION:
                if (result.completed) {
                    // 评价完成且任务成功
                    return { action: 'complete' };
                } else {
                    // 需要重新规划
                    return {
                        action: 'switchMode',
                        details: {
                            agentId: agent.id,
                            newMode: AgentMode.PLANNING,
                            reason: '评价未通过，重新规划'
                        }
                    };
                }

            default:
                return { action: 'complete' };
        }
    }

    /**
     * 处理下一步行动
     * @param nextAction 下一步行动指令
     * @param result 当前执行结果
     */
    private handleNextAction(nextAction: { action: 'switchMode' | 'createAgent' | 'removeAgent' | 'complete', details?: any }, result: any): void {
        switch (nextAction.action) {
            case 'switchMode':
                const agent = this.getAgent(nextAction.details.agentId);
                if (agent) {
                    agent.transitionMode(nextAction.details.newMode, result.transitionReason || "模式切换");
                }
                break;

            case 'createAgent':
                this.addAgent().transitionMode(AgentMode.PLANNING, "创建新代理");
                break;

            case 'removeAgent':
                this.removeAgent(nextAction.details.agentId);
                break;

            case 'complete':
                this.isRunning = false;
                console.log("目标完成:", this.activeGoal);
                break;
        }
    }

    /**
     * 停止所有代理
     */
    stopAll(): void {
        this.isRunning = false;
        this.agents = [];
    }
}
