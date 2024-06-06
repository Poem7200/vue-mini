export interface ParserContext {
  source: string;
}

function createParserContext(content: string): ParserContext {
  return {
    source: content,
  };
}

export function baseParse(content: string) {
  const context = createParserContext(content);
  console.log(context);

  return {};
}
