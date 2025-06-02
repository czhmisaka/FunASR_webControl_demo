<template>
  <div class="home-container">
    <!-- 消息显示区域 -->
    <div class="messages">
      <div
        v-for="(msg, index) in messages"
        :key="index"
        :class="['message', `message-${msg.type}`]"
      >
        <div class="message-header">
          <div
            class="avatar"
            :class="`avatar-${msg.type}`"
          >
            <i
              v-if="msg.type === 'user'"
              class="el-icon-user"
            ></i>
            <i
              v-else-if="msg.type === 'ai'"
              class="el-icon-robot"
            ></i>
            <i
              v-else
              class="el-icon-info"
            ></i>
          </div>
          <div class="message-content">{{ msg.text }}</div>
        </div>
      </div>
    </div>

    <!-- 模型指令绘制区域 -->

    <!-- 底部输入区域 -->
    <div class="
      input-area">
      <el-input
        v-model="inputText"
        placeholder="请输入内容"
        @keyup.enter="sendMessage"
        class="input-box"
      />
      <el-button
        type="primary"
        @click="startSpeechRecognition"
        class="voice-btn"
      >
        <i class="el-icon-microphone"></i>
      </el-button>
    </div>
  </div>
  <div
    id="model-instructions"
    class="model-instructions"
  >

  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount } from "vue";
import axios from "axios";
import Recorder from "recorder-core";
// 导入PCM编码器
import "recorder-core/src/engine/pcm";

const inputText = ref("");
const messages = ref<{ text: string; type: string }[]>([]);
const isRecording = ref(false);
const status = ref("idle");
let recognition: WebSocket | null = null;
let recorder: any = null;
let audioContext: AudioContext | null = null;

const default_prompt = `
当你判断用户只是普通聊天，那就用简短的回答回应用户即可。
当你判断需要进行页面元素操作时，请严格按照以下 JSON 格式输出操作指令，确保语法正确且字段完整：
{
"type": "操作类型", // 可选值：dom/create（创建元素）、dom/modify（修改元素）、dom/delete（删除元素）
"payload": {
"tag": "元素标签名", // 例如 div、span、button，create 类型必填
"attrs": {"属性名": "属性值", ...}, // 元素属性，无属性时留空对象 {}
"content": "元素内容", // 文本内容或 HTML 片段，create 类型必填，query 类型用于返回结果
"selector": "选择器", // 用于 modify/delete/query 类型，格式如.class、#id、element 标签名
"modifications": {"属性修改": "新值", ...} //modify 类型必填，指定需要修改的属性及值
}
}

注意事项：

type 字段必须从可选值中选择，严禁自定义（如错误写成 "dom-create"）
payload 字段必填规则：
dom/create：必须包含 tag、content，attrs 可选（如 {style: "color: red"}）
dom/modify：必须包含 selector、modifications（如 {textContent: "新文本"}）
dom/delete：必须包含 selector（如 #footer 或 div.container）
dom/query：必须包含 selector，查询结果通过 content 字段返回
严格遵循 JSON 语法规范：
所有字符串使用双引号包裹（如 "div" 而非 'div'）
键名必须与示例完全一致（如 modifications 而非 modification）
禁止出现注释、多余逗号或非 JSON 格式内容
选择器规范：
支持 CSS 选择器语法（如 [href^="http"] 匹配链接）
确保选择器唯一性（避免修改 / 删除多个元素时出错）`;

// 清理资源
onBeforeUnmount(() => {
  stopRecording();
});

