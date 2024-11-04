import { EMPTY_OBJ, ShapeFlags, isString } from "@vue/shared";
import { Comment, Fragment, Text, isSameVNodeType } from "./vnode";
import { normalizeVNode, renderComponentRoot } from "./componentRenderUtils";
import { createComponentInstance, setupComponent } from "./component";
import { ReactiveEffect } from "packages/reactivity/src/effect";
import { queuePreFlushCb } from "./scheduler";
import { createAppAPI } from "./apiCreateApp";

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
    // i移动到了最后一个位置，如果两条都通过，说明旧节点数量少于新节点
    if (i > oldChildrenEnd) {
      if (i <= newChildrenEnd) {
        const nextPos = newChildrenEnd + 1;
        /**
         * 下一个插入的位置
         * 1. 插入在后，则新节点的末尾下标+1 >= 新节点数量，插入位置应该是父节点anchor（最后一个）
         * 2. 插入在前，因为场景2，新节点末尾下标挪到0了，所以新节点末尾下标+1 < 新节点数量，插入的位置就应该是新节点末尾下标+1这个地方之前
         */
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
      // 第一部分：创建新节点的key->index的map映射
      const keyToNewIndexMap = new Map();
      for (i = newStartIndex; i <= newChildrenEnd; i++) {
        const nextChild = normalizeVNode(newChildren[i]);
        if (nextChild.key != null) {
          keyToNewIndexMap.set(nextChild.key, i);
        }
      }

      // 第二部分：循环旧节点，完成打补丁/删除（不移动）
      let j;
      let patched = 0; // 已经打补丁的数量（针对新节点）
      const toBePatched = newChildrenEnd - newStartIndex + 1; // 需要打补丁的数量（针对新节点）
      let moved = false; // 标记当前节点是否需要移动
      let maxNewIndexSoFar = 0; // 配合moved使用，保存当前最大新节点的index
      // 新节点下标到旧节点下标的map，并给这个map每一项都赋值0
      // 这个数组的下标是新节点的下标，每个下标的值是旧节点的对应key的元素的index+1
      // 例如新节点0对应的旧节点是在1，则记录为[2]
      const newIndexToOldIndexMap = new Array(toBePatched);
      for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0;
      // 循环旧节点
      for (i = oldStartIndex; i <= oldChildrenEnd; i++) {
        const prevChild = oldChildren[i];
        // 如果已经打补丁的数量超过了需要打补丁的数量，开始卸载
        if (patched >= toBePatched) {
          unmount(prevChild);
          continue;
        }
        // 新节点要存放的位置
        let newIndex;
        if (prevChild.key != null) {
          // 从之前新节点key->index的map中拿到新节点位置
          newIndex = keyToNewIndexMap.get(prevChild.key);
        }
        // 这里源码里面有个else，是处理那些没有key的节点的

        // 没找到新节点索引，说明旧节点应该删除了
        if (newIndex === undefined) {
          unmount(prevChild);
        }
        // 找到新节点索引，应该打补丁（先打补丁）
        else {
          newIndexToOldIndexMap[newIndex - newStartIndex] = i + 1;
          // 新节点index和当前最大新节点index比较，如果不比它大，则应该触发移动
          if (newIndex >= maxNewIndexSoFar) {
            maxNewIndexSoFar = newIndex;
          } else {
            moved = true;
          }
          patch(prevChild, newChildren[newIndex], container, null);
          patched++;
        }
      }

      // 第三部分：移动和挂载
      // 拿到newIndex到oldIndex这个映射数组的最长递增子序列
      const increasingNewIndexSequence = moved
        ? getSequence(newIndexToOldIndexMap)
        : [];
      j = increasingNewIndexSequence.length - 1;
      // 循环倒序，把需要patch的节点做一遍处理
      for (i = toBePatched - 1; i >= 0; i--) {
        // 拿到新节点
        const nextIndex = newStartIndex + i;
        const nextChild = newChildren[nextIndex];
        // 类似场景四，做插入处理
        const anchor =
          nextIndex + 1 < newChildrenLength
            ? newChildren[nextIndex + 1].el
            : parentAnchor;
        // 新节点没有找到旧节点，插入
        if (newIndexToOldIndexMap[i] === 0) {
          patch(null, nextChild, container, anchor);
        }
        // 如果需要移动，根据最长递增子序列做处理
        else if (moved) {
          // 如果不存在最长递增子序列/当前index不是最长递增子序列的最后一个元素，做移动
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
    createApp: createAppAPI(render),
  };
}

/**
 * 1.先拿到当前元素
 * 2.看当前元素是否比之前结果的最后一个大
 * 2.1 是，存储
 * 2.2 不是，用当前的替换刚才的（用二分查找实现）
 */
// 获取最长递增子序列的下标
function getSequence(arr: number[]): number[] {
  // 生成arr的浅拷贝
  const p = arr.slice();
  // 最长递增子序列下标
  const result = [0]; // 暂时把第一项存入最后结果
  let i, j, u, v, c;
  for (i = 0; i < arr.length; i++) {
    // 拿到每一个元素
    const arrI = arr[i];
    // 这里不为零是因为会不停改变数组的值，0表示的是下标，不具备比较的意义
    if (arrI !== 0) {
      // j是目前拿到的最长递增子序列最后一项的值（即原数组中下标）
      j = result[result.length - 1];
      // 如果result中最后一项比当前元素值小，则应该把当前值存起来
      if (arr[j] < arrI) {
        // result变化前，记录result更新前最后一个索引的值是多少
        p[i] = j;
        result.push(i);
        continue;
      }
      // 针对result开始二分查找，目的是找到需要变更的result的下标
      u = 0;
      v = result.length - 1;
      while (u < v) {
        // 平分，向下取整，拿到对比位置的中间位置（例如0和1拿到0）
        c = (u + v) >> 1;
        // 看当前中间位的arr值是否小于当前值，是的话，向右侧继续去比对
        if (arr[result[c]] < arrI) {
          u = c + 1;
        }
        // 如果不是，右侧缩窄到中间位置，再去做二分（说明右侧数字都比arrI大）
        else {
          v = c;
        }
      }
      // 在result中，用更大值的下标，替换原来较小值的下标
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1];
        }
        result[u] = i;
      }
    }
  }
  // 回溯
  u = result.length;
  v = result[u - 1];
  while (u-- > 0) {
    result[u] = v;
    v = p[v];
  }
  return result;
}
