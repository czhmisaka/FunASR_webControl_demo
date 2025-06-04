### 动态多Agent工作流系统提示词与设计


#### 一、系统交互提示词设计
##### 1. 用户输入解析提示词
```plaintext
### 用户意图解析引擎指令
- 输入：用户自然语言请求（支持中文/英文，可包含文件路径/参数说明）
- 输出：结构化任务描述（JSON格式），需包含：
  - 任务核心意图（如"数据分析"、"文档生成"）
  - 关键参数（如时间范围、输出格式、数据来源）
  - 隐含需求（如"紧急"标识优先级，"可视化"要求图表输出）
  - 约束条件（如数据安全级别、合规要求）
  
示例输入："帮我分析2024年Q3电商销售数据，生成包含趋势图的PPT报告，明天开会要用！"
示例输出：
{
  "intent": "generate_analysis_report",
  "params": {
    "time_range": "2024Q3",
    "data_source": "ecommerce_sales",
    "output_format": "ppt",
    "include_visualization": true
  },
  "priority": "high",
  "deadline": "2025-06-05 09:00"
}
```

##### 2. Agent任务分配提示词
```plaintext
### Agent任务指令模板
- 接收方：目标Agent（通过能力标签匹配）
- 任务描述：需包含子任务目标、输入数据、工具要求、输出规范
- 约束条件：执行超时时间、资源限制、质量标准

示例指令：
[DataAnalysisAgent-003]
任务目标：分析2024Q3电商销售数据中的用户购买行为
输入数据：/data/raw/sales_2024q3.csv（已清洗）
工具要求：使用Python数据分析库（pandas, matplotlib）
输出规范：
1. 生成用户购买频次分布图表
2. 提取Top10热销商品列表
3. 输出格式：JSON+PNG图表
执行限制：内存占用≤2GB，超时时间30分钟
```

##### 3. 工具调用提示词
```plaintext
### MCP工具调用指令
- 工具类型：明确工具功能（如SQL查询、Python脚本、API调用）
- 输入参数：结构化参数（需符合工具接口规范）
- 安全限制：数据访问范围、操作权限边界
- 输出期望：结果格式、验证规则

示例调用：
[SQLQueryTool]
查询语句：
SELECT product_id, SUM(quantity) as total_sales
FROM sales_data
WHERE time_period = '2024Q3'
GROUP BY product_id
ORDER BY total_sales DESC
LIMIT 10

安全限制：
- 仅允许访问sales_data表的product_id和quantity字段
- 结果集大小限制：最多返回1000条记录

输出验证：
- 检查返回字段是否包含product_id和total_sales
- 验证数值类型是否正确
- 确保结果按销量降序排列
```


#### 二、核心组件伪代码设计
##### 1. Supervisor主控制类伪代码
```python
class Supervisor:
    def __init__(self):
        # 初始化核心模块
        self.task_manager = TaskManager()  # 任务管理模块
        self.agent_registry = AgentRegistry()  # Agent注册中心
        self.tool_scheduler = ToolScheduler()  # 工具调度器
        self.state_machine = StateMachine()  # 状态机引擎
        self.logger = SystemLogger()  # 系统日志
        
    def process_user_input(self, user_input):
        """处理用户输入并生成任务"""
        # 1. 解析用户意图
        task = self._parse_user_intent(user_input)
        self.logger.log(f"接收任务: {task['intent']}")
        
        # 2. 任务合法性校验
        if not self._validate_task(task):
            return {"status": "error", "message": "任务参数不完整"}
        
        # 3. 存入任务队列
        self.task_manager.add_task(task)
        return {"status": "success", "task_id": task["task_id"]}
    
    def run_workflow(self, task_id):
        """执行完整工作流流程"""
        task = self.task_manager.get_task(task_id)
        if not task:
            return {"status": "error", "message": "任务不存在"}
        
        try:
            # 状态机驱动四模式循环
            while not self.state_machine.is_complete(task):
                current_state = self.state_machine.get_current_state(task)
                
                if current_state == "planning":
                    self._execute_planning_mode(task)
                elif current_state == "action":
                    self._execute_action_mode(task)
                elif current_state == "checking":
                    self._execute_checking_mode(task)
                elif current_state == "evaluating":
                    self._execute_evaluating_mode(task)
                
                # 状态切换
                self.state_machine.transition(task)
            
            # 任务完成，返回结果
            return {"status": "success", "result": task["final_result"]}
            
        except Exception as e:
            self.logger.error(f"任务执行失败: {str(e)}", task_id)
            return {"status": "error", "message": str(e)}
    
    def dynamic_agent_management(self, task, action):
        """动态管理Agent实例"""
        if action == "create":
            # 根据任务需求创建新Agent
            agent_type = self._determine_agent_type(task)
            new_agent = self.agent_registry.create_agent(agent_type)
            self.logger.log(f"创建新Agent: {new_agent.agent_id}", task["task_id"])
            return new_agent
        
        elif action == "destroy":
            # 销毁空闲Agent
            idle_agents = self.agent_registry.get_idle_agents()
            for agent in idle_agents:
                self.agent_registry.destroy_agent(agent.agent_id)
                self.logger.log(f"销毁空闲Agent: {agent.agent_id}", task["task_id"])
```

