<template>
  <div class="home-container">
    <!-- 消息显示区域 -->
    <MessageList :grouped-messages="groupedMessages" />

    <!-- 目标输入区域 -->
    <!-- <div class="goal-input-area">
      <input
        v-model="goalText"
        placeholder="请输入目标指令"
        @keyup.enter="executeGoal"
      />
      <button @click="executeGoal">执行目标</button>
    </div> -->

    <!-- 底部输入区域 -->
    <InputController
      v-model="inputText"
      @send="handleManualSend"
      @start-recording="startSpeechRecognition"
      @open-config="openConfigDialog"
    />

    <!-- 模型配置对话框 -->
    <ModelConfigDialog
      :visible="configDialogVisible"
      :config="modelConfig"
      @update:visible="configDialogVisible = $event"
      @save="saveModelConfig"
    />
  </div>

  <!-- 模型指令绘制区域 -->
  <div
    id="model-instructions"
    class="model-instructions"
  >
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount, computed, onMounted } from "vue";
import { modelEngineService } from "../modelEngin/modelEngineService";
import Recorder from "recorder-core";
import MessageList from "../components/MessageList.vue";
import InputController from "../components/InputController.vue";
import ModelConfigDialog from "../components/ModelConfigDialog.vue";
import {
  handleInstructions as handleDomInstructions,
  queryElement,
} from "../modelEngin/domOperations";

// 导入PCM编码器
import "recorder-core/src/engine/pcm";

const inputText = ref("");
const messages = ref<{ text: string; type: string; duration?: number }[]>([]);
const isRecording = ref(false);
const inputMode = ref<"manual" | "voice">("manual");
const status = ref("idle");
const configDialogVisible = ref(false);
const modelConfig = ref({
  url: "",
  model: "",
  apiKey: "",
});

interface MessageGroup {
  type: string;
  messages: { text: string; type: string; duration?: number }[];
}

// 消息分组计算属性
// 获取代理消息
const agentMessages = computed(() => {
  return modelEngineService.getAgentMessages();
});

// 合并用户消息和代理消息
const allMessages = computed(() => {
  return [...messages.value, ...agentMessages.value];
});

const groupedMessages = computed<MessageGroup[]>(() => {
  const result: MessageGroup[] = [];
  let currentGroup: MessageGroup | null = null;

  for (const msg of allMessages.value) {
    if (msg.type === "user") {
      if (currentGroup) {
        result.push(currentGroup);
        currentGroup = null;
      }
      result.push({
        type: msg.type,
        messages: [msg],
      });
      continue;
    }

    if (currentGroup) {
      currentGroup.messages.push(msg);
    } else {
      currentGroup = {
        type: "combined",
        messages: [msg],
      };
    }
  }

  if (currentGroup) {
    result.push(currentGroup);
  }

  return result;
});

let recognition: WebSocket | null = null;
let recorder: any = null;
let audioContext: AudioContext | null = null;

// 清理资源
onBeforeUnmount(() => {
  stopRecording();
});

// 初始化模型配置
onMounted(() => {
  loadModelConfig();
});

// 加载模型配置
const loadModelConfig = () => {
  const savedConfig = localStorage.getItem("modelConfig");
  if (savedConfig) {
    try {
      modelConfig.value = JSON.parse(savedConfig);
    } catch (e) {
      console.error("配置解析失败，使用默认配置", e);
      setDefaultConfig();
    }
  } else {
    setDefaultConfig();
  }
};

// 设置默认配置
const setDefaultConfig = () => {
  modelConfig.value = {
    url: "http://127.0.0.1:1234/v1/chat/completions",
    model: "qwen/qwen3-8b", // 使用正确的模型名称格式
    apiKey: "",
  };
  localStorage.setItem("modelConfig", JSON.stringify(modelConfig.value));
};

// 打开配置对话框
const openConfigDialog = () => {
  configDialogVisible.value = true;
};

// 保存模型配置
const saveModelConfig = (e: any) => {
  localStorage.setItem("modelConfig", JSON.stringify(e));
  configDialogVisible.value = false;
  messages.value.push({
    text: "模型配置已更新",
    type: "info",
  });
};

// 执行目标指令
const executeGoal = async (goalText: string) => {
  if (!goalText.trim()) return;

  try {
    messages.value.push({
      text: `开始执行目标: ${goalText}`,
      type: "info",
    });
    const that = this;
    await modelEngineService.executeUserGoal(goalText, that);

    messages.value.push({
      text: `目标执行完成: ${goalText}`,
      type: "success",
    });
  } catch (error: any) {
    messages.value.push({
      text: `目标执行失败: ${error.message || error}`,
      type: "error",
    });
  } finally {
    goalText = "";
  }
};

