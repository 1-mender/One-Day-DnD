import React from "react";

const LIST_ITEM_RE = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const FENCE_RE = /^```([a-z0-9_-]+)?\s*$/i;

function normalizeSafeUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  if (value.startsWith("/") || value.startsWith("#")) return value;
  try {
    const parsed = new URL(value, window.location.origin);
    if (["http:", "https:", "mailto:"].includes(parsed.protocol)) {
      return parsed.href;
    }
  } catch {
    // invalid URL becomes plain text
  }
  return "";
}

function parseInline(text, keyPrefix = "i") {
  const source = String(text || "");
  const nodes = [];
  let cursor = 0;
  let tokenIndex = 0;

  function pushText(value) {
    if (value) nodes.push(value);
  }

  function pushNode(node) {
    nodes.push(React.cloneElement(node, { key: `${keyPrefix}-${tokenIndex++}` }));
  }

  while (cursor < source.length) {
    const rest = source.slice(cursor);

    const codeMatch = rest.match(/^`([^`]+)`/);
    if (codeMatch) {
      pushNode(<code>{codeMatch[1]}</code>);
      cursor += codeMatch[0].length;
      continue;
    }

    const imageMatch = rest.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imageMatch) {
      const src = normalizeSafeUrl(imageMatch[2]);
      if (src) {
        pushNode(<img src={src} alt={imageMatch[1]} />);
      } else {
        pushText(imageMatch[1]);
      }
      cursor += imageMatch[0].length;
      continue;
    }

    const linkMatch = rest.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      const href = normalizeSafeUrl(linkMatch[2]);
      if (href) {
        pushNode(
          <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined}>
            {parseInline(linkMatch[1], `${keyPrefix}-a${tokenIndex}`)}
          </a>
        );
      } else {
        pushText(linkMatch[1]);
      }
      cursor += linkMatch[0].length;
      continue;
    }

    const strongMatch = rest.match(/^\*\*([^*]+)\*\*/);
    if (strongMatch) {
      pushNode(<strong>{parseInline(strongMatch[1], `${keyPrefix}-b${tokenIndex}`)}</strong>);
      cursor += strongMatch[0].length;
      continue;
    }

    const emMatch = rest.match(/^\*([^*\n]+)\*/);
    if (emMatch) {
      pushNode(<em>{parseInline(emMatch[1], `${keyPrefix}-e${tokenIndex}`)}</em>);
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

function parseBlocks(source) {
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

export default function MarkdownView({ source }) {
  const text = String(source || "");
  if (!text.trim()) return null;
  const blocks = parseBlocks(text);

  return (
    <div style={{ lineHeight: 1.45 }}>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const Tag = `h${Math.min(6, Math.max(1, Number(block.level || 1)))}`;
          return <Tag key={`h-${index}`}>{parseInline(block.text, `h${index}`)}</Tag>;
        }
        if (block.type === "blockquote") {
          return <blockquote key={`q-${index}`}>{parseInline(block.text, `q${index}`)}</blockquote>;
        }
        if (block.type === "unordered-list") {
          return (
            <ul key={`ul-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`uli-${index}-${itemIndex}`}>{parseInline(item, `uli${index}-${itemIndex}`)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "ordered-list") {
          return (
            <ol key={`ol-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`oli-${index}-${itemIndex}`}>{parseInline(item, `oli${index}-${itemIndex}`)}</li>
              ))}
            </ol>
          );
        }
        if (block.type === "code") {
          return (
            <pre key={`pre-${index}`}>
              <code>{block.text}</code>
            </pre>
          );
        }
        return <p key={`p-${index}`}>{parseInline(block.text, `p${index}`)}</p>;
      })}
    </div>
  );
}
