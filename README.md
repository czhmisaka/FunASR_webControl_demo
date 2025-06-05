<!--
 * @Date: 2025-06-02 19:41:09
 * @LastEditors: CZH
 * @LastEditTime: 2025-06-05 08:33:58
 * @FilePath: /AI编程与MCP使用/voice-chat-app/README.md
-->
# Voice Chat App

基于Vue.js的语音聊天应用，集成AI模型引擎，支持语音输入和智能对话。

## 技术栈

- Vue 3 + TypeScript + Vite
- Element Plus UI框架
- Pinia状态管理
- Axios网络请求

## 功能特点

- 🎤 语音输入与识别
- 🧠 AI模型引擎集成（规划/行动/审查模式）
- 🤖 多代理协作系统
- ⚙️ 可视化状态机引擎
- 💬 实时聊天消息展示

## 安装与运行

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建生产版本
npm run build
```

## 项目结构

```
voice-chat-app/
├── src/
│   ├── modelEngin/       # AI模型引擎核心
│   │   ├── agentBase.ts     # 代理基类
│   │   ├── supervisor.ts    # 监督器
│   │   ├── stateMachine.ts  # 状态机引擎
│   │   └── ...              
│   ├── views/            # 页面视图
│   │   └── HomeView.vue    # 主界面
│   ├── components/       # 可复用组件
│   │   ├── InputController.vue  # 输入控制
│   │   ├── MessageList.vue      # 消息列表
│   │   └── ModelConfigDialog.vue # 模型配置
│   └── ...
├── public/               # 静态资源
└── screenshots/          # 应用截图
```

## 截图展示

![应用截图](screenshots/voice_chat_app_screenshot-2025-06-02T12-33-41-277Z.png)

## 配置说明

在`src/modelEngin/modelEngineService.ts`中配置模型API端点：
```typescript
this.modelConfig = {
    model: "qwen/qwen3-8b",
    url: "http://your-model-api/v1/chat/completions",
    apiKey: "your-api-key"
};
```

## 贡献指南

欢迎提交Pull Request，请确保通过ESLint检查。
