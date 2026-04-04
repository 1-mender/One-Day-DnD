const LIST_ITEM_RE = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const FENCE_RE = /^```([a-z0-9_-]+)?\s*$/i;
const INLINE_IMAGE_RE = /^!\[([^\]]*)\]\(((?:[^()]|\([^()]*\))+)\)/;
const INLINE_LINK_RE = /^\[([^\]]+)\]\(((?:[^()]|\([^()]*\))+)\)/;

function getBaseOrigin() {
  return globalThis.window?.location?.origin || "http://127.0.0.1";
}

export function normalizeSafeUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  if (value.startsWith("/") || value.startsWith("#")) return value;
  try {
    const parsed = new URL(value, getBaseOrigin());
    if (["http:", "https:", "mailto:"].includes(parsed.protocol)) {
      return parsed.href;
    }
  } catch {
    // invalid URL becomes plain text
  }
  return "";
}

export function parseMarkdownInline(text) {
  const source = String(text || "");
  const nodes = [];
  let cursor = 0;

  function pushText(value) {
    if (!value) return;
    if (typeof nodes[nodes.length - 1] === "string") {
      nodes[nodes.length - 1] += value;
      return;
    }
    nodes.push(value);
  }

  while (cursor < source.length) {
    const rest = source.slice(cursor);

    const codeMatch = rest.match(/^`([^`]+)`/);
    if (codeMatch) {
      nodes.push({ type: "code", text: codeMatch[1] });
      cursor += codeMatch[0].length;
      continue;
    }

    const imageMatch = rest.match(INLINE_IMAGE_RE);
    if (imageMatch) {
      const src = normalizeSafeUrl(imageMatch[2]);
      if (src) {
        nodes.push({
          type: "image",
          src,
          alt: imageMatch[1]
        });
      } else {
        pushText(imageMatch[1]);
      }
      cursor += imageMatch[0].length;
      continue;
    }

    const linkMatch = rest.match(INLINE_LINK_RE);
    if (linkMatch) {
      const href = normalizeSafeUrl(linkMatch[2]);
      if (href) {
        nodes.push({
          type: "link",
          href,
          children: parseMarkdownInline(linkMatch[1])
        });
      } else {
        pushText(linkMatch[1]);
      }
      cursor += linkMatch[0].length;
      continue;
    }

    const strongMatch = rest.match(/^\*\*([^\n]+?)\*\*(?!\*)/);
    if (strongMatch) {
      nodes.push({
        type: "strong",
        children: parseMarkdownInline(strongMatch[1])
      });
      cursor += strongMatch[0].length;
      continue;
    }

    const emMatch = rest.match(/^\*([^*\n]+)\*/);
    if (emMatch) {
      nodes.push({
        type: "em",
        children: parseMarkdownInline(emMatch[1])
      });
      cursor += emMatch[0].length;
      continue;
    }

    const nextSpecial = rest.search(/[`!*[]/);
    if (nextSpecial <= 0) {
      pushText(rest[0]);
      cursor += 1;
    } else {
      pushText(rest.slice(0, nextSpecial));
      cursor += nextSpecial;
    }
  }

  return nodes.length ? nodes : [source];
}

function flushParagraph(blocks, paragraphLines) {
  if (!paragraphLines.length) return;
  blocks.push({
    type: "paragraph",
    text: paragraphLines.join(" ")
  });
  paragraphLines.length = 0;
}

function flushList(blocks, listState) {
  if (!listState.items.length) return;
  blocks.push({
    type: listState.ordered ? "ordered-list" : "unordered-list",
    items: listState.items.slice()
  });
  listState.items.length = 0;
  listState.ordered = false;
}

export function parseMarkdownBlocks(source) {
  const lines = String(source || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  const paragraphLines = [];
  const listState = { ordered: false, items: [] };
  let codeFence = null;

  for (const rawLine of lines) {
    const line = String(rawLine || "");
    const fenceMatch = line.match(FENCE_RE);
    if (fenceMatch) {
      if (codeFence) {
        blocks.push({
          type: "code",
          language: codeFence.language,
          text: codeFence.lines.join("\n")
        });
        codeFence = null;
      } else {
        flushParagraph(blocks, paragraphLines);
        flushList(blocks, listState);
        codeFence = {
          language: String(fenceMatch[1] || ""),
          lines: []
        };
      }
      continue;
    }

    if (codeFence) {
      codeFence.lines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph(blocks, paragraphLines);
      flushList(blocks, listState);
      continue;
    }

    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      flushParagraph(blocks, paragraphLines);
      flushList(blocks, listState);
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2]
      });
      continue;
    }

    if (line.startsWith("> ")) {
      flushParagraph(blocks, paragraphLines);
      flushList(blocks, listState);
      blocks.push({
        type: "blockquote",
        text: line.slice(2)
      });
      continue;
    }

    const listMatch = line.match(LIST_ITEM_RE);
    if (listMatch) {
      flushParagraph(blocks, paragraphLines);
      const ordered = /^\d+\.$/.test(listMatch[2]);
      if (listState.items.length && listState.ordered !== ordered) {
        flushList(blocks, listState);
      }
      listState.ordered = ordered;
      listState.items.push(listMatch[3]);
      continue;
    }

    if (listState.items.length) {
      flushList(blocks, listState);
    }
    paragraphLines.push(line.trim());
  }

  flushParagraph(blocks, paragraphLines);
  flushList(blocks, listState);
  if (codeFence) {
    blocks.push({
      type: "code",
      language: codeFence.language,
      text: codeFence.lines.join("\n")
    });
  }
  return blocks;
}
