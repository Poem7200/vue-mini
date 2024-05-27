import { ShapeFlags } from "@vue/shared";
import { Comment, Fragment, Text } from "./vnode";

export interface RendererOptions {
  // 为指定的element的prop打补丁
  patchProp(el: Element, key: string, prevValue: any, nextValue: any): void;
  // 为指定element设置text
  setElementText(node: Element, text: string): void;
  // 插入指定的el到parent，anchor表示插入的位置，即：锚点
  insert(el, parent: Element, anchor?): void;
  // 创建指定的element
  createElement(type: string);
}

export function createRenderer(options: RendererOptions) {
  return baseCreateRenderer(options);
}

function baseCreateRenderer(options: RendererOptions): any {
  const patch = (oldVNode, newVNode, container, anchor = null) => {
    if (oldVNode === newVNode) {
      return;
    }

    const { type, shapeFlag } = newVNode;

    switch (type) {
      case Text:
        break;
      case Comment:
        break;
      case Fragment:
        break;
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          // TODO
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          // TODO
        }
    }
  };

  // 渲染：把vnode渲染到指定container下
  const render = (vnode, container) => {
    if (vnode === null) {
      // TODO: 卸载
    } else {
      patch(container._vnode || null, vnode, container);
    }

    container._vnonde = vnode;
  };

  return {
    render,
  };
}
