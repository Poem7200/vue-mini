import { isReactive } from "@vue/reactivity";
import { EMPTY_OBJ, hasChanged } from "@vue/shared";
import { queuePreFlushCb } from "./scheduler";
import { ReactiveEffect } from "packages/reactivity/src/effect";

export interface WatchOptions<immediate = boolean> {
  immediate?: immediate;
  deep?: boolean;
}

export function watch(source, cb: Function, options?: WatchOptions) {
  return doWatch(source, cb, options);
}

function doWatch(
  source,
  cb: Function,
  { immediate, deep }: WatchOptions = EMPTY_OBJ
) {
  let getter: () => any;

  if (isReactive(source)) {
    getter = () => source;
    deep = true;
  } else {
    getter = () => {};
  }

  if (cb && deep) {
    const baseGetter = getter;
    getter = () => baseGetter();
  }

  let oldValue = {};

  // 本质上为了拿到newValue
  const job = () => {
    if (cb) {
      const newValue = effect.run();
      if (deep || hasChanged(newValue, oldValue)) {
        cb(newValue, oldValue);
        oldValue = newValue;
      }
    }
  };

  let scheduler = () => queuePreFlushCb(job);

  const effect = new ReactiveEffect(getter, scheduler);

  if (cb) {
    if (immediate) {
      job();
    } else {
      oldValue = effect.run();
    }
  } else {
    effect.run();
  }

  return () => {
    effect.stop();
  };
}