const sendMessage = async () => {
  if (!inputText.value.trim()) return;

  // 添加用户消息
  messages.value.push({ text: inputText.value, type: "user" });
  const userMessage = inputText.value;
  inputText.value = "";

  try {
    // 获取已有的元素
    const elements = document.querySelectorAll("#model-instructions");
    console.log(elements, "elements");
    const check1 = await axios.post(
      "http://127.0.0.1:1234/v1/chat/completions",
      {
        model: "qwen3-0.6b",
        messages: [
          {
            role: "system",
            content: `请判断如下语句中是否存在对页面元素的操作？只输出 是 或者 否，不要输出其余任何内容`,
          },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: -1,
        stream: false,
      }
    );
    const check_result =
      check1.data.choices[0].message.content.indexOf("是") !== -1;

    // 发送消息到LMStudio (添加请求头和完整参数)
    const response = await axios.post(
      "http://192.168.31.125:1234/v1/chat/completions",
      {
        model: "qwen3-8b",
        messages: [
          {
            role: "system",
            content: default_prompt,
          },
          {
            role: "user",
            content: check_result
              ? `当前页面内容为【${queryElement()}】

              ` + userMessage
              : userMessage,
          },
        ],
        temperature: 0.7,
        max_tokens: -1,
        stream: false,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // 添加AI回复
    const aiResponse = response.data.choices[0].message.content;
    messages.value.push({ text: aiResponse, type: "ai" });

    // 处理可能的指令
    handleInstructions(aiResponse);
  } catch (error) {
    console.error("请求失败:", error);
    messages.value.push({ text: "请求失败，请稍后再试", type: "error" });
  }
};

const startSpeechRecognition = async () => {
  if (isRecording.value) {
    stopRecording();
    return;
  }

  try {
    status.value = "recording";
    isRecording.value = true;
    messages.value.push({ text: "正在录音...", type: "info" });

    // 初始化AudioContext
    audioContext = new AudioContext();

    // 处理AudioContext挂起状态
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
      recognition?.send(JSON.stringify(config));
    };

    recognition.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(data, "接收到的消息:");
        if (data.mode == "2pass-online") {
          inputText.value = data.text;
        } else if (data.mode == "2pass-offline") {
          if (data.text) {
            inputText.value = data.text;
            // 自动发送识别结果
            sendMessage();
          }
        }
      } catch (err) {
        console.error("解析消息失败:", err);
      }
    };

    recognition.onerror = (error) => {
      console.error("WebSocket错误:", error);
      messages.value.push({ text: "语音识别连接失败", type: "error" });
      stopRecording();
    };

    // 初始化Recorder
    recorder = Recorder({
      type: "pcm",
      bitRate: 16,
      sampleRate: 16000,
      onProcess: (
        buffers: any[],
        _powerLevel: number, // 使用下划线表示未使用
        _duration: number, // 使用下划线表示未使用
        sampleRate: number
      ) => {
        if (!recognition || recognition.readyState !== WebSocket.OPEN) return;

        // 转换采样率 48k -> 16k
        const data_48k = buffers[buffers.length - 1];
        const array_48k = new Array(data_48k);
        const data_16k = Recorder.SampleData(array_48k, sampleRate, 16000).data;

        recognition.send(new Int16Array(data_16k));
      },
    });

    // 确保PCM编码器已加载
    if (!Recorder.Support()) {
      messages.value.push({ text: "浏览器不支持录音功能", type: "error" });
      stopRecording();
      return;
    }

    // 开始录音
    recorder.open(
      () => {
        recorder.start();
      },
      (err: Error) => {
        console.error("录音启动失败:", err);
        messages.value.push({ text: "录音启动失败", type: "error" });
        stopRecording();
      }
    );
  } catch (error) {
    console.error("语音识别初始化失败:", error);
    messages.value.push({ text: "语音识别初始化失败", type: "error" });
    stopRecording();
  }
};

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
};

const handleInstructions = (response: string) => {
  const container = document.getElementById("model-instructions");
  if (!container) {
    messages.value.push({
      text: "找不到#model-instructions容器",
      type: "error",
    });
    return;
  }

  try {
    const instruction = JSON.parse(response);

    // 验证指令基本结构
    if (!instruction.type || !instruction.payload) {
      throw new Error("无效指令格式：缺少type或payload");
    }

    switch (instruction.type) {
      case "dom/create":
        createElement(container, instruction.payload);
        messages.value.push({ text: "创建元素成功", type: "info" });
        break;
      case "dom/modify":
        modifyElement(container, instruction.payload);
        messages.value.push({ text: "修改元素成功", type: "info" });
        break;
      case "dom/delete":
        deleteElement(container, instruction.payload);
        messages.value.push({ text: "删除元素成功", type: "info" });
        break;
      // case "dom/query":
      //   queryElement(container, instruction.payload);
      //   messages.value.push({ text: "查询元素成功", type: "info" });
      //   break;
      default:
        throw new Error(`未知指令类型: ${instruction.type}`);
    }
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "无效JSON指令";
    messages.value.push({ text: `指令解析失败: ${errorMsg}`, type: "error" });
    console.error("指令处理错误:", e);
  }
};

