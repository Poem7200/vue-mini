import { isString } from "@vue/shared";

export function patchStyle(el: Element, prev, next) {
  const style = (el as HTMLElement).style;

  const isCssString = isString(style);

  if (next && !isCssString) {
    // 新样式挂载
    for (const key in next) {
      setStyle(style, key, next[key]);
    }

    // 旧样式处理
    if (prev && !isString(prev)) {
      for (const key in prev) {
        if (next[key] == null) {
          setStyle(style, key, "");
        }
      }
    }
  }
}

function setStyle(
  style: CSSStyleDeclaration,
  name: string,
  value: string | string[]
) {
  style[name] = value;
}
