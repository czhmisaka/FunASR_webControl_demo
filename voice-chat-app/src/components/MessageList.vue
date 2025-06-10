<template>
  <div
    class="messages"
    ref="messagesContainer"
  >
    <template
      v-for="(item, index) in groupedMessages"
      :key="index"
    >
      <!-- 合并消息卡片 (AI+INFO) -->
      <div
        v-if="item.type === 'combined'"
        class="combined-card"
      >
        <div
          v-for="(msg, idx) in item.messages"
          :key="idx"
          class="message-item"
          :class="`type-${msg.type}`"
        >
          <div class="content-wrapper">
            <div class="message-content">
              {{ formatMessageContent(msg.text, msg.type) }}
            </div>
            <div
              v-if="msg.duration"
              class="duration"
            >{{ formatDuration(msg.duration) }}</div>
          </div>
        </div>
      </div>

      <!-- 独立消息 -->
      <div
        v-else
        :class="['message', `type-${item.type}`]"
      >
        <div
          class="message-icon"
          v-if="shouldShowIcon(item.type)"
        >
          <template v-if="item.type === 'info'">ℹ️</template>
          <template v-else-if="item.type === 'error'">❌</template>
          <template v-else-if="item.type === 'success'">✅</template>
          <template v-else-if="item.type === 'agent-planning'">📝</template>
          <template v-else-if="item.type === 'agent-action'">⚡</template>
          <template v-else-if="item.type === 'agent-result'">✅</template>
          <template v-else-if="item.type === 'agent-state'">🔄</template>
        </div>
        <div class="content-wrapper">
          <div class="message-content">
            {{ formatMessageContent(item.messages[0].text, item.type) }}
          </div>
          <div
            v-if="item.messages[0].duration"
            class="duration"
          >{{ formatDuration(item.messages[0].duration) }}</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { watch, nextTick, ref, onMounted } from "vue";
import { modelEngineService } from "../modelEngin/modelEngineService";

defineOptions({
  name: "MessageList",
});

const props = defineProps({
  groupedMessages: {
    type: Array as () => Array<{
      type: string;
      messages: { text: string; type: string; duration?: number }[];
    }>,
    required: true,
  },
});

const messagesContainer = ref<HTMLElement | null>(null);
const agentStates = ref<any[]>([]);

// 判断是否显示图标
const shouldShowIcon = (type: string): boolean => {
  const iconTypes = [
    "info",
    "error",
    "success",
    "agent-planning",
    "agent-action",
    "agent-result",
    "agent-state",
  ];
  return iconTypes.includes(type);
};

// 格式化消息内容
const formatMessageContent = (text: string, type: string): string => {
  // 代理状态消息特殊处理
  if (type === "agent-state") {
    return `🔄 ${text}`;
  }

  // 其他消息类型保持原样
  return text;
};

// 更新代理状态
const updateAgentStates = () => {
  try {
    const agents = modelEngineService.supervisor.getAllAgents();
    agentStates.value = agents.map((agent) => ({
      id: agent.id,
      currentMode: agent.currentMode,
      modeHistory: agent.modeHistory,
    }));
  } catch (error) {
    console.error("获取代理状态失败:", error);
    agentStates.value = [];
  }
};

// 初始加载和定期更新代理状态
onMounted(() => {
  updateAgentStates();
  setInterval(updateAgentStates, 2000);
});

// 格式化耗时显示
const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

watch(
  () => props.groupedMessages,
  async () => {
    await nextTick();
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  },
  { deep: true }
);
</script>

<script lang="ts">
export default {};
</script>

<style scoped>
.messages {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* 基础消息样式 */
.message,
.message-item {
  display: flex;
  margin-bottom: 8px;
  align-items: flex-start;
  flex-flow: row;
}

/* 类型颜色区分 */
.type-user {
  color: #1a73e8;
  align-self: flex-end;
}

.type-ai {
  color: #202124;
  align-self: flex-start;
}

.type-info {
  color: #0b8043;
  align-self: flex-start;
}

.type-error {
  color: #d93025;
  align-self: center;
}

/* 合并卡片样式 */
.combined-card {
  border: 1px solid #dadce0;
  border-radius: 12px;
  display: inline-block;
  height: auto;
  margin-bottom: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  align-self: flex-start;
  max-width: 80%;
}

.combined-card .message-item {
  padding: 8px 12px;
  margin-bottom: 0;
  border-bottom: 1px solid #f1f3f4;
}

.combined-card .message-item:last-child {
  border-bottom: none;
}

/* 消息内容样式 */
.message-icon {
  font-size: 1.2em;
  margin-right: 8px;
  margin-top: 4px;
}

.message-content {
  padding: 4px 12px;
  border-radius: 18px;
  font-size: 14px;
  line-height: 1.5;
  background: #f8f9fa;
  flex: 1;
}

.type-user .message-content {
  background: linear-gradient(to bottom right, #4e54c8, #8f94fb);
  color: white;
  border-bottom-right-radius: 0;
}

.type-success .message-content {
  background: linear-gradient(to bottom right, #34a853, #7ddbaa);
  color: white;
  border-bottom-left-radius: 0;
}

.type-ai .message-content {
  background: #ffffff;
  color: #333;
  border: 1px solid #dadce0;
  border-bottom-left-radius: 0;
}

.type-info .message-content {
  background: #e8f5e9;
  color: #0b8043;
}

/* 耗时显示样式 */
.duration {
  font-size: 0.7em;
  color: #888;
  margin-top: 2px;
}

.type-user .duration {
  background: gray;
  color: white;
}

.type-error .message-content {
  background: #ffebee;
  color: #d93025;
}
</style>
