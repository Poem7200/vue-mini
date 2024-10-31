import { extend } from "@vue/shared";
import { baseParse } from "./parse";
import { transform } from "./transform";
import { generate } from "./codegen";
import { transformElement } from "./transforms/transformElement";
import { transformText } from "./transforms/transformText";
import { transformIf } from "./transforms/vif";

export function baseCompile(template: string, options = {}) {
  const ast = baseParse(template);

  transform(
    ast,
    extend(options, {
      nodeTransforms: [transformElement, transformText, transformIf],
    })
  );

  console.log(ast);

  return generate(ast);
}
