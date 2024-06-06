import { ElementTypes, NodeTypes } from "./ast";

const enum TagType {
  Start,
  End,
}

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

  const children = parseChildren(context, []);

  console.log(children);

  return {};
}

function parseChildren(context: ParserContext, ancestors) {
  const nodes = [];

  while (!isEnd(context, ancestors)) {
    const s = context.source;

    let node;

    if (startsWith(s, "{{")) {
      // TODO: 模板语法开始
    } else if (s[0] === "<") {
      if (/[a-z]/i.test(s[1])) {
        node = parseElement(context, ancestors);
      }
    }

    if (!node) {
      node = parseText(context);
    }

    pushNode(nodes, node);
  }

  return nodes;
}

function parseElement(context: ParserContext, ancestors) {
  const element = parseTag(context, TagType.Start);

  // 处理子标签
  ancestors.push(element);
  const children = parseChildren(context, ancestors);
  ancestors.pop();

  element.children = children;

  if (startsWithEndTagOpen(context.source, element.tag)) {
    parseTag(context, TagType.End);
  }

  return element;
}

function parseText(context: ParserContext) {
  // 如果遇到下方的，表示普通文本的结束
  const endTokens = ["<", "{{"];

  let endIndex = context.source.length;

  for (let i = 0; i < endTokens.length; i++) {
    const index = context.source.indexOf(endTokens[i], 1);

    if (index !== -1 && endIndex > index) {
      endIndex = index;
    }
  }

  const content = parseTextData(context, endIndex);

  return {
    type: NodeTypes.TEXT,
    content,
  };
}

function parseTextData(context: ParserContext, length: number) {
  const rawText = context.source.slice(0, length);

  advanceBy(context, length);

  return rawText;
}

function parseTag(context: ParserContext, type: TagType) {
  const match: any = /^<\/?([a-z][^\r\n\t\f />]*)/i.exec(context.source);
  const tag = match[1];

  // 右移图标
  advanceBy(context, match[0].length);

  // 判断是否为自闭合标签
  let isSelfClosing = startsWith(context.source, "/>");
  advanceBy(context, isSelfClosing ? 2 : 1);

  return {
    type: NodeTypes.ELEMENT,
    tag,
    TagType: ElementTypes.ELEMENT,
    props: [],
    children: [],
  };
}

function pushNode(nodes, node) {
  nodes.push(node);
}

// 判断当前标签是否为结束标签
function isEnd(context: ParserContext, ancestors) {
  const s = context.source;

  if (startsWith(s, "</")) {
    for (let i = ancestors.length - 1; i >= 0; i--) {
      if (startsWithEndTagOpen(s, ancestors[i].tag)) {
        return true;
      }
    }
  }

  return !s;
}

// 判断是否为结束标签的开始
function startsWithEndTagOpen(source: string, tag: string): boolean {
  return startsWith(source, "</");
}

function startsWith(source: string, searchString: string): boolean {
  return source.startsWith(searchString);
}

function advanceBy(context: ParserContext, numberOfCharacters: number) {
  const { source } = context;
  context.source = source.slice(numberOfCharacters);
}
