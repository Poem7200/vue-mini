import { isString } from "@vue/shared";
import {
  createCallExpression,
  createConditionalExpression,
  createObjectProperty,
  createSimpleExpression,
  NodeTypes,
} from "../ast";
import {
  createStructuralDirectiveTransform,
  TransformContext,
} from "../transform";
import { getMemoedVNodeCall } from "../utils";
import { CREATE_COMMENT } from "../runtimeHelpers";

// 实际的if的transform方法
// 第一个参数是判断条件，即v-后面是if/else/else-if
// 第二个参数是执行的函数，即onExit
export const transformIf = createStructuralDirectiveTransform(
  /^(if|else|else-if)$/,
  // 第一个参数是node自己
  // 第二个参数实际上是prop属性
  // 第三个参数是上下文
  // 第四个参数是一个匿名函数，真实目的是往这个ifNode上面创建codegenNode属性
  (node, dir, context) => {
    return processIf(node, dir, context, (ifNode, branch, isRoot) => {
      let key = 0;

      return () => {
        if (isRoot) {
          ifNode.codegenNode = createCodegenNodeForBranch(branch, key, context);
        }
      };
    });
  }
);

// 真实处理if指令的部分
export function processIf(
  node,
  dir,
  context: TransformContext,
  processCodegen?: (node, branch, isRoot: boolean) => () => void
) {
  // 只有if指令才处理
  if (dir.name === "if") {
    // 创建一个branch属性
    const branch = createIfBranch(node, dir);

    const ifNode = {
      type: NodeTypes.IF,
      loc: {},
      branches: [branch],
    };

    // 上下文指向的node改成当前的ifNode
    context.replaceNode(ifNode);

    if (processCodegen) {
      return processCodegen(ifNode, branch, true);
    }
  }
}

function createIfBranch(node, dir) {
  return {
    type: NodeTypes.IF_BRANCH,
    loc: {},
    condition: dir.exp,
    children: [node],
  };
}

// 对if分支创建codegenNode属性
function createCodegenNodeForBranch(
  branch,
  keyIndex: number,
  context: TransformContext
) {
  // 如果v-if后面有条件，要根据条件创建三元表达式
  if (branch.condition) {
    return createConditionalExpression(
      branch.condition,
      createChildrenCodegenNode(branch, keyIndex),
      createCallExpression(context.helper(CREATE_COMMENT), ['"v-if"', "true"])
    );
  }
  // 没有条件，则只针对子节点创建codegenNode
  else {
    return createChildrenCodegenNode(branch, keyIndex);
  }
}

// 创建指定子节点的codegen
// key都是0
function createChildrenCodegenNode(branch, keyIndex: number) {
  const keyProperty = createObjectProperty(
    `key`,
    createSimpleExpression(`${keyIndex}`, false)
  );

  const { children } = branch;
  const firstChild = children[0];
  const ret = firstChild.codegenNode;
  // 这个vnodeCall这里比较简单，就是node本身
  const vnodeCall = getMemoedVNodeCall(ret);

  injectProp(vnodeCall, keyProperty);
  return ret;
}

// 把属性注入到node的props中
export function injectProp(node, prop) {
  let propsWithInjection;

  let props =
    node.type === NodeTypes.VNODE_CALL ? node.props : node.arguments[2];

  if (props == null || isString(props)) {
    propsWithInjection = createObjectExpression([prop]);
  }

  if (node.type === NodeTypes.VNODE_CALL) {
    node.props = propsWithInjection;
  }
}

export function createObjectExpression(properties) {
  return {
    type: NodeTypes.JS_OBJECT_EXPRESSION,
    loc: {},
    properties,
  };
}
