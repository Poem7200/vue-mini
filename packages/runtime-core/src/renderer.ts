import { EMPTY_OBJ, ShapeFlags, isString } from "@vue/shared";
import { Comment, Fragment, Text, isSameVNodeType } from "./vnode";
import { normalizeVNode, renderComponentRoot } from "./componentRenderUtils";
import { createComponentInstance, setupComponent } from "./component";
import { ReactiveEffect } from "packages/reactivity/src/effect";
import { queuePreFlushCb } from "./scheduler";

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
  createText(text: string);
  setText(node: Element, text: string);
  createComment(text: string);
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
    createText: hostCreateText,
    setText: hostSetText,
    createComment: hostCreateComment,
  } = options;

  const processText = (oldVNode, newVNode, container, anchor) => {
    if (oldVNode == null) {
      // 挂载
      newVNode.el = hostCreateText(newVNode.children);
      hostInsert(newVNode.el, container, anchor);
    } else {
      // 更新
      const el = (newVNode.el = oldVNode.el!);
      if (newVNode.children !== oldVNode.children) {
        hostSetText(el, newVNode.children);
      }
    }
  };

  const processComment = (oldVNode, newVNode, container, anchor) => {
    if (oldVNode == null) {
      newVNode.el = hostCreateComment(newVNode.children);
      hostInsert(newVNode.el, container, anchor);
    } else {
      newVNode.el = oldVNode.el;
    }
  };

  const processElement = (oldVNode, newVNode, container, anchor) => {
    if (oldVNode == null) {
      // 挂载
      mountElement(newVNode, container, anchor);
    } else {
      // 更新
      patchElement(oldVNode, newVNode);
    }
  };

  const processFragment = (oldVNode, newVNode, container, anchor) => {
    if (oldVNode == null) {
      mountChildren(newVNode.children, container, anchor);
    } else {
      patchChildren(oldVNode, newVNode, container, anchor);
    }
  };

  const processComponent = (oldVNode, newVNode, container, anchor) => {
    if (oldVNode == null) {
      mountComponent(newVNode, container, anchor);
    }
  };

  const mountComponent = (initialVNode, container, anchor) => {
    initialVNode.component = createComponentInstance(initialVNode);
    const instance = initialVNode.component;

    setupComponent(instance);

    setupRenderEffect(instance, initialVNode, container, anchor);
  };

  const setupRenderEffect = (instance, initialVNode, container, anchor) => {
    const componentUpdateFn = () => {
      if (!instance.isMounted) {
        // beforeMount和mounted生命周期
        const { bm, m } = instance;

        bm && bm();

        const subTree = (instance.subTree = renderComponentRoot(instance));

        patch(null, subTree, container, anchor);

        // 挂载完成后，触发mounted
        m && m();

        initialVNode.el = subTree.el;

        // 渲染完成后，更新渲染标记
        instance.isMounted = true;
      } else {
        let { next, vnode } = instance;

        if (!next) {
          next = vnode;
        }

        const nextTree = renderComponentRoot(instance);

        const prevTree = instance.subTree;
        instance.subTree = nextTree;

        patch(prevTree, nextTree, container, anchor);

        next.el = nextTree.el;
      }
    };

    const effect = (instance.effect = new ReactiveEffect(
      componentUpdateFn,
      () => queuePreFlushCb(update)
    ));

    const update = (instance.update = () => effect.run());

    update();
  };

  const mountElement = (vnode, container, anchor) => {
    const { type, props, shapeFlag } = vnode;
    // 创建element
    const el = (vnode.el = hostCreateElement(type));
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 设置文本
      hostSetElementText(el, vnode.children as string);
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      mountChildren(vnode.children, el, anchor);
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

  const mountChildren = (children, container, anchor) => {
    if (isString(children)) {
      children = children.split("");
    }

    for (let i = 0; i < children.length; i++) {
      const child = (children[i] = normalizeVNode(children[i]));
      patch(null, child, container, anchor);
    }
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
          // diff计算
          patchKeyedChildren(c1, c2, container, anchor);
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

  const patchKeyedChildren = (
    oldChildren,
    newChildren,
    container,
    parentAnchor
  ) => {
    let i = 0;
    const newChildrenLength = newChildren.length;

    let oldChildrenEnd = oldChildren.length - 1;
    let newChildrenEnd = newChildrenLength - 1;

    // 场景1: 自前向后
    while (i <= oldChildrenEnd && i <= newChildrenEnd) {
      const oldVNode = oldChildren[i];
      const newVNode = normalizeVNode(newChildren[i]);
      if (isSameVNodeType(oldVNode, newVNode)) {
        patch(oldVNode, newVNode, container, null);
      } else {
        break;
      }
      i++;
    }

    // 场景2：自后向前
    while (i <= oldChildrenEnd && i <= newChildrenEnd) {
      const oldVNode = oldChildren[oldChildrenEnd];
      const newVNode = normalizeVNode(newChildren[newChildrenEnd]);
      if (isSameVNodeType(oldVNode, newVNode)) {
        patch(oldVNode, newVNode, container, null);
      } else {
        break;
      }
      oldChildrenEnd--;
      newChildrenEnd--;
    }

    // 场景3：新节点多于旧节点
    if (i > oldChildrenEnd) {
      if (i <= newChildrenEnd) {
        const nextPos = newChildrenEnd + 1;
        const anchor =
          nextPos < newChildrenLength ? newChildren[nextPos].el : parentAnchor;
        while (i <= newChildrenEnd) {
          patch(null, normalizeVNode(newChildren[i]), container, anchor);
          i++;
        }
      }
    }
    // 场景4：旧节点多于新节点
    else if (i > newChildrenEnd) {
      while (i <= oldChildrenEnd) {
        unmount(oldChildren[i]);
        i++;
      }
    }
    // 场景5：乱序
    else {
      const oldStartIndex = i;
      const newStartIndex = i;
      const keyToNewIndexMap = new Map();
      for (i = newStartIndex; i <= newChildrenEnd; i++) {
        const nextChild = normalizeVNode(newChildren[i]);
        if (nextChild.key != null) {
          keyToNewIndexMap.set(nextChild.key, i);
        }
      }

      let j;
      let patched = 0;
      const toBePatched = newChildrenEnd - newStartIndex + 1;
      let moved = false;
      let maxNewIndexSoFar = 0;
      const newIndexToOldIndexMap = new Array(toBePatched);
      for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0;
      for (i = oldStartIndex; i <= oldChildrenEnd; i++) {
        const prevChild = oldChildren[i];
        if (patched >= toBePatched) {
          unmount(prevChild);
          continue;
        }
        let newIndex;
        if (prevChild.key != null) {
          newIndex = keyToNewIndexMap.get(prevChild.key);
        }

        if (newIndex === undefined) {
          unmount(prevChild);
        } else {
          newIndexToOldIndexMap[newIndex - newStartIndex] = i + 1;
          if (newIndex >= maxNewIndexSoFar) {
            maxNewIndexSoFar = newIndex;
          } else {
            moved = true;
          }
          patch(prevChild, newChildren[newIndex], container, null);
          patched++;
        }
      }

      const increasingNewIndexSequence = moved
        ? getSequence(newIndexToOldIndexMap)
        : [];
      j = increasingNewIndexSequence.length - 1;
      for (i = toBePatched - 1; i >= 0; i--) {
        const nextIndex = newStartIndex + i;
        const nextChild = newChildren[nextIndex];
        const anchor =
          nextIndex + 1 < newChildrenLength
            ? newChildren[nextIndex + 1].el
            : parentAnchor;
        if (newIndexToOldIndexMap[i] === 0) {
          patch(null, nextChild, container, anchor);
        } else if (moved) {
          if (j < 0 || i !== increasingNewIndexSequence[j]) {
            move(nextChild, container, anchor);
          } else {
            j--;
          }
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
        processText(oldVNode, newVNode, container, anchor);
        break;
      case Comment:
        processComment(oldVNode, newVNode, container, anchor);
        break;
      case Fragment:
        processFragment(oldVNode, newVNode, container, anchor);
        break;
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(oldVNode, newVNode, container, anchor);
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          // 组件挂载
          processComponent(oldVNode, newVNode, container, anchor);
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

  // 移动节点到指定位置
  const move = (vnode, container, anchor) => {
    const { el } = vnode;
    hostInsert(el!, container, anchor);
  };

  return {
    render,
  };
}

// 获取最长递增子序列的下标
function getSequence(arr: number[]): number[] {
  const p = arr.slice();
  const result = [0];
  let i, j, u, v, c;
  const len = arr.length;
  for (i = 0; i < len; i++) {
    const arrI = arr[i];
    if (arrI !== 0) {
      j = result[result.length - 1];
      if (arr[j] < arrI) {
        p[i] = j;
        result.push(i);
        continue;
      }
      u = 0;
      v = result.length - 1;
      while (u < v) {
        c = (u + v) >> 1;
        if (arr[result[c]] < arrI) {
          u = c + 1;
        } else {
          v = c;
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1];
        }
        result[u] = i;
      }
    }
  }
  u = result.length;
  v = result[u - 1];
  while (u-- > 0) {
    result[u] = v;
    v = p[v];
  }
  return result;
}
