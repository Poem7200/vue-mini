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
  const {
    insert: hostInsert,
    patchProp: hostPatchProp,
    createElement: hostCreateElement,
    setElementText: hostSetElementText,
  } = options;

  const processElement = (oldVNode, newVNode, container, anchor) => {
    if (oldVNode == null) {
      // 挂载
      mountElement(newVNode, container, anchor);
    } else {
      // 更新
    }
  };

  const mountElement = (vnode, container, anchor) => {
    const { type, props, shapeFlag } = vnode;
    // 创建element
    const el = (vnode.el = hostCreateElement(type));
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 设置文本
      hostSetElementText(el, vnode.children);
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // TODO:
    }

    // 设置props
    if (props) {
      for (const key in props) {
        hostPatchProp(el, key, null, props[key]);
      }
    }
    // 插入
    hostInsert(el, container, anchor);
  };

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
          processElement(oldVNode, newVNode, container, anchor);
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
