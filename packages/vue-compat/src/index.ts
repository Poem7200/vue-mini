import { compile } from "@vue/compiler-dom";
import { registerRuntimeCompile } from "packages/runtime-core/src/component";

function compileToFunction(template, options?) {
  const { code } = compile(template, options);

  const render = new Function(code)();

  return render;
}

registerRuntimeCompile(compileToFunction);

export { compileToFunction as compile };
