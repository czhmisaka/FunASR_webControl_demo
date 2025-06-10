import type { Plugin, PluginInstruction, ToolDescriptor } from './types';
import { DOMOperation } from './types';

/**
 * DOM 操作插件
 */
export class DOMPlugin implements Plugin {
    name = 'dom-plugin';
    version = '1.0.0';
    private container: HTMLElement | null = null;

    async init() {
        console.log('DOM 插件初始化');
        this.container = document.getElementById('model-instructions');
        if (!this.container) {
            console.warn('未找到应用容器元素，将使用 document.body');
            this.container = document.body;
        }
    }

    async execute(instruction: PluginInstruction): Promise<any> {
        if (!this.container) {
            throw new Error('DOM 容器未初始化');
        }

        switch (instruction.tool) {
            case DOMOperation.CREATE:
                return this.createElement(instruction.parameters);
            case DOMOperation.MODIFY:
                return this.modifyElement(instruction.parameters);
            case DOMOperation.DELETE:
                return this.deleteElement(instruction.parameters);
            case DOMOperation.QUERY:
                return this.queryElements();
            case DOMOperation.HTML_INPUT:   // 新增 HTML 输入工具
                return this.htmlInput(instruction.parameters);
            default:
                throw new Error(`不支持的 DOM 操作类型: ${instruction.tool}`);
        }
    }

    getTools(): ToolDescriptor[] {
        return [
            {
                name: 'createHtml',
                description: '直接生成 HTML 代码，并嵌入到页面中运行',
                parameters: [
                    { name: 'html', type: 'string' }
                ]
            },
            {
                name: 'createElement',
                description: `创建新元素，需要指定 tagName 和 attributes，其中 attributes 是一个对象，包含元素的属性和值，需要使用z-index属性确保元素的显示效果,所有的样式效果都需要用style写入。不支持class样式`,
                parameters: [
                    { name: 'tagName', type: 'string' },
                    { name: 'attributes', type: 'object' },
                    { name: 'textContent', type: 'string', required: false },
                    { name: 'parentSelector', type: 'string', required: false }
                ]
            },
            {
                name: 'modifyElement',
                description: '修改元素属性，需要指定 selector 和 attributes，其中 attributes 是一个对象，包含元素的属性和值',
                parameters: [
                    { name: 'selector', type: 'string' },
                    { name: 'attributes', type: 'object' },
                    { name: 'textContent', type: 'string', required: false }
                ]
            },
            {
                name: 'deleteElement',
                description: '删除元素，需要指定 selector，一次只能删除一个',
                parameters: [
                    { name: 'selector', type: 'string' }
                ]
            },
            {
                name: 'queryElements',
                description: '查询页面元素',
                parameters: []
            }
        ];
    }

    private createElement(payload: any) {
        if (!payload.tagName) throw new Error('创建元素缺少必要参数: tagName');

        const element = document.createElement(payload.tagName);
        element.id = payload.id || `element-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

        if (payload.attributes) {
            for (const [key, value] of Object.entries(payload.attributes)) {
                element.setAttribute(key, value as string);
            }
        }

        if (payload.textContent) {
            element.textContent = payload.textContent;
        }

        if (payload.innerHTML) {
            element.innerHTML = payload.innerHTML;
        }

        if (payload.parentSelector) {
            const parent = document.querySelector(payload.parentSelector);
            parent?.appendChild(element);
        } else {
            this.container?.appendChild(element);
        }

        return { id: element.id };
    }

    private modifyElement(payload: any) {
        if (!payload.selector) throw new Error('修改元素缺少必要参数: selector');

        const element = document.querySelector(payload.selector);
        if (!element) throw new Error(`找不到元素: ${payload.selector}`);

        if (payload.attributes) {
            for (const [key, value] of Object.entries(payload.attributes)) {
                element.setAttribute(key, value as string);
            }
        }

        if (payload.textContent) {
            element.textContent = payload.textContent;
        }

        if (payload.innerHTML) {
            element.innerHTML = payload.innerHTML;
        }

        return { status: 'success' };
    }

    private deleteElement(payload: any) {
        if (!payload.selector) throw new Error('删除元素缺少必要参数: selector');

        const element = document.querySelector(payload.selector);
        if (!element) throw new Error(`找不到元素: ${payload.selector}`);

        element.remove();
        return { status: 'success' };
    }

    // 新增 HTML 输入工具实现
    private htmlInput(payload: any) {
        if (!payload.html) throw new Error('HtmlInput 缺少必要参数: html');

        // 创建容器元素
        const container = document.createElement('div');
        container.id = `html-container-${Date.now()}`;

        // 设置HTML内容
        container.innerHTML = payload.html;

        // 添加到DOM
        this.container?.appendChild(container);

        return { id: container.id };
    }

    public queryElements() {
        this.container = document.getElementById('model-instructions');
        if (!this.container) return [];

        return Array.from(this.container.children).map(el => {
            const attributes: Record<string, string> = {};
            for (const attr of el.attributes) {
                attributes[attr.name] = attr.value;
            }

            return {
                tag: el.tagName.toLowerCase(),
                id: el.id,
                classes: el.className,
                attributes,
                textContent: el.textContent
            };
        }).map(x => {
            return JSON.stringify(x)
        }).join('\n');
    }

    // 内置工具实现
    public clickElement(selector: string) {
        const el = document.querySelector(selector);
        if (el) {
            (el as HTMLElement).click();
            return `已点击: ${selector}`;
        }
        throw new Error(`找不到元素: ${selector}`);
    }

    public setInputValue(selector: string, value: string) {
        const input = document.querySelector(selector) as HTMLInputElement;
        if (input) {
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            return `已设置 ${selector} 的值为: ${value}`;
        }
        throw new Error(`找不到输入框: ${selector}`);
    }
}

// 导出插件实例
export const domPlugin = new DOMPlugin();
