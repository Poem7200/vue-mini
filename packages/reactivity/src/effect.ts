import { extend } from "@vue/shared";
import { ComputedRefImpl } from "./computed";
import { Dep, createDep } from "./dep";

export type EffectScheduler = (...args: any[]) => any;

/**
 * 依赖收集要考虑使用weakmap操作
 * key：响应性对象
 * value：Map对象
 *    key：响应性对象指定属性
 *    value：指定对象的指定属性的执行函数
 */
type KeyToDepMap = Map<any, Dep>;
const targetMap = new WeakMap<object, KeyToDepMap>();

export interface ReactiveEffectOptions {
  lazy?: boolean;
  scheduler?: EffectScheduler;
}

export function effect<T = any>(fn: () => T, options?: ReactiveEffectOptions) {
  const _effect = new ReactiveEffect(fn);

  if (options) {
    extend(_effect, options);
  }

  if (!options || !options.lazy) {
    // 完成第一次run执行
    _effect.run();
  }
}

export let activeEffect: ReactiveEffect | undefined;

export class ReactiveEffect<T = any> {
  computed?: ComputedRefImpl<T>;

  constructor(
    public fn: () => T,
    public scheduler: EffectScheduler | null = null
  ) {}

  run() {
    // 标记当前触发的effect
    activeEffect = this;

    return this.fn();
  }

  stop() {}
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

  let dep = depsMap.get(key);
  if (!dep) {
    depsMap.set(key, (dep = createDep()));
  }

  trackEffects(dep);

  // 这个地方只设置了一对一的关联关系，如果一个key对应多个effect那就不行了
  // depsMap.set(key, activeEffect);
}

// 依次收集依赖
export function trackEffects(dep: Dep) {
  dep.add(activeEffect!);
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

  const dep: Dep | undefined = depsMap.get(key);
  if (!dep) return;

  triggerEffects(dep);
}

// 依次触发依赖
export function triggerEffects(dep: Dep) {
  // 先执行计算属性的effect
  Array.from(dep).forEach((effect) => {
    effect.computed && triggerEffect(effect);
  });

  // 再执行非计算属性的effect
  Array.from(dep).forEach((effect) => {
    !effect.computed && triggerEffect(effect);
  });
}

// 触发指定依赖
export function triggerEffect(effect: ReactiveEffect) {
  if (effect.scheduler) {
    effect.scheduler();
  } else {
    effect.run();
  }
}
