import { isFunction } from "@vue/shared";
import { Dep } from "./dep";
import { ReactiveEffect } from "./effect";
import { trackRefValue } from "./ref";

export class ComputedRefImpl<T> {
  public dep?: Dep = undefined;
  private _value!: T;

  public readonly effect: ReactiveEffect<T>;
  public readonly __v_isRef = true;

  constructor(getter) {
    this.effect = new ReactiveEffect(getter);
    this.effect.computed = this;
  }

  get value() {
    trackRefValue(this);
    this._value = this.effect.run();
    return this._value;
  }
}

export function computed(getterOrOptions) {
  let getter;

  const onlyGetter = isFunction(getterOrOptions);

  if (onlyGetter) {
    getter = getterOrOptions;
  }

  const cRef = new ComputedRefImpl(getter);
  return cRef;
}
