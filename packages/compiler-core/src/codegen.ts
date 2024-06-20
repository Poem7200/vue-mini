import { helperNameMap } from "./runtimeHelpers";

function createCodegenContext(ast) {
  const context = {
    code: "",
    runtimeGlobalName: "Vue",
    source: ast.loc.source,
    indentLevel: 0,
    helper(key) {
      return `_${helperNameMap[key]}`;
    },
    push(code) {
      context.code += code;
    },
    newline() {
      newline(context.indentLevel);
    },
    indent() {
      newline(++context.indentLevel);
    },
    deindent() {
      newline(--context.indentLevel);
    },
  };

  function newline(n: number) {
    context.code += "\n" + `  `.repeat(n);
  }

  return context;
}

export function generate(ast) {
  const context = createCodegenContext(ast);

  const { push, newline, indent, deindent } = context;
}