##### 2. 状态机引擎伪代码
```python
class StateMachine:
    def __init__(self):
        self.states = ["planning", "action", "checking", "evaluating"]
        self.transition_rules = {
            "planning": ["action"],
            "action": ["checking", "planning"],  # 失败时回退到规划
            "checking": ["evaluating"],
            "evaluating": ["action", "planning", "complete"]  # 决策后可能继续行动或重新规划
        }
    
    def initialize_task(self, task):
        """初始化任务状态"""
        task["current_state"] = "planning"
        task["state_history"] = [{"state": "planning", "time": get_current_time()}]
        return task
    
    def get_current_state(self, task):
        """获取任务当前状态"""
        return task.get("current_state", "planning")
    
    def is_complete(self, task):
        """判断任务是否完成"""
        return task.get("current_state") == "complete"
    
    def transition(self, task):
        """执行状态转换"""
        current_state = self.get_current_state(task)
        next_states = self.transition_rules[current_state]
        
        # 根据评价结果选择下一个状态
        if current_state == "evaluating":
            evaluation_result = task.get("evaluation_result", {})
            if evaluation_result.get("is_success", False):
                next_state = "complete" if self._all_tasks_completed(task) else "action"
            else:
                next_state = "planning"  # 失败则重新规划
        else:
            # 按默认规则选择下一个状态
            next_state = next_states[0]  # 简化处理，实际需更复杂逻辑
        
        # 记录状态转换
        task["current_state"] = next_state
        task["state_history"].append({
            "state": next_state,
            "time": get_current_time(),
            "transition_reason": self._get_transition_reason(task, next_state)
        })
        return next_state
    
    def _all_tasks_completed(self, task):
        """检查所有子任务是否完成"""
        subtasks = task.get("subtasks", [])
        return all(subtask.get("status") == "completed" for subtask in subtasks)
```

##### 3. Agent执行单元伪代码
```python
class Agent:
    def __init__(self, agent_id, agent_type, capabilities):
        self.agent_id = agent_id
        self.agent_type = agent_type
        self.capabilities = capabilities  # 能力标签列表
        self.status = "idle"
        self.current_task = None
        self.tool_set = ToolSet()  # 绑定的工具集合
        self.resource_usage = {"cpu": 0, "memory": 0}
    
    def receive_task(self, task_instruction):
        """接收任务指令"""
        if not self._can_handle_task(task_instruction):
            return {"status": "failed", "message": "能力不匹配"}
        
        self.status = "busy"
        self.current_task = task_instruction
        self.resource_usage = {"cpu": 10, "memory": 512}  # 模拟资源占用
        return {"status": "accepted", "agent_id": self.agent_id}
    
    def execute_task(self):
        """执行分配的任务"""
        if not self.current_task:
            return {"status": "error", "message": "无待执行任务"}
        
        try:
            # 1. 解析任务指令
            tool_id = self.current_task.get("tool_id")
            tool_params = self.current_task.get("tool_params", {})
            
            # 2. 调用MCP工具
            tool = self.tool_set.get_tool(tool_id)
            if not tool:
                return {"status": "error", "message": f"工具 {tool_id} 不存在"}
            
            result = tool.execute(tool_params)
            
            # 3. 封装任务结果
            task_result = {
                "task_id": self.current_task.get("task_id"),
                "subtask_id": self.current_task.get("subtask_id"),
                "agent_id": self.agent_id,
                "result": result,
                "execution_time": get_current_time(),
                "status": "completed"
            }
            
            # 4. 重置Agent状态
            self.current_task = None
            self.status = "idle"
            self.resource_usage = {"cpu": 0, "memory": 0}
            
            return task_result
            
        except Exception as e:
            self.status = "idle"
            return {
                "status": "failed",
                "message": f"任务执行失败: {str(e)}",
                "error_details": traceback.format_exc()
            }
    
    def _can_handle_task(self, task_instruction):
        """判断是否能处理该任务"""
        required_capabilities = task_instruction.get("required_capabilities", [])
        return all(cap in self.capabilities for cap in required_capabilities)
```

