import { ShapeFlags } from "@vue/shared";
import { Text, createVNode } from "./vnode";

export function renderComponentRoot(instance) {
  const { vnode, render } = instance;

  let result;

  try {
    if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
      result = normalizeVNode(render!());
    }
  } catch (err) {
    console.error(err);
  }

  return result;
}

export function normalizeVNode(child) {
  if (typeof child === "object") {
    // child是对象意味着已经是VNode了，其实可以直接返回，这里是对标了源码
    return cloneIfMounted(child);
  } else {
    return createVNode(Text, null, String(child));
  }
}

export function cloneIfMounted(child) {
  return child;
}