// 创建元素
const createElement = (container: HTMLElement, payload: any) => {
  if (!payload.tag) {
    throw new Error("创建元素缺少必要参数: tag");
  }

  const element = document.createElement(payload.tag);

  // 设置属性
  if (payload.attrs) {
    for (const [key, value] of Object.entries(payload.attrs)) {
      element.setAttribute(key, value as string);
    }
  }

  // 如果没有提供ID，生成一个默认ID
  if (!element.id) {
    element.id = `element-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }

  // 设置内容
  if (typeof payload.content === "string") {
    element.textContent = payload.content;
  } else {
    element.innerHTML = payload.content;
  }

  container.appendChild(element);
};

// 修改元素
const modifyElement = (container: HTMLElement, payload: any) => {
  if (!payload.selector || !payload.modifications) {
    throw new Error("修改元素缺少必要参数: selector或modifications");
  }

  const element = container.querySelector(payload.selector);
  if (!element) throw new Error(`找不到元素: ${payload.selector}`);

  // 应用修改
  for (const [key, value] of Object.entries(payload.modifications)) {
    if (key === "class") {
      element.className = value as string;
    } else if (key === "style") {
      element.style = value as string;
    } else {
      (element as any)[key] = value;
    }
  }
};

// 删除元素
const deleteElement = (container: HTMLElement, payload: any) => {
  if (!payload.selector) {
    throw new Error("删除元素缺少必要参数: selector");
  }

  const element = container.querySelector(payload.selector);
  if (!element) throw new Error(`找不到元素: ${payload.selector}`);

  element.remove();
};

// 查询元素 // 查询 #model-instructions 容器中的元素信息
const queryElement = () => {
  const container = document.getElementById("model-instructions");
  if (!container) {
    messages.value.push({
      text: "找不到#model-instructions容器",
      type: "error",
    });
    return;
  }
  const elements = container.childNodes;
  if (elements.length === 0) {
    messages.value.push({ text: "容器中没有元素", type: "info" });
    return;
  }
  // 转换 elements 数组为 array
  const elementsArray = Array.from(elements) as any[];

  // 收集元素信息
  const results = elementsArray
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      id: el.id,
      classes: el.className,
      attributes: (() => {
        const attrs: Record<string, string> = {};
        for (let i = 0; i < el.attributes.length; i++) {
          const attr = el.attributes[i];
          attrs[attr.name] = attr.value || "";
        }
        return attrs;
      })(),
    }))
    .map((el) => JSON.stringify(el, null, 2));

  return results;
};
</script>

<style scoped>
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

.messages {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.message {
  margin-bottom: 15px;
  max-width: 80%;
  display: flex;
}

.message-header {
  display: flex;
  align-items: flex-start;
}

.message-user {
  align-self: flex-end;
}

.message-ai {
  align-self: flex-start;
}

.message-info,
.message-error {
  align-self: center;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
  flex-shrink: 0;
}

.avatar-user {
  background: linear-gradient(to bottom right, #4e54c8, #8f94fb);
  color: white;
}

.avatar-ai {
  background: linear-gradient(to bottom right, #f5f7fa, #e4e7eb);
  color: #333;
}

.avatar-info {
  background: #e6f7ff;
  color: #1890ff;
}

.avatar-error {
  background: #fff1f0;
  color: #f5222d;
}

.message-content {
  padding: 10px 15px;
  border-radius: 18px;
  line-height: 1.5;
}

.message-user .message-content {
  background: linear-gradient(to bottom right, #4e54c8, #8f94fb);
  color: white;
  border-bottom-right-radius: 0;
}

.message-ai .message-content {
  background: #f0f0f0;
  color: #333;
  border-bottom-left-radius: 0;
}

.message-info .message-content {
  background: #e6f7ff;
  color: #1890ff;
}

.message-error .message-content {
  background: #fff1f0;
  color: #f5222d;
}

.input-area {
  display: flex;
  padding: 10px;
  background: #fff;
  border-top: 1px solid #eee;
}

.input-box {
  flex: 1;
  margin-right: 10px;
}

.voice-btn {
  width: 40px;
}
</style>
