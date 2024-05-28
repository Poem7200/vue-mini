import { EMPTY_OBJ, ShapeFlags } from "@vue/shared";
import { Comment, Fragment, Text, isSameVNodeType } from "./vnode";

export interface RendererOptions {
  // 为指定的element的prop打补丁
  patchProp(el: Element, key: string, prevValue: any, nextValue: any): void;
  // 为指定element设置text
  setElementText(node: Element, text: string): void;
  // 插入指定的el到parent，anchor表示插入的位置，即：锚点
  insert(el, parent: Element, anchor?): void;
  // 创建指定的element
  createElement(type: string);
  remove(el: Element);
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
    remove: hostRemove,
  } = options;

  const processElement = (oldVNode, newVNode, container, anchor) => {
    if (oldVNode == null) {
      // 挂载
      mountElement(newVNode, container, anchor);
    } else {
      // 更新
      patchElement(oldVNode, newVNode);
    }
  };

  const mountElement = (vnode, container, anchor) => {
    const { type, props, shapeFlag } = vnode;
    // 创建element
    const el = (vnode.el = hostCreateElement(type));
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 设置文本
      hostSetElementText(el, vnode.children as string);
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

  const patchElement = (oldVNode, newVNode) => {
    const el = (newVNode.el = oldVNode.el);

    const oldProps = oldVNode.props || EMPTY_OBJ;
    const newProps = newVNode.props || EMPTY_OBJ;

    patchChildren(oldVNode, newVNode, el, null);

    patchProps(el, newVNode, oldProps, newProps);
  };

  const patchChildren = (oldVNode, newVNode, container, anchor) => {
    const c1 = oldVNode && oldVNode.children;
    const c2 = newVNode && newVNode.children;

    const prevShapeFlag = oldVNode ? oldVNode.shapeFlag : 0;
    const { shapeFlag: newShapeFlag } = newVNode;

    if (newShapeFlag & ShapeFlags.TEXT_CHILDREN) {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // TODO: 卸载旧子节点
      }

      if (c2 !== c1) {
        // 挂载新的子节点文本
        hostSetElementText(container, c2);
      }
    } else {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        if (newShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // TODO: diff计算
        } else {
          // TODO: 卸载
        }
      } else {
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          // 删除旧节点text
          hostSetElementText(container, "");
        }
        if (newShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // TODO: 单独新子节点挂载
        }
      }
    }
  };

  const patchProps = (el: Element, vnode, oldProps, newProps) => {
    if (oldProps !== newProps) {
      for (const key in newProps) {
        const next = newProps[key];
        const prev = oldProps[key];
        if (next !== prev) {
          hostPatchProp(el, key, prev, next);
        }
      }

      if (oldProps !== EMPTY_OBJ) {
        for (const key in oldProps) {
          // 对于老的props中有的，但是新的没有的，就不用留一个空值，而是删除
          if (!(key in newProps)) {
            hostPatchProp(el, key, oldProps[key], null);
          }
        }
      }
    }
  };

  const patch = (oldVNode, newVNode, container, anchor = null) => {
    if (oldVNode === newVNode) {
      return;
    }

    // 判断新旧节点是否是同一元素
    if (oldVNode && !isSameVNodeType(oldVNode, newVNode)) {
      unmount(oldVNode);
      oldVNode = null;
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

  const unmount = (vnode) => {
    hostRemove(vnode.el);
  };

  // 渲染：把vnode渲染到指定container下
  const render = (vnode, container) => {
    if (vnode === null) {
      // 卸载
      if (container._vnode) {
        unmount(container._vnode);
      }
    } else {
      patch(container._vnode || null, vnode, container);
    }

    container._vnode = vnode;
  };

  return {
    render,
  };
}
