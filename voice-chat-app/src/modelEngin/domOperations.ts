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

    // 生成唯一ID（如果没有提供）
    if (!element.id) {
        element.id = `element-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }

    // 设置内容
    if (payload.content) {
        element.innerHTML = payload.content;
    }

    container.appendChild(element);
};

/**
 * 修改元素
 * @param container 容器元素
 * @param payload 修改指令负载
 */
export const modifyElement = (container: HTMLElement, payload: InstructionPayload) => {
    if (!payload.selector || !payload.modifications) {
        throw new Error("修改元素缺少必要参数: selector或modifications");
    }

    const element = container.querySelector(payload.selector);
    if (!element) throw new Error(`找不到元素: ${payload.selector}`);

    // 应用修改
    for (const [key, value] of Object.entries(payload.modifications)) {
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
            const attr = el.attributes[i];
            attributes[attr.name] = attr.value || "";
        }

        return JSON.stringify({
            tag: el.tagName.toLowerCase(),
            id: el.id,
            classes: el.className,
            attributes
        });
    });
};

/**
 * 处理模型指令
 * @param response 模型响应文本
 * @param container 容器元素
 */
export const handleInstructions = (response: string, container: HTMLElement): boolean => {
    try {
        const instruction = JSON.parse(response);

        // 验证指令基本结构
        if (!instruction.type || !instruction.payload) {
            throw new Error("无效指令格式：缺少type或payload");
        }

        let result = false;
        switch (instruction.type) {
            case "dom/create":
                createElement(container, instruction.payload);
                result = true;
                break;
            case "dom/modify":
                modifyElement(container, instruction.payload);
                result = true;
                break;
            case "dom/delete":
                deleteElement(container, instruction.payload);
                result = true;
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

// 新增基础DOM操作
export const domBaseOperations = {
    clickElement: (selector: string) => {
        const el = document.querySelector(selector);
        if (el) {
            el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            return `Clicked: ${selector}`;
        }
        throw new Error(`Element not found: ${selector}`);
    },
    setInputValue: (selector: string, value: string) => {
        const input = document.querySelector(selector) as HTMLInputElement;
        if (input) {
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            return `Set ${selector} value to: ${value}`;
        }
        throw new Error(`Input not found: ${selector}`);
    }
};
