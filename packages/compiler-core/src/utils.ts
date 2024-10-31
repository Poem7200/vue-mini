import { NodeTypes } from "./ast";
import { CREATE_ELEMENT_VNODE, CREATE_VNODE } from "./runtimeHelpers";

export function isText(node) {
  return [NodeTypes.INTERPOLATION, NodeTypes.TEXT].includes(node.type);
}

export function getVNodeHelper(ssr: boolean, isComponent: boolean) {
  return ssr || isComponent ? CREATE_VNODE : CREATE_ELEMENT_VNODE;
}

export function getMemoedVNodeCall(node) {
  return node;
}
