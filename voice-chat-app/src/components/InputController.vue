<!--
 * @Date: 2025-06-03 17:18:50
 * @LastEditors: CZH
 * @LastEditTime: 2025-06-05 05:43:20
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
  "在页面上创建5个随机渐变色的方块，并且用绝对定位分布在不同的页面位置"
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
