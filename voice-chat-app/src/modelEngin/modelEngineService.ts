import axios from "axios";
import type { ModelConfig, Message } from "./types";

// 默认系统提示词
export const default_prompt = `
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
用原始json格式输出，不要使用markdown标签包裹
所有元素应当默认使用绝对定位,默认使用top和 left处理定位，例如 top:0px; left: 0px;
type 字段必须从可选值中选择，严禁自定义（如错误写成 "dom-create"）
payload 字段必填规则：
dom/create：必须包含 tag、content，attrs 可选（如 {style: "color: red"}） 其中当你想删除某个属性，则需要把这属性的对应值改为none
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

/**
 * 检测消息类型（普通消息/指令）
 * @param text 消息文本
 * @returns 消息类型 (ai/instruction)
 */
export const detectMessageType = (text: string): string => {
    try {
        JSON.parse(text);
        return "instruction";
    } catch {
        return text.includes("操作指令") ? "instruction" : "ai";
    }
};

/**
 * 发送消息到大模型
 * @param userMessage 用户消息
 * @param modelConfig 模型配置
 * @param pageContent 当前页面内容
 * @returns 解析后的AI响应
 */
export const sendToModel = async (
    userMessage: string,
    modelConfig: ModelConfig,
    pageContent?: string
): Promise<{ response: string; duration: number }> => {
    const startTime = Date.now();

    // 自动转换旧版模型名称格式
    const finalModelName = modelConfig.model

    let checkResult = false;
    try {
        // 检查是否需要页面操作
        const checkResponse = await axios.post(
            "http://127.0.0.1:1234/v1/chat/completions",
            {
                model: "qwen3-0.6b",
                messages: [
                    {
                        role: "system",
                        content: `请判断如下语句中是否存在对页面元素的操作？只输出 是 或者 否，不要输出其余任何内容`,
                    },
                    { role: "user", content: userMessage + "/no_think" },
                ],
                temperature: 0.7,
                max_tokens: 2048,
                stream: false,
            }
        );
        checkResult = checkResponse.data.choices[0].message.content.includes("是");
    } catch (error) {
        console.error("检查请求失败:", error);
        throw new Error("检查请求失败，继续发送消息");
    }

    try {
        // 准备请求头
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        // 添加API Key认证
        if (modelConfig.apiKey) {
            headers["Authorization"] = `Bearer ${modelConfig.apiKey}`;
        }

        // 发送主请求
        const response = await axios.post(
            modelConfig.url,
            {
                model: finalModelName, // 使用转换后的模型名称
                messages: [
                    {
                        role: "system",
                        content: default_prompt,
                    },
                    {
                        role: "user",
                        content:
                            (checkResult && pageContent
                                ? `当前页面内容为【${pageContent}】\n\n${userMessage}`
                                : userMessage) + "\n/no_think",
                    },
                ],
                temperature: 0.7,
                max_tokens: 4096,
                stream: false,
            },
            { headers }
        );

        // 处理响应
        const aiResponse = response.data.choices[0].message.content;
        const cleanResponse = aiResponse
            .replace("```json", "")
            .replace("```", "")
            .trim();

        return {
            response: cleanResponse,
            duration: Date.now() - startTime,
        };
    } catch (error: any) {
        console.error("模型请求失败:", error);

        // 增强错误处理
        let errorMsg = "模型请求失败";
        if (error.response?.status === 404) {
            errorMsg = `模型未找到: ${finalModelName}，请检查模型名称配置`;
        } else if (error.response?.data?.error?.message) {
            errorMsg = error.response.data.error.message;
        }

        throw new Error(errorMsg);
    }
};
