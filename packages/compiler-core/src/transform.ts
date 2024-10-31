import { isArray, isString } from "@vue/shared";
import { NodeTypes } from "./ast";
import { isSingleElementRoot } from "./hoistStatic";
import { TO_DISPLAY_STRING } from "./runtimeHelpers";

export interface TransformContext {
  root;
  parent: ParentNode | null;
  childIndex: number;
  currentNode;
  helpers: Map<symbol, number>;
  helper<T extends symbol>(name: T): T;
  nodeTransforms: any[];
  replaceNode(node): void;
}

// 创建一个全局通用的上下文对象
export function createTransformContext(root, { nodeTransforms = [] }) {
  const context: TransformContext = {
    nodeTransforms,
    root,
    helpers: new Map(),
    currentNode: root,
    parent: null,
    childIndex: 0,
    helper(name) {
      const count = context.helpers.get(name) || 0;
      context.helpers.set(name, count + 1);
      return name;
    },
    replaceNode(node) {
      context.parent!.children[context.childIndex] = context.currentNode = node;
    },
  };

  return context;
}

export function transform(root, options) {
  const context = createTransformContext(root, options);
  traverseNode(root, context);

  createRootCodegen(root);

  root.helpers = [...context.helpers.keys()];
  root.components = [];
  root.directives = [];
  root.imports = [];
  root.hoists = [];
  root.temps = [];
  root.cached = [];
}

export function traverseNode(node, context: TransformContext) {
  context.currentNode = node;

  const { nodeTransforms } = context;

  const exitFns: any = [];

  for (let i = 0; i < nodeTransforms.length; i++) {
    const onExit = nodeTransforms[i](node, context);

    if (onExit) {
      if (isArray(onExit)) {
        exitFns.push(...onExit);
      } else {
        exitFns.push(onExit);
      }
    }

    if (!context.currentNode) {
      return;
    } else {
      node = context.currentNode;
    }
  }

  switch (node.type) {
    // 处理子节点
    case NodeTypes.IF_BRANCH:
    case NodeTypes.ELEMENT:
    case NodeTypes.ROOT:
      traverseChildren(node, context);
      break;
    case NodeTypes.INTERPOLATION:
      context.helper(TO_DISPLAY_STRING);
      break;
    case NodeTypes.IF:
      for (let i = 0; i < node.branches.length; i++) {
        traverseNode(node.branches[i], context);
      }
      break;
  }

  // 退出阶段，倒序出
  context.currentNode = node;
  let i = exitFns.length;
  while (i--) {
    exitFns[i]();
  }
}

export function traverseChildren(parent, context: TransformContext) {
  parent.children.forEach((node, index) => {
    context.parent = parent;
    context.childIndex = index;
    traverseNode(node, context);
  });
}

function createRootCodegen(root) {
  const { children } = root;

  // Vue2只支持单个根节点，Vue3支持多个，这里只写了处理单个的
  if (children.length === 1) {
    const child = children[0];
    if (isSingleElementRoot(root, child) && child.codegenNode) {
      root.codegenNode = child.codegenNode;
    }
  }
}

// 针对指令的处理
// name是指令名字
// fn是指令的具体处理方法，通常是闭包函数
// 返回闭包函数，就是指令对应的处理函数
export function createStructuralDirectiveTransform(name: string | RegExp, fn) {
  const matches = isString(name)
    ? (n: string) => n === name
    : (n: string) => name.test(n);

  return (node, context) => {
    if (node.type === NodeTypes.ELEMENT) {
      const { props } = node;
      const exitFns: any = [];

      for (let i = 0; i < props.length; i++) {
        const prop = props[i];

        if (prop.type === NodeTypes.DIRECTIVE && matches(prop.name)) {
          props.splice(i, 1);
          i--;

          const onExit = fn(node, prop, context);
          if (onExit) exitFns.push(onExit);
        }
      }

      return exitFns;
    }
  };
}
