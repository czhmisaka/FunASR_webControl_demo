/**
 * 状态机引擎实现
 */
import { v4 as uuidv4 } from 'uuid';
import type { ModelEngineService, ModelConfig, StateTransition, StateMachine } from './types';

export class StateMachineEngine implements StateMachine {
    current_state: string = 'planning';
    state_history: StateTransition[] = [];
    private modelService: ModelEngineService;
    private modelConfig: ModelConfig;

    // 状态转换规则（明确定义索引签名）
    private transition_rules: Record<string, string[]> = {
        planning: ['action'],
        action: ['review', 'planning'],
        review: ['planning', 'complete'] // 直接移除evaluation
    };

    constructor(modelService: ModelEngineService, modelConfig: ModelConfig) {
        this.modelService = modelService;
        this.modelConfig = modelConfig;
        this.initialize();
    }

    private initialize() {
        this.state_history = [{
            state: 'planning',
            time: new Date(),
            transition_reason: '状态机初始化'
        }];
    }

    async transition(agentResponse: any): Promise<string> {
        const current_state = this.current_state;
        const next_states = this.transition_rules[current_state];

        // 使用modelEngineService 的 judgeUserInput 函数
        if (current_state === 'review' && agentResponse.result.data.rawResponse) {
            const isFinish = await this.modelService.judgeUserInput(`
            当前任务进行度的评价为${agentResponse.result.data.rawResponse}
            `, '任务是否完成');

            if (isFinish) {
                return this.setNextState('complete', '模型决策: 任务完成');
            } else {
                return this.setNextState('planning', '模型决策: 任务未完成，重新规划');
            }

        }
        let decision = {
            next_state: 'planning',
            reason: '未找到有效决策'
        };

        if (current_state === 'planning') {
            decision = {
                next_state: 'action',
                reason: '模型决策: 开始执行任务'
            };
        } else if (current_state === 'action') {
            decision = {
                next_state: 'review',
                reason: '模型决策: 检查'
            };
        }

        // 验证状态有效性
        if (!next_states.includes(decision.next_state)) {
            decision.next_state = 'planning';
            decision.reason += ' (无效状态)';
        }

        return this.setNextState(decision.next_state, `模型决策: ${decision.reason}`);
    }

    public setNextState(next_state: string, reason: string): string {
        const validStates = ['planning', 'action', 'review', 'complete', 'terminating', 'terminated']; // 添加终止状态
        if (!validStates.includes(next_state)) {
            next_state = 'planning';
            reason = `无效状态自动回退: ${reason}`;
        }

        this.state_history.push({
            state: next_state,
            time: new Date(),
            transition_reason: reason
        });
        this.current_state = next_state;
        return next_state;
    }

    private allTasksCompleted(task: any): boolean {
        const subtasks = task.subtasks || [];
        return subtasks.every((subtask: any) => subtask.status === 'completed');
    }

    isComplete(): boolean {
        return this.current_state === 'complete';
    }
}
