import { reactive } from "@vue/reactivity";
import { isFunction, isObject } from "@vue/shared";
import { onBeforeMount, onMounted } from "./apiLifecycle";

let uid = 0;
let compile: any = null;

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
  const Component = instance.type;

  // 提供了两种api：composition和setup
  const { setup } = Component;

  if (setup) {
    const setupResult = setup();

    handleSetupResult(instance, setupResult);
  } else {
    finishComponentSetup(instance);
  }
}

export function handleSetupResult(instance, setupResult: any) {
  if (isFunction(setupResult)) {
    instance.render = setupResult;
  }
  finishComponentSetup(instance);
}

export function finishComponentSetup(instance) {
  const Component = instance.type;

  if (!instance.render) {
    if (compile && !Component.render) {
      if (Component.template) {
        const template = Component.template;
        Component.render = compile(template);
      }
    }

    instance.render = Component.render;
  }

  applyOptions(instance);
}

export function registerRuntimeCompile(_compile: any) {
  compile = _compile;
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
    callHook(beforeCreate, instance.data);
  }

  if (dataOptions) {
    const data = dataOptions();
    if (isObject(data)) {
      instance.data = reactive(data);
    }
  }

  // 数据初始化完成后，created执行
  if (created) {
    callHook(created, instance.data);
  }

  function registerLifecycleHook(register: Function, hook?: Function) {
    register(hook?.bind(instance.data), instance);
  }

  registerLifecycleHook(onBeforeMount, beforeMount);
  registerLifecycleHook(onMounted, mounted);
}

function callHook(hook: Function, proxy: any) {
  hook.bind(proxy)();
}
