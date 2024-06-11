import { NodeTypes } from "../ast";

export const transformText = (node, context) => {
  if (
    [
      NodeTypes.ROOT,
      NodeTypes.ELEMENT,
      NodeTypes.FOR,
      NodeTypes.IF_BRANCH,
    ].includes(node.type)
  ) {
    return () => {};
  }
};
