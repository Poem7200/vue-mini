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

export const transformIf = createStructuralDirectiveTransform(
  /^(if|else|else-if)$/,
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
  if (dir.name === "if") {
    const branch = createIfBranch(node, dir);

    const ifNode = {
      type: NodeTypes.IF,
      loc: {},
      branches: [branch],
    };

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

function createCodegenNodeForBranch(
  branch,
  keyIndex,
  context: TransformContext
) {
  if (branch.condition) {
    return createConditionalExpression(
      branch.condition,
      createChildrenCodegenNode(branch, keyIndex),
      createCallExpression(context.helper(CREATE_COMMENT), ['"v-if"', "true"])
    );
  } else {
    return createChildrenCodegenNode(branch, keyIndex);
  }
}

// 创建指定子节点的codegen
function createChildrenCodegenNode(branch, keyIndex: number) {
  const keyProperty = createObjectProperty(
    `key`,
    createSimpleExpression(`${keyIndex}`, false)
  );

  const { children } = branch;
  const firstChild = children[0];
  const ret = firstChild.codegenNode;
  const vnodeCall = getMemoedVNodeCall(ret);

  injectProp(vnodeCall, keyProperty);
}

export function injectProp(node, prop) {
  let propsWithInjection;

  let props =
    node.type === NodeTypes.VNODE_CALL ? node.props : node.argumnets[2];

  if (props === null || isString(props)) {
    propsWithInjection = createObjectExpression([prop]);
  }

  node.props = propsWithInjection;
}

export function createObjectExpression(properties) {
  return {
    type: NodeTypes.JS_OBJECT_EXPRESSION,
    loc: {},
    properties,
  };
}
