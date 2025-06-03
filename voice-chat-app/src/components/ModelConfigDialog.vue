<!--
 * @Date: 2025-06-03 17:20:11
 * @LastEditors: CZH
 * @LastEditTime: 2025-06-03 17:54:03
 * @FilePath: /AI编程与MCP使用/voice-chat-app/src/components/ModelConfigDialog.vue
-->
<template>
  <el-dialog
    :model-value="visible"
    title="模型配置"
    width="30%"
    @update:model-value="$emit('update:visible', $event)"
  >
    <el-form :model="modelConfig">
      <el-form-item label="API URL">
        <el-input v-model="modelConfig.url" />
      </el-form-item>
      <el-form-item label="模型名称">
        <el-input v-model="modelConfig.model" />
      </el-form-item>
      <el-form-item label="API Key">
        <el-input
          v-model="modelConfig.apiKey"
          type="password"
          show-password
          placeholder="输入API密钥"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="cancel">取消</el-button>
      <el-button
        type="primary"
        @click="save"
      >保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { reactive, watch } from "vue";

defineOptions({
  name: "ModelConfigDialog",
});

const props = defineProps({
  visible: {
    type: Boolean,
    required: true,
  },
  config: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["update:visible", "save"]);

const modelConfig = reactive({ ...props.config });

// 监听props.config变化更新本地状态
watch(
  () => props.config,
  (newConfig) => {
    Object.assign(modelConfig, newConfig);
  },
  { deep: true, immediate: true }
);

const save = () => {
  emit("save", modelConfig);
  emit("update:visible", false);
};

const cancel = () => {
  emit("update:visible", false);
};
</script>

<script lang="ts">
export default {};
</script>
