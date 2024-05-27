import {
  isArray,
  isFunction,
  isObject,
  isString,
  normalizeClass,
  ShapeFlags,
} from "@vue/shared";

export const Fragment = Symbol("Fragment");
export const Text = Symbol("Text");
export const Comment = Symbol("Comment");

export interface VNode {
  __v_isVNode: true;
  type: any;
  props: any;
  children: any;
  shapeFlag: number;
}

export function isVNode(value: any): value is VNode {
  return value ? value.__v_isVNode === true : false;
}

/**
 * 生成一个VNode对象，并返回
 * @param type vnode类型
 * @param props 标签/自定义属性
 * @param children 子节点
 * @returns vnode对象
 */
export function createVNode(type, props, children): VNode {
  if (props) {
    let { class: klass, style } = props;

    if (klass && !isString(klass)) {
      props.class = normalizeClass(klass);
    }
  }

  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT
    : isObject(type)
    ? ShapeFlags.STATEFUL_COMPONENT
    : 0;

  return createBaseVNode(type, props, children, shapeFlag);
}

// 创建基础vnode
function createBaseVNode(type, props, children, shapeFlag) {
  const vnode = {
    __v_isVNode: true,
    type,
    props,
    shapeFlag,
  } as VNode;

  normalizeChildren(vnode, children);

  return vnode;
}

export function normalizeChildren(vnode: VNode, children: unknown) {
  let type = 0;

  const { shapeFlag } = vnode;

  if (children == null) {
    children = null;
  } else if (isArray(children)) {
    type = ShapeFlags.ARRAY_CHILDREN;
  } else if (typeof children === "object") {
    // TODO: 对象类型的children
  } else if (isFunction(children)) {
    // TODO: 函数类型的children
  } else {
    children = String(children);
    type = ShapeFlags.TEXT_CHILDREN;
  }

  vnode.children = children;
  vnode.shapeFlag |= type;
}
