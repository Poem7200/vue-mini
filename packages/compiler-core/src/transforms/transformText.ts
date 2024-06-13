import { NodeTypes } from "../ast";
import { isText } from "../utils";

// 把相邻的文本节点和表达式合并成一个表达式
export const transformText = (node, context) => {
  if (
    [
      NodeTypes.ROOT,
      NodeTypes.ELEMENT,
      NodeTypes.FOR,
      NodeTypes.IF_BRANCH,
    ].includes(node.type)
  ) {
    return () => {
      const children = node.children;

      let currentContainer;

      for (let i = 0; i < children.length; i++) {
        const child = children[i];

        if (isText(child)) {
          for (let j = i + 1; j < children.length; j++) {
            const next = children[j];

            if (isText(next)) {
              if (!currentContainer) {
                currentContainer = children[i] = createCompoundExpression(
                  [child],
                  child.loc
                );
              }

              currentContainer.children.push(` + `, next);

              children.splice(j, 1);
              j--;
            } else {
              currentContainer = undefined;
              break;
            }
          }
        }
      }
    };
  }
};

export function createCompoundExpression(children, loc) {
  return {
    type: NodeTypes.COMPOUND_EXPRESSION,
    loc,
    children,
  };
}