##### 4. 工具调度器伪代码
```python
class ToolScheduler:
    def __init__(self):
        self.tools = {}  # 工具注册表
        self.security_policy = SecurityPolicy()  # 安全策略
        
    def register_tool(self, tool_id, tool_instance):
        """注册MCP工具"""
        if tool_id in self.tools:
            raise ValueError(f"工具 {tool_id} 已存在")
        
        self.tools[tool_id] = tool_instance
        return {"status": "success", "tool_id": tool_id}
    
    def get_tool(self, tool_id):
        """获取工具实例"""
        return self.tools.get(tool_id)
    
    def execute_tool(self, tool_id, params, agent_id):
        """安全执行工具"""
        # 1. 权限验证
        if not self.security_policy.can_access_tool(agent_id, tool_id):
            return {"status": "forbidden", "message": "无工具访问权限"}
        
        # 2. 参数安全检查
        sanitized_params = self.security_policy.sanitize_params(tool_id, params)
        if not sanitized_params.get("valid"):
            return {"status": "error", "message": sanitized_params.get("error")}
        
        # 3. 资源限制检查
        resource_limit = self.security_policy.get_resource_limit(tool_id)
        if not self._check_resource_limit(resource_limit):
            return {"status": "error", "message": "资源限制超出"}
        
        # 4. 执行工具
        tool = self.get_tool(tool_id)
        if not tool:
            return {"status": "error", "message": f"工具 {tool_id} 不存在"}
        
        try:
            # 记录工具调用日志
            self._log_tool_invocation(tool_id, agent_id, sanitized_params.get("params"))
            
            # 执行工具（带超时控制）
            result = tool.execute(sanitized_params.get("params"), timeout=resource_limit.get("timeout", 60))
            return {"status": "success", "result": result}
            
        except TimeoutError:
            return {"status": "error", "message": "工具执行超时"}
        except Exception as e:
            return {"status": "error", "message": f"工具执行失败: {str(e)}"}
    
    def _check_resource_limit(self, resource_limit):
        """检查资源限制"""
        # 实际实现中需监控系统资源使用情况
        current_cpu = get_system_cpu_usage()
        current_memory = get_system_memory_usage()
        
        return (current_cpu < resource_limit.get("cpu_limit", 90) and
                current_memory < resource_limit.get("memory_limit", 80))
```


#### 三、工作流执行伪代码流程
##### 1. 完整工作流执行流程伪代码
```python
# 工作流主流程
def run_workflow_supervisor(user_input):
    # 1. 初始化Supervisor
    supervisor = Supervisor()
    
    # 2. 处理用户输入
    task = supervisor.process_user_input(user_input)
    if task.get("status") != "success":
        return task
    
    task_id = task.get("task_id")
    
    # 3. 执行工作流
    result = supervisor.run_workflow(task_id)
    
    # 4. 清理资源（可选）
    supervisor.dynamic_agent_management(task_id, "destroy")
    
    return result

# 示例调用
user_request = "分析2024年Q3电商销售数据，生成包含趋势图的PPT报告，明天开会要用！"
workflow_result = run_workflow_supervisor(user_request)

# 输出结果
if workflow_result.get("status") == "success":
    print(f"任务完成！结果存储于: {workflow_result.get('result').get('file_path')}")
else:
    print(f"任务失败: {workflow_result.get('message')}")
```

##### 2. 四模式切换核心伪代码
```python
# 规划模式执行
def _execute_planning_mode(self, task):
    # 1. 任务分解
    subtasks = self._decompose_task(task)
    task["subtasks"] = subtasks
    
    # 2. 为每个子任务分配Agent和工具
    for subtask in subtasks:
        # 匹配Agent
        agent = self.dynamic_agent_management(task, "create")
        subtask["agent_id"] = agent.agent_id
        
        # 匹配工具
        tool = self.tool_scheduler.get_tool(subtask["required_tool"])
        subtask["tool_id"] = tool.tool_id
        
        # 生成任务指令
        subtask["instruction"] = self._generate_task_instruction(subtask)
    
    # 3. 记录规划结果
    task["planning_result"] = {
        "subtask_count": len(subtasks),
        "agent_usage": self.agent_registry.get_agent_usage(),
        "tool_usage": [subtask["tool_id"] for subtask in subtasks]
    }

# 行动模式执行
def _execute_action_mode(self, task):
    # 1. 获取待执行子任务
    pending_subtasks = [st for st in task["subtasks"] if st["status"] == "pending"]
    
    for subtask in pending_subtasks:
        # 2. 发送任务指令给Agent
        agent = self.agent_registry.get_agent(subtask["agent_id"])
        if not agent:
            # Agent不存在，重新分配
            agent = self.dynamic_agent_management(task, "create")
            subtask["agent_id"] = agent.agent_id
        
        instruction = subtask["instruction"]
        agent_response = agent.receive_task(instruction)
        
        # 3. 执行任务
        if agent_response.get("status") == "accepted":
            task_result = agent.execute_task()
            subtask["status"] = task_result.get("status")
            subtask["result"] = task_result.get("result")
        else:
            subtask["status"] = "failed"
            subtask["error"] = agent_response.get("message")

# 检查模式执行
def _execute_checking_mode(self, task):
    # 1. 获取已完成子任务
    completed_subtasks = [st for st in task["subtasks"] if st["status"] == "completed"]
    
    for subtask in completed_subtasks:
        # 2. 验证任务结果
        validation_result = self._validate_subtask_result(subtask)
        subtask["validation"] = validation_result
        
        # 3. 记录检查结果
        if validation_result.get("is_valid", False):
            subtask["check_status"] = "passed"
        else:
            subtask["check_status"] = "failed"
            subtask["validation_errors"] = validation_result.get("errors", [