// 发送文本消息
const sendTextMessage = async (text: string) => {
  if (!text.trim()) return;

  messages.value.push({ text, type: "user" });
  const userMessage = text;
  // 判断要求复杂性
  const isComplex = await modelEngineService.judgeUserInput(
    text,
    "这个要求可以用一条 单个元素生成、单个元素编辑、单个元素删除指令来完成吗？"
  );

  if (isComplex) {
    // 发送请求
    try {
      // 获取页面内容
      const container = document.getElementById("model-instructions");
      const pageContent = container ? queryElement(container).join("\n") : "";
      if (pageContent) {
        messages.value.push({
          text: `容器中有${pageContent.split("\n").length}个元素`,
          type: "success",
        });
      } else {
        messages.value.push({
          text: "容器中没有元素",
          type: "warning",
        });
      }
      // 发送到模型引擎
      const response = await modelEngineService.executeModelInstruction(
        userMessage,
        "action",
        modelConfig.value
      );

      let aiResponse = "";
      let duration = 0;
      let aiType = "info";

      if (response) {
        aiResponse =
          typeof response === "string" ? response : JSON.stringify(response);
        aiType = aiResponse.includes("dom/") ? "instruction" : "ai";
      } else if (response.error) {
        aiResponse = response.error;
        aiType = "error";
      }

      if (response.duration) {
        duration = response.duration;
      }
      messages.value.push({
        text: response,
        type: aiType,
        duration,
      });

      // 处理可能的指令并添加成功提示
      if (container && aiType == "instruction") {
        const instructionSuccess = handleDomInstructions(response, container);
        if (instructionSuccess) {
          try {
            const instruction = JSON.parse(response);
            const actionType = instruction.type.replace("dom/", "");
            messages.value.push({
              text: `指令执行成功：完成${actionType}操作`,
              type: "success",
            });
          } catch {
            messages.value.push({
              text: "指令执行成功",
              type: "success",
            });
          }
        }
      }
    } catch (error: any) {
      console.error("请求失败:", error);
      messages.value.push({
        text: error.message || "请求失败，请稍后再试",
        type: "error",
      });
    }
  } else {
    executeGoal(text);
  }
};

// 发送语音消息
const sendVoiceMessage = (text: string) => {
  sendTextMessage(text);
};

// 处理手动发送消息
const handleManualSend = (e: string) => {
  if (!e.trim()) return;
  console.log("手动发送消息:", e);
  inputMode.value = "manual";
  sendTextMessage(e);
  inputText.value = "";
};

// 开始语音识别
const startSpeechRecognition = async () => {
  if (isRecording.value) {
    stopRecording();
    return;
  }

  try {
    status.value = "recording";
    isRecording.value = true;
    messages.value.push({ text: "正在录音...", type: "info" });
    inputMode.value = "voice";

    // 添加30秒超时自动停止
    const timeoutId = setTimeout(() => {
      if (isRecording.value) {
        messages.value.push({ text: "录音超时自动停止", type: "warning" });
        stopRecording();
      }
    }, 30000);

    // 初始化AudioContext
    audioContext = new AudioContext();
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    // 创建WebSocket连接
    recognition = new WebSocket("ws://127.0.0.1:10096");

    recognition.onopen = () => {
      const config = {
        chunk_size: [5, 10, 5],
        wav_name: "h5",
        is_speaking: true,
        chunk_interval: 10,
        mode: "2pass",
      };
      recognition!.send(JSON.stringify(config));
      clearTimeout(timeoutId);
    };

    recognition.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.mode == "2pass-online") {
          inputText.value = data.text;
        } else if (data.mode == "2pass-offline" && data.text) {
          sendVoiceMessage(data.text);
        }
      } catch (err) {
        console.error("解析消息失败:", err);
      }
    };

    recognition.onerror = (error) => {
      console.error("WebSocket错误:", error);
      messages.value.push({ text: "语音识别连接失败", type: "error" });
      stopRecording();
      clearTimeout(timeoutId);
    };

    // 初始化Recorder
    recorder = Recorder({
      type: "pcm",
      bitRate: 16,
      sampleRate: 16000,
      onProcess: (
        buffers: any[],
        _powerLevel: number,
        _duration: number,
        sampleRate: number
      ) => {
        if (!recognition || recognition.readyState !== WebSocket.OPEN) return;

        const data_48k = buffers[buffers.length - 1];
        const array_48k = new Array(data_48k);
        const data_16k = Recorder.SampleData(array_48k, sampleRate, 16000).data;
        recognition!.send(new Int16Array(data_16k));
      },
    });

    // 确保PCM编码器已加载
    if (!Recorder.Support()) {
      messages.value.push({ text: "浏览器不支持录音功能", type: "error" });
      stopRecording();
      clearTimeout(timeoutId);
      return;
    }

    // 开始录音
    recorder.open(
      () => recorder.start(),
      (err: Error) => {
        console.error("录音启动失败:", err);
        messages.value.push({ text: "录音启动失败", type: "error" });
        stopRecording();
        clearTimeout(timeoutId);
      }
    );
  } catch (error) {
    console.error("语音识别初始化失败:", error);
    messages.value.push({ text: "语音识别初始化失败", type: "error" });
    stopRecording();
  }
};

// 停止录音
const stopRecording = () => {
  if (recorder) {
    recorder.stop();
    try {
      recorder.stream
        ?.getTracks()
        ?.forEach((track: MediaStreamTrack) => track.stop());
    } catch (error) {}
    recorder = null;
  }

  if (recognition) {
    recognition.close();
    recognition = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  status.value = "idle";
  isRecording.value = false;
  inputMode.value = "manual";
};
</script>

<style>
.home-container {
  width: 300px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  float: left;
}

.model-instructions {
  width: calc(100% - 300px);
  height: 100vh;
  float: right;
  background: #f0f0f0;
  position: relative;
  flex-shrink: 0;
}
.model-instructions * {
  transition: all 1s ease-in-out !important;
}
</style>
