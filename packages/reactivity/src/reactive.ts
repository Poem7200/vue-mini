import { mutableHandlers } from "./baseHandlers";

// WeakMap的键必须是对象，且key弱引用（不影响垃圾回收，即key不再有任何引用的时候，会直接回收）
// 也就是，一旦key里面的这个obj给清除了，则WeakMap对应的key也清除了
export const reactiveMap = new WeakMap<object, any>();

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
  proxyMap.set(target, proxy);

  return proxy;
}
