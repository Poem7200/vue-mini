import { isObject } from "@vue/shared";
import { mutableHandlers } from "./baseHandlers";

// WeakMap的键必须是对象，且key弱引用（不影响垃圾回收，即key不再有任何引用的时候，会直接回收）
// 也就是，一旦key里面的这个obj给清除了，则WeakMap对应的key也清除了
export const reactiveMap = new WeakMap<object, any>();

export const enum ReactiveFlags {
  IS_REACTIVE = "__v_isReactive",
}

export function reactive(target: object) {
  return createReactiveObject(target, mutableHandlers, reactiveMap);
}

function createReactiveObject(
  target: object,
  baseHandlers: ProxyHandler<any>,
  proxyMap: WeakMap<object, any>
) {
  // 获取proxy缓存
  const existingProxy = proxyMap.get(target);
  if (existingProxy) {
    return existingProxy;
  }

  const proxy = new Proxy(target, baseHandlers);
  // 这个属性是用来判断是否为reactive的
  proxy[ReactiveFlags.IS_REACTIVE] = true;
  proxyMap.set(target, proxy);

  return proxy;
}

export const toReactive = <T extends unknown>(value: T): T => {
  return isObject(value) ? reactive(value as object) : value;
};

export function isReactive(value): boolean {
  return !!(value && value[ReactiveFlags.IS_REACTIVE]);
}
