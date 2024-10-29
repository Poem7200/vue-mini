import { NodeTypes } from "../ast";
import { isText } from "../utils";

// 把相邻的文本节点和表达式合并成一个表达式
// 例如 hello {{ msg }}
// 需要拼接成 hello + _toDisplayString(_ctx.msg)
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
      // 遍历所有子节点
      for (let i = 0; i < children.length; i++) {
        const child = children[i];

        if (isText(child)) {
          // 从当前节点的后一个开始遍历
          for (let j = i + 1; j < children.length; j++) {
            const next = children[j];
            // 如果紧接着的节点也是文本节点，要把两个节点合并起来
            if (isText(next)) {
              // 还没有容器的时候，创建一个复合表达式节点
              if (!currentContainer) {
                currentContainer = children[i] = createCompoundExpression(
                  [child],
                  child.loc
                );
              }

              // 把之前的内容和当前的合并
              currentContainer.children.push(` + `, next);
              // 处理好了下一个child，把下一个child删了，光标左移
              children.splice(j, 1);
              j--;
            } else {
              // 紧接着的节点不是文本节点，不需要合并
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
