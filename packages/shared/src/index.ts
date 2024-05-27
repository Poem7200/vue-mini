export * from "./shapeFlags";
export * from "./normalizeProp";

// 判断是否为一个数组
export const isArray = Array.isArray;

// 判断是否为对象
export const isObject = (val: unknown) =>
  val !== null && typeof val === "object";

// 判断是否为字符串
export const isString = (val: unknown): val is string =>
  typeof val === "string";

// 判断数据是否改变
export const hasChanged = (value: any, oldValue: any): boolean =>
  !Object.is(value, oldValue);

// 判断是否为函数
export const isFunction = (val: unknown): val is Function =>
  typeof val === "function";

export const extend = Object.assign;

export const EMPTY_OBJ: { readonly [key: string]: any } = {};

const onRE = /^on[^a-z]/;
export const isOn = (key: string) => onRE.test(key);
