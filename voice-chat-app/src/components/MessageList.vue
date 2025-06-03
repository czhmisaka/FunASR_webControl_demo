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
          <div class="message-content">{{ msg.text }}</div>
          <div
            v-if="msg.duration"
            class="duration"
          >{{ formatDuration(msg.duration) }}</div>
        </div>
      </div>

      <!-- 独立消息 -->
      <div
        v-else
        :class="['message', `type-${item.type}`]"
      >
        <div class="message-content">{{ item.messages[0].text }}</div>
        <div
          v-if="item.messages[0].duration"
          class="duration"
        >{{ formatDuration(item.messages[0].duration) }}</div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { watch, nextTick, ref } from "vue";

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
  flex-flow: column;
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
.message-content {
  padding: 4px 12px;
  border-radius: 18px;
  width: calc(100% - 20px);
  font-size: 14px;
  line-height: 1.5;
  background: #f8f9fa;
}

.type-user .message-content {
  background: linear-gradient(to bottom right, #4e54c8, #8f94fb);
  color: white;
  border-bottom-right-radius: 0;
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
  margin-top: 4px;
  text-align: right;
  padding-right: 8px;
}

.type-user .duration {
  text-align: right;
  background: gray;
  color: white;
}

.type-ai .duration,
.type-info .duration,
.type-instruction .duration,
.type-error .duration {
  text-align: left;
}

.type-error .message-content {
  background: #ffebee;
  color: #d93025;
}
</style>
