<!--
 * @Date: 2025-06-03 17:18:50
 * @LastEditors: CZH
 * @LastEditTime: 2025-06-05 07:10:20
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
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

defineOptions({
  name: "InputController",
});

const inputText = ref(
  // "绘制一张大模型的开发架构图，要充分体现大模型开发过程的不同模块，并且限制绘制区域在 800px * 600px,绘制区域的背景色为极浅的灰色，要求美观色彩多变"
  "绘制一幅海上生明月，要有意境 颜色柔和.月亮要有光晕。"
);
const isRecording = ref(false);

const emit = defineEmits(["send", "start-recording", "open-config"]);

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
}
</style>
