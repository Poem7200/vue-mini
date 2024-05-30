import { reactive } from "@vue/reactivity";
import { isObject } from "@vue/shared";
import { onBeforeMount, onMounted } from "./apiLifecycle";

let uid = 0;

export const enum LifecycleHooks {
  BEFORE_CREATE = "bc",
  CREATED = "c",
  BEFORE_MOUNT = "bm",
  MOUNTED = "m",
}

export function createComponentInstance(vnode) {
  const type = vnode.type;

  const instance = {
    uid: uid++,
    vnode,
    type,
    subTree: null,
    effect: null,
    update: null,
    render: null,
    // 生命周期相关
    isMounted: false,
    bc: null,
    c: null,
    bm: null,
    m: null,
  };

  return instance;
}

export function setupComponent(instance) {
  setupStatefulComponent(instance);
}

function setupStatefulComponent(instance) {
  finishComponentSetup(instance);
}

export function finishComponentSetup(instance) {
  const Component = instance.type;

  instance.render = Component.render;

  applyOptions(instance);
}

function applyOptions(instance: any) {
  const {
    data: dataOptions,
    beforeCreate,
    created,
    beforeMount,
    mounted,
  } = instance.type;

  // beforeCreate在数据初始化之前
  if (beforeCreate) {
    callHook(beforeCreate);
  }

  if (dataOptions) {
    const data = dataOptions();
    if (isObject(data)) {
      instance.data = reactive(data);
    }
  }

  // 数据初始化完成后，created执行
  if (created) {
    callHook(created);
  }

  function registerLifecycleHook(register: Function, hook?: Function) {
    register(hook, instance);
  }

  registerLifecycleHook(onBeforeMount, beforeMount);
  registerLifecycleHook(onMounted, mounted);
}

function callHook(hook: Function) {
  hook();
}
