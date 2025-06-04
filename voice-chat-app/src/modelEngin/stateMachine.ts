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
        review: ['evaluation'],
        evaluation: ['action', 'planning', 'complete']
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

        // 准备决策上下文
        const decisionContext = {
            current_state,
            task_intent: agentResponse.taskId ? `任务ID: ${agentResponse.taskId}` : "未指定任务",
            last_result: agentResponse.result.status,
            result_data: agentResponse.result.data,
            mode_history: this.state_history.slice(-5).map(t => t.state),
            next_actions: agentResponse.nextActions || []
        };

        // 使用结构化提示词要求模型返回JSON决策
        const prompt = `作为状态机决策引擎，请基于以下上下文选择下一个状态：
当前状态: ${decisionContext.current_state}
任务目标: ${decisionContext.task_intent}
上次结果: ${decisionContext.last_result}
结果详情: ${JSON.stringify(decisionContext.result_data)}
历史模式: ${decisionContext.mode_history.join(' → ')}
下一步建议: ${decisionContext.next_actions.join(', ') || '无'}
可选状态: ${next_states.join(',')}

请以JSON格式返回决策：
{
  "next_state": "选择的状态",
  "reason": "决策原因"
}`;

        console.log('当前模型决策', JSON.parse(JSON.stringify(this.modelConfig)))
        const modelResponse = await this.modelService.executeModelInstruction(
            prompt,
            'planning',
            this.modelConfig
        );

        console.log(modelResponse, '模型决策');


        // 解析JSON响应
        let decision;
        try {
            decision = JSON.parse(modelResponse);
        } catch (error) {
            // 解析失败时使用默认决策
            decision = { next_state: next_states[0], reason: '模型响应解析失败' };
        }

        // 验证状态有效性
        if (!next_states.includes(decision.next_state)) {
            decision.next_state = 'planning';
            decision.reason += ' (无效状态)';
        }

        return this.setNextState(decision.next_state, `模型决策: ${decision.reason}`);
    }

    private setNextState(next_state: string, reason: string): string {
        const validStates = ['planning', 'action', 'review', 'evaluation', 'complete'];
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
