import { extend, isString } from "@vue/shared";
import { createRenderer } from "packages/runtime-core/src/renderer";
import { nodeOps } from "./nodeOps";
import { patchProp } from "./patchProp";

const rendererOptions = extend({ patchProp }, nodeOps);

let renderer;

function ensureRenderer() {
  return renderer || (renderer = createRenderer(rendererOptions));
}

export const render = (...args) => {
  ensureRenderer().render(...args);
};

export const createApp = (...args) => {
  const app = ensureRenderer().createApp(...args);

  const { mount } = app;

  app.mount = (containerOrSelector: Element | string) => {
    const container = normalizeContainer(containerOrSelector);

    if (!container) return;

    mount(container);
  };

  return app;
};

function normalizeContainer(container: Element | string): Element | null {
  if (isString(container)) {
    const res = document.querySelector(container);
    return res;
  }
  return container;
}
