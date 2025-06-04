/*
 * @Date: 2025-06-04 12:20:00
 * @LastEditors: CZH
 * @FilePath: /AI编程与MCP使用/voice-chat-app/src/modelEngin/supervisor.ts
 */
import { v4 as uuidv4 } from 'uuid';
import { SystemMode } from './types';
import type { IAgent, ModelEngineService, ModelConfig, Directive, DOMAction, Task } from './types';
import { AgentBase } from './agentBase';
import { StateMachineEngine } from './stateMachine';
import { ToolScheduler } from './toolScheduler';
import { domBaseOperations, handleInstructions } from './domOperations';

/**
 * 监督器类，管理多个代理
 */
export class Supervisor {
    private agents: IAgent[] = [];
    private activeGoal: string | null = null;
    private isRunning: boolean = false;
    private modelConfig: ModelConfig;
    private modelService: ModelEngineService;
    private stateMachine: StateMachineEngine;
    private toolScheduler: ToolScheduler;

    // 新增指令执行接口（通过工具调度器）
    public async executeDirective(directive: Directive): Promise<string> {
        try {
            // 通过工具调度器执行DOM操作
            const toolId = `dom_${directive.action}`;
            const result = await this.toolScheduler.executeTool(toolId, directive.params, 'supervisor');

            if (result.status === 'success') {
                return result.result as string;
            } else {
                throw new Error(result.message || '工具执行失败');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return `Error: ${message}`;
        }
    }

    constructor(modelService: ModelEngineService, modelConfig: ModelConfig) {
        this.modelService = modelService;
        this.modelConfig = modelConfig;
        this.stateMachine = new StateMachineEngine(modelService, modelConfig);
        this.toolScheduler = new ToolScheduler();

        // 注册所有DOM操作工具
        this.toolScheduler.registerTool('dom', {
            execute: (params: { instruction: string; container: HTMLElement }) => {
                return handleInstructions(params.instruction, params.container);
            }
        });

        // 注册基础DOM操作工具
        this.toolScheduler.registerTool('dom_clickElement', {
            execute: (selector: string) => domBaseOperations.clickElement(selector)
        });

        this.toolScheduler.registerTool('dom_setInputValue', {
            execute: (selector: string, value: string) =>
                domBaseOperations.setInputValue(selector, value)
        });

        // 初始化代理
        this.addAgent();

        // 暴露API到全局
        window.__directiveAPI = { executeDirective: this.executeDirective.bind(this) };
    }

    /**
     * 添加新代理
     */
    addAgent(): IAgent {
        const newAgent = new AgentBase(this.modelService, this.modelConfig, this.toolScheduler);
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
     * 使用大模型解析用户输入为结构化任务
     */
    private async parseUserGoal(goal: string): Promise<Task> {
        // 使用提示词要求模型返回结构化任务
        const prompt = `将用户目标解析为结构化任务：
用户目标: ${goal}

返回JSON格式：
{
  "task_id": "生成的UUID",
  "intent": "任务意图",
  "params": { 关键参数 },
  "priority": "low/medium/high",
  "deadline": "可选截止时间",
  "subtasks": [子任务数组]
}`;

        const modelResponse = await this.modelService.executeModelInstruction(
            prompt,
            'planning',
            this.modelConfig
        );

        try {
            // 尝试解析模型响应
            const task = JSON.parse(modelResponse) as Task;
            task.task_id = task.task_id || uuidv4();
            return task;
        } catch (error) {
            // 解析失败时返回简化任务
            return {
                task_id: uuidv4(),
                intent: 'user_goal',
                params: { goal },
                priority: 'medium',
                subtasks: []
            };
        }
    }

    /**
     * 执行用户目标（使用状态机驱动工作流）
     * @param goal 用户输入的目标
     */
    async executeGoal(goal: string): Promise<void> {
        this.activeGoal = goal;
        this.isRunning = true;

        // 解析用户目标为结构化任务
        const task = await this.parseUserGoal(goal);
        console.log('结构化任务:', task);

        // 创建初始规划代理
        const planningAgent = this.addAgent();
        planningAgent.transitionMode(SystemMode.PLANNING, "初始目标规划");

        try {
            while (this.isRunning && !this.stateMachine.isComplete() && this.agents.length > 0) {
                // 获取当前状态
                const currentState = this.stateMachine.current_state;

                // 根据状态选择代理
                let activeAgent = this.agents.find(agent =>
                    agent.currentMode === currentState
                );

                if (!activeAgent) {
                    activeAgent = this.selectActiveAgent();
                }

                if (!activeAgent) {
                    this.isRunning = false;
                    break;
                }

                // 执行任务并等待结果
                const result = await activeAgent.executeTask(this.activeGoal);
                console.log(`代理执行结果:`, result);

                // 更新任务状态
                task.subtasks = task.subtasks || [];
                task.subtasks.push({
                    subtask_id: uuidv4(),
                    description: `State: ${currentState}, Result: ${JSON.stringify(result)}`,
                    required_capabilities: [],
                    output_format: 'text'
                });

                // 状态转换（使用智能决策）
                const nextState = await this.stateMachine.transition(result) as SystemMode;

                // 更新代理模式以匹配状态机
                activeAgent.transitionMode(nextState, '状态机决策更新');

                // 添加延迟避免CPU过载
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            if (this.stateMachine.isComplete()) {
                console.log("任务完成:", task);
            }
        } catch (error) {
            console.error("目标执行失败:", error);
            this.isRunning = false;
        } finally {
            this.stopAll();
        }
    }

    /**
     * 选择当前最合适的代理
     */
    private selectActiveAgent(): IAgent | undefined {
        // 直接匹配当前状态机状态
        return this.agents.find(agent =>
            agent.currentMode === this.stateMachine.current_state
        ) || this.agents[0];
    }

    /**
     * 停止所有代理
     */
    stopAll(): void {
        this.isRunning = false;
        this.agents = [];
    }
}
