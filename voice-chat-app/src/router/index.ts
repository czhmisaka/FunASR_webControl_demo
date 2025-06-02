/*
 * @Date: 2025-06-02 19:47:06
 * @LastEditors: CZH
 * @LastEditTime: 2025-06-02 20:25:34
 * @FilePath: /AI编程与MCP使用/voice-chat-app/src/router/index.ts
 */
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
    {
        path: '/',
        name: 'home',
        component: () => import('../views/HomeView.vue')
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router
