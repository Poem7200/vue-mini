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

export function createRoot(children) {
  return {
    type: NodeTypes.ROOT,
    children,
    loc: {},
  };
}

export function baseParse(content: string) {
  const context = createParserContext(content);

  const children = parseChildren(context, []);

  return createRoot(children);
}

function parseChildren(context: ParserContext, ancestors) {
  const nodes = [];

  while (!isEnd(context, ancestors)) {
    const s = context.source;

    let node;

    if (startsWith(s, "{{")) {
      // 模板语法
      node = parseInterpolation(context);
    } else if (s[0] === "<") {
      // 可能是标签的开始
      if (/[a-z]/i.test(s[1])) {
        // 确定是标签的开始
        node = parseElement(context, ancestors);
      }
    }

    // 如果检测出来不是node节点，说明是文本，要做文本的处理
    if (!node) {
      node = parseText(context);
    }

    // 把当前处理好的节点push
    pushNode(nodes, node);
  }

  return nodes;
}

function parseInterpolation(context: ParserContext) {
  // 模板表达式以{{ XX }}格式呈现
  const [open, close] = ["{{", "}}"];

  advanceBy(context, open.length);

  const closeIndex = context.source.indexOf(close, open.length);
  const preTrimContext = parseTextData(context, closeIndex);
  const content = preTrimContext.trim();

  advanceBy(context, close.length);

  return {
    type: NodeTypes.INTERPOLATION,
    content: {
      type: NodeTypes.SIMPLE_EXPRESSION,
      isStatic: false,
      content,
    },
  };
}

function parseElement(context: ParserContext, ancestors) {
  // 解析标签的tag
  const element = parseTag(context, TagType.Start);

  // 处理子标签
  ancestors.push(element);
  const children = parseChildren(context, ancestors);
  // 因为ancestors仅限于isEnd判断逻辑，所以结束以后要pop出来
  ancestors.pop();

  element.children = children;

  // 结束标签
  if (startsWithEndTagOpen(context.source, element.tag)) {
    parseTag(context, TagType.End);
  }

  return element;
}

function advanceSpaces(context: ParserContext): void {
  const match = /^[\t\r\n\f ]+/.exec(context.source);
  if (match) {
    advanceBy(context, match[0].length);
  }
}

function parseAttributes(context, type) {
  const props: any = [];

  // 属性名的存放
  const attributeNames = new Set<string>();

  // 当源码长度不为0，且剩下的内容不是标签结束的时候，说明还有属性，要循环处理
  while (
    context.source.length > 0 &&
    !startsWith(context.source, ">") &&
    !startsWith(context.source, "/>")
  ) {
    const attr = parseAttribute(context, attributeNames);
    // 只有是开始标签，才去存放属性
    if (type === TagType.Start) {
      props.push(attr);
    }
    // 两个属性之间有空格，要右移到下一个属性/结尾位置
    advanceSpaces(context);
  }

  return props;
}

function parseAttribute(context: ParserContext, nameSet: Set<string>) {
  // 拿到属性名
  const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source)!;
  const name = match[0];

  nameSet.add(name);

  // 右移继续准备拿到属性值
  advanceBy(context, name.length);

  let value: any = undefined;

  // 如果能有=出现，后面就是属性值了
  if (/^[^\t\r\n\f ]*=/.test(context.source)) {
    advanceSpaces(context);
    advanceBy(context, 1);
    advanceSpaces(context);
    // 获取属性值
    value = parseAttributeValue(context);
  }

  // v-指令处理
  if (/^(v-[A-Za-z0-9-]|:|\.|@|#)/.test(name)) {
    // 拿到v-指令的名字（例如if/for等等）
    const match =
      /(?:^v-([a-z0-9-]+))?(?:(?::|^\.|^@|^#)(\[[^\]]+\]|[^\.]+))?(.+)?$/i.exec(
        name
      )!;

    let dirName = match[1];

    return {
      type: NodeTypes.DIRECTIVE,
      name: dirName,
      // 指令绑定的值
      exp: value && {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: value.content,
        isStatic: false,
        loc: {},
      },
      art: undefined,
      modifiers: undefined,
      loc: {},
    };
  }

  // 普通属性处理
  return {
    type: NodeTypes.ATTRIBUTE,
    name,
    value: value && {
      type: NodeTypes.TEXT,
      content: value.content,
      loc: {},
    },
    loc: {},
  };
}

// 单个属性值的处理
function parseAttributeValue(context: ParserContext) {
  // 属性内容
  let content = "";

  // 第一位是引号（单双不确定，所以要拿到它，后面对应去匹配）
  const quote = context.source[0];
  const isQuoted = quote === `"` || quote === `'`;

  if (isQuoted) {
    // 右移引号宽度
    advanceBy(context, 1);
    const endIndex = context.source.indexOf(quote);
    // 没有找到结束引号，则后面内容都是属性值
    if (endIndex === -1) {
      content = parseTextData(context, context.source.length);
    } else {
      content = parseTextData(context, endIndex);
      // 右移引号宽度
      advanceBy(context, 1);
    }
  }

  return { content, isQuoted, loc: {} };
}

function parseText(context: ParserContext) {
  // 如果遇到下方的，表示普通文本的结束
  const endTokens = ["<", "{{"];

  // 临时用context的结尾当text的结尾，后面修正正确的结尾位置
  let endIndex = context.source.length;

  // 自后向前比对，找到正确的text结尾位置
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

// 拿到文本数据，并把源代码光标右移
function parseTextData(context: ParserContext, length: number) {
  const rawText = context.source.slice(0, length);

  advanceBy(context, length);

  return rawText;
}

function parseTag(context: ParserContext, type: TagType) {
  // type用来看后续位移长度

  const match: any = /^<\/?([a-z][^\r\n\t\f />]*)/i.exec(context.source);
  const tag = match[1];

  // 根据tag的名称长度，右移source位置（<+tag名字）
  advanceBy(context, match[0].length);

  // 属性和指令的处理
  advanceSpaces(context);
  let props = parseAttributes(context, type);

  // 判断是否为自闭合标签：是的话右移2，否则右移1
  let isSelfClosing = startsWith(context.source, "/>");
  advanceBy(context, isSelfClosing ? 2 : 1);

  let tagType = ElementTypes.ELEMENT;

  return {
    // 标记当前是element节点
    type: NodeTypes.ELEMENT,
    tag,
    tagType,
    props,
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

// 判断是否为结束标签的开始（例如</div，这一段完整的才是结束标签的开始）
function startsWithEndTagOpen(source: string, tag: string): boolean {
  /**
   * 三个条件
   * 1.以</开头
   * 2.从2-tag结束为止截出来的内容，和给的tag一样（确定了同名tag）
   * 3.后面要紧跟有效的结束内容，而不是继续有其他一些文字
   */
  return (
    startsWith(source, "</") &&
    source.slice(2, 2 + tag.length).toLowerCase() === tag.toLowerCase() &&
    /[\t\r\n\f />]/.test(source[2 + tag.length] || ">")
  );
}

function startsWith(source: string, searchString: string): boolean {
  return source.startsWith(searchString);
}

function advanceBy(context: ParserContext, numberOfCharacters: number) {
  const { source } = context;
  context.source = source.slice(numberOfCharacters);
}
