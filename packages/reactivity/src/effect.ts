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
  console.log("依赖收集", target, key);
}

/**
 * 触发依赖
 * @param target
 * @param key
 * @param newValue
 */
export function trigger(target: object, key: unknown, newValue: unknown) {
  console.log("依赖触发", target, key, newValue);
}
