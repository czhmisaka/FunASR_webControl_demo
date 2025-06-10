<!--
 * @Date: 2025-06-03 17:18:50
 * @LastEditors: CZH
 * @LastEditTime: 2025-06-10 23:58:32
 * @FilePath: /AI编程与MCP使用/voice-chat-app/src/components/InputController.vue
-->
<template>
  <div class="input-area">
    <!-- 模型配置按钮 -->
    <el-button
      @click="openConfigDialog"
      class="config-btn"
      icon="el-icon-setting"
    />

    <el-input
      v-model="inputText"
      placeholder="请输入内容"
      @keyup.enter="sendMessage"
      class="input-box"
    />
    <el-button
      :type="isRecording?'primary':'info'"
      @click="startSpeechRecognition"
      class="voice-btn"
    >
      {{ isRecording ? "🛑" : "🎤" }}
    </el-button>
    <!-- 停止任务按钮 -->
    <el-button
      type="danger"
      @click="terminateTask"
      class="stop-btn"
      icon="el-icon-switch-button"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

defineOptions({
  name: "InputController",
});

const inputText = ref(
  "绘制一张大模型的开发架构图，要充分体现大模型开发过程的不同模块，并且限制绘制区域在 800px * 600px,绘制区域的背景色为极浅的灰色，要求美观色彩多变"
  // "绘制一幅海上生明月，蓝色的海面上有一轮明月，要有意境 颜色柔和.先创建黑夜+海面的背景，月亮要有光晕。海面上有一叶孤舟，上面有一个垂钓的人，远处有一座小岛，岛上有一座灯塔。灯塔的光芒照亮了海面，形成一道光带。整个画面要有层次感和深度感。注意不同组件之间需要考虑z-index完成层次设计。"
  // "在页面的正中间创建一个红色的方块"
);
const isRecording = ref(false);

const emit = defineEmits([
  "send",
  "start-recording",
  "open-config",
  "terminate-task",
]);

const sendMessage = () => {
  if (!inputText.value.trim()) return;
  emit("send", inputText.value);
  inputText.value = "";
};

const startSpeechRecognition = () => {
  emit("start-recording");
};

const openConfigDialog = () => {
  emit("open-config");
};

const terminateTask = () => {
  emit("terminate-task");
};
</script>

<script lang="ts">
export default {};
</script>

<style scoped>
.input-area {
  display: flex;
  padding: 10px;
  background: #fff;
  border-top: 1px solid #eee;
}

.config-btn {
  margin-right: 10px;
}

.input-box {
  flex: 1;
  margin-right: 10px;
}

.voice-btn {
  width: auto;
  padding: 0 15px;
  margin-right: 10px;
}

.stop-btn {
  background-color: #ff4d4f;
  border-color: #ff4d4f;
  color: white;
}

.stop-btn:hover {
  background-color: #ff7875;
  border-color: #ff7875;
}
</style>
