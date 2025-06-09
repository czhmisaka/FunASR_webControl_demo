import type { InstructionPayload } from "./types";

/**
 * 解析样式字符串为对象
 * @param styleStr 样式字符串 (如 "color: red; font-size: 14px;")
 * @returns 样式对象
 */
export const parseStyleString = (styleStr: string): Record<string, string> => {
    const styles: Record<string, string> = {};
    styleStr.split(";").forEach((rule) => {
        const [key, val] = rule.split(":").map((s) => s.trim());
        if (key && val) styles[key] = val;
    });
    return styles;
};

/**
 * 创建新元素
 * @param container 容器元素
 * @param payload 创建指令负载
 */
export const createElement = (container: HTMLElement, payload: InstructionPayload) => {
    console.log("创建元素", payload);
    if (!payload.tagName) {
        throw new Error("创建元素缺少必要参数: tagName");
    }

    const element = document.createElement(payload.tagName);

    // 设置属性
    if (payload.attributes) {
        for (const [key, value] of Object.entries(payload.attributes)) {
            element.setAttribute(key, value as string);
        }
    }

    // 生成唯一ID（如果没有提供）
    if (!element.id) {
        element.id = `element-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }

    // 设置内容
    if (payload.textContent) {
        element.innerHTML = payload.textContent;
    }

    container.appendChild(element);
};

/**
 * 修改元素
 * @param container 容器元素
 * @param payload 修改指令负载
 */
export const modifyElement = (container: HTMLElement, payload: InstructionPayload) => {
    if (!payload.target) {
        throw new Error("修改元素缺少必要参数: target");
    }

    const element = container.querySelector(payload.target);
    if (!element) throw new Error(`找不到元素: ${payload.selector}`);

    // 应用修改
    for (const [key, value] of Object.entries(payload)) {
        if (['target', 'tagName'].indexOf(key) > -1) {
            // 忽略不需要处理的键
            continue;
        }
        if (key === "class") {
            // 确保元素是HTMLElement
            if (element instanceof HTMLElement) {
                element.className = value as string;
            } else {
                console.warn(`元素不是HTMLElement，无法设置className。选择器: ${payload.selector}`);
            }
        } else if (key === "style") {
            // 解析样式值
            const styleUpdates = typeof value === "string"
                ? parseStyleString(value)
                : value as Record<string, string>;

            // 确保元素是HTMLElement
            if (element instanceof HTMLElement) {
                // 更新样式属性
                for (const [prop, val] of Object.entries(styleUpdates)) {
                    element.style.setProperty(prop, val);
                }
            } else {
                console.warn(`元素不是HTMLElement，无法设置样式。选择器: ${payload.selector}`);
            }
        } else {
            (element as any)[key] = value;
        }
    }
};

/**
 * 删除元素
 * @param container 容器元素
 * @param payload 删除指令负载
 */
export const deleteElement = (container: HTMLElement, payload: InstructionPayload) => {
    if (!payload.selector) {
        throw new Error("删除元素缺少必要参数: selector");
    }

    const element = container.querySelector(payload.selector);
    if (!element) throw new Error(`找不到元素: ${payload.selector}`);

    element.remove();
};

/**
 * 查询容器内元素
 * @param container 容器元素
 * @returns 元素描述数组
 */
export const queryElement = (container: HTMLElement): string[] => {
    const elements = container.childNodes;
    if (elements.length === 0) return [];

    return Array.from(elements).map((el: any) => {
        const attributes: Record<string, string> = {};
        for (let i = 0; i < el.attributes.length; i++) {
            // 选择性提取定位，背景色，字体颜色等ui信息
            if (el.attributes[i].name === 'style') {
                const styleObj = parseStyleString(el.attributes[i].value);
                attributes['style'] = JSON.stringify(styleObj);
                continue;
            }
            // 其他属性
            const attr = el.attributes[i];
            attributes[attr.name] = attr.value || "";
        }

        return JSON.stringify({
            tag: el.tagName.toLowerCase(),
            id: el.id,
            classes: el.className,
            attributes: attributes
        });
    });
};

/**
 * 处理模型指令
 * @param response 模型响应文本
 * @param container 容器元素
 */
export const handleInstructions = (response: string, container: HTMLElement): boolean => {
    console.log("模型指令", response);
    try {

        const instruction = typeof response == 'string' ? JSON.parse(response) : response

        // 验证指令基本结构
        console.log("指令", instruction);
        if (!instruction.type) {
            throw new Error("无效指令格式：缺少type");
        }

        let result = false;
        console.log("指令类型", instruction.type, "payload", instruction);
        switch (instruction.type) {
            case "dom/create":
                createElement(container, instruction);
                result = true;
                break;
            case "dom/modify":
                modifyElement(container, instruction);
                result = true;
                break;
            case "dom/delete":
                deleteElement(container, instruction);
                result = true;
                break;
            case "dom/tool": // 新增工具调用类型
                const toolName = instruction.payload.tool;
                if (toolRegistry[toolName]) {
                    const params = instruction.payload.params || [];
                    toolRegistry[toolName].tool(...params);
                    result = true;
                } else {
                    throw new Error(`未知工具: ${toolName}`);
                }
                break;
            default:
                throw new Error(`未知指令类型: ${instruction.type}`);
        }

        return result;
    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : "无效JSON指令";
        console.error(`指令处理失败: ${errorMsg}`);
        return false;
    }
};

// 工具注册表
const toolRegistry: Record<string, any> = {};

/**
 * 注册DOM工具
 * @param name 工具名称
 * @param tool 工具函数
 * @param descriptor 工具描述
 */
export const registerTool = (name: string, tool: any, descriptor: any) => {
    toolRegistry[name] = {
        tool,
        descriptor
    };
};

/**
 * 获取所有注册工具的描述信息
 */
export const getRegisteredTools = () => {
    return Object.values(toolRegistry).map(t => t.descriptor);
};

// 注册基础DOM工具
registerTool('clickElement',
    (selector: string) => {
        const el = document.querySelector(selector);
        if (el) {
            el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            return `Clicked: ${selector}`;
        }
        throw new Error(`Element not found: ${selector}`);
    },
    {
        name: 'clickElement',
        description: '模拟点击指定选择器的元素',
        parameters: [{ name: 'selector', type: 'string' }]
    }
);

registerTool('setInputValue',
    (selector: string, value: string) => {
        const input = document.querySelector(selector) as HTMLInputElement;
        if (input) {
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            return `Set ${selector} value to: ${value}`;
        }
        throw new Error(`Input not found: ${selector}`);
    },
    {
        name: 'setInputValue',
        description: '设置指定输入框的值',
        parameters: [
            { name: 'selector', type: 'string' },
            { name: 'value', type: 'string' }
        ]
    }
);
