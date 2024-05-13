/**
 * 依赖收集要考虑使用weakmap操作
 * key：响应性对象
 * value：Map对象
 *    key：响应性对象指定属性
 *    value：指定对象的指定属性的执行函数
 */
type KeyToDepMap = Map<any, ReactiveEffect>;
const targetMap = new WeakMap<object, KeyToDepMap>();

export function effect<T = any>(fn: () => T) {
  const _effect = new ReactiveEffect(fn);
  // 完成第一次run执行
  _effect.run();
}

export let activeEffect: ReactiveEffect | undefined;

export class ReactiveEffect<T = any> {
  constructor(public fn: () => T) {}

  run() {
    // 标记当前触发的effect
    activeEffect = this;

    return this.fn();
  }
}

/**
 * 收集依赖
 * @param target
 * @param key
 */
export function track(target: object, key: unknown) {
  if (!activeEffect) return;

  let depsMap = targetMap.get(target);
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()));
  }

  depsMap.set(key, activeEffect);
}

/**
 * 触发依赖
 * @param target
 * @param key
 * @param newValue
 */
export function trigger(target: object, key: unknown, newValue: unknown) {
  let depsMap = targetMap.get(target);
  if (!depsMap) return;

  const effect = depsMap.get(key) as ReactiveEffect;
  if (!effect) return;

  effect.fn();
}
