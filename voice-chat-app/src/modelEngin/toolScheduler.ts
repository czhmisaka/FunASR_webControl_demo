/**
 * 工具调度器实现
 */
import { v4 as uuidv4 } from 'uuid';
import type { ToolExecutionResult, ModelConfig, TaskDefinition } from './types';

// 任务队列管理类
class TaskQueue {
    public queue: Array<TaskDefinition> = [];
    private completedTasks: Record<string, boolean> = {};

    enqueue(task: TaskDefinition) {
        this.queue.push(task);
        this.queue.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    }

    async process() {
        while (this.queue.length > 0) {
            const task = this.queue.shift()!;

            // 检查任务依赖是否满足
            if (task.dependsOn && task.dependsOn.some(id => !this.completedTasks[id])) {
                this.enqueue(task); // 重新入队等待
                continue;
            }

            try {
                await task.execute();
                this.completedTasks[task.id] = true;
            } catch (error) {
                console.error(`任务执行失败: ${task.id}`, error);
                if (task.retryCount < 3) {
                    task.retryCount++;
                    this.enqueue(task); // 重试
                }
            }
        }
    }
}

export class ToolScheduler {
    private tools: Record<string, any> = {};
    private securityPolicy: any;
    private taskQueue = new TaskQueue();

    constructor() {
        this.securityPolicy = {
            canAccessTool: (agentId: string, toolId: string) => true,
            sanitizeParams: (toolId: string, params: any) => ({ valid: true, params }),
            getResourceLimit: (toolId: string) => ({ cpu: 90, memory: 80 })
        };
    }

    registerTool(toolId: string, toolInstance: any): void {
        if (this.tools[toolId]) {
            throw new Error(`工具 ${toolId} 已存在`);
        }
        this.tools[toolId] = toolInstance;
    }

    getTasks(): Array<TaskDefinition> {
        return this.taskQueue;
    }

    getTool(toolId: string): any {
        console.log(`当前工具列表`, this.tools);
        return this.tools[toolId];
    }

    /**
     * 直接执行工具（兼容旧逻辑）
     */
    async executeTool(toolId: string, params: any, agentId: string): Promise<ToolExecutionResult> {
        return new Promise((resolve) => {
            const task: TaskDefinition = {
                id: uuidv4(),
                priority: 'medium',
                retryCount: 0,
                execute: async () => {
                    const result = await this._executeTool(toolId, params, agentId);
                    resolve(result);
                }
            };
            this.taskQueue.enqueue(task);
        });
    }

    /**
     * 内部执行逻辑
     */
    private async _executeTool(toolId: string, params: any, agentId: string): Promise<ToolExecutionResult> {
        // [保持原有执行逻辑不变]
        // 记录工具调用开始时间
        const startTime = Date.now();

        // 1. 权限验证
        if (!this.securityPolicy.canAccessTool(agentId, toolId)) {
            return { status: 'forbidden', message: '无工具访问权限' };
        }

        // 2. 参数安全检查
        const sanitized = this.securityPolicy.sanitizeParams(toolId, params);
        if (!sanitized.valid) {
            return { status: 'error', message: sanitized.error };
        }

        // 3. 资源限制检查
        const resourceLimit = this.securityPolicy.getResourceLimit(toolId);
        if (!this.checkResourceLimit(resourceLimit)) {
            return { status: 'error', message: '资源限制超出' };
        }

        // 4. 执行工具
        const tool = this.getTool(toolId);
        console.log(`当前使用工具${toolId}`, tool)
        if (!tool) {
            return { status: 'error', message: `工具 ${toolId} 不存在` };
        }

        try {
            // 记录工具调用日志
            this.logToolInvocation(toolId, agentId, sanitized.params);

            // 执行工具（带超时控制）
            const timeout = resourceLimit.timeout || 60000;
            const rawResult = await this.executeWithTimeout(tool.execute(sanitized.params), timeout);
            console.log(`工具原始执行结果:`, rawResult);

            // 将结果包装为 ToolExecutionResult 格式
            return {
                status: 'success',
                result: rawResult,
                message: '工具执行成功'
            };
        } catch (error: any) {
            // 使用大模型分析错误
            const suggestion = await this.analyzeError(error);
            return {
                status: 'error',
                message: `工具执行失败: ${error.message}`,
                suggestion: suggestion
            };
        }
    }

    /**
     * 添加任务到队列（新API）
     */
    addTask(task: TaskDefinition) {
        this.taskQueue.enqueue(task);
    }

    /**
     * 启动队列处理
     */
    startProcessing() {
        this.taskQueue.process();
    }

    private executeWithTimeout(promise: Promise<any>, timeout: number): Promise<any> {
        return Promise.race([
            promise,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('工具执行超时')), timeout)
            )
        ]);
    }

    private checkResourceLimit(resourceLimit: any): boolean {
        // 实际实现中需监控系统资源使用情况
        // 这里简化处理，总是返回true
        return true;
    }

    private async analyzeError(error: any): Promise<string> {
        // 构建提示词
        const prompt = `分析以下错误并提供恢复建议：
错误信息: ${error.message}

返回JSON格式：
{
  "error_type": "错误分类",
  "recovery_strategy": "恢复策略",
  "suggestion": "具体建议"
}`;

        try {
            // 调用大模型分析错误
            // 注意：实际实现中需要注入modelService
            const analysis = "大模型分析结果待实现";
            return analysis;
        } catch (e) {
            return '错误分析失败';
        }
    }

    private logToolInvocation(toolId: string, agentId: string, params: any): void {
        console.log(`[Tool Invocation] Agent:${agentId} -> Tool:${toolId}, Params: ${JSON.stringify(params)}`);
    }
}
