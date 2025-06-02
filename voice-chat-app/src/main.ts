/*
 * @Date: 2025-06-02 19:41:09
 * @LastEditors: CZH
 * @LastEditTime: 2025-06-02 19:45:44
 * @FilePath: /AI编程与MCP使用/voice-chat-app/src/main.ts
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ElementPlus)

app.mount('#app')
