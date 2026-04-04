import React from "react";
import { parseMarkdownBlocks, parseMarkdownInline } from "./markdownParser.js";

function renderInline(nodes, keyPrefix = "i") {
  return (Array.isArray(nodes) ? nodes : []).map((node, index) => {
    if (typeof node === "string") return node;
    const key = `${keyPrefix}-${index}`;
    if (node?.type === "code") return <code key={key}>{node.text}</code>;
    if (node?.type === "image") return <img key={key} src={node.src} alt={node.alt} />;
    if (node?.type === "link") {
      return (
        <a
          key={key}
          href={node.href}
          target={String(node.href || "").startsWith("http") ? "_blank" : undefined}
          rel={String(node.href || "").startsWith("http") ? "noreferrer" : undefined}
        >
          {renderInline(node.children, `${keyPrefix}-a${index}`)}
        </a>
      );
    }
    if (node?.type === "strong") {
      return <strong key={key}>{renderInline(node.children, `${keyPrefix}-b${index}`)}</strong>;
    }
    if (node?.type === "em") {
      return <em key={key}>{renderInline(node.children, `${keyPrefix}-e${index}`)}</em>;
    }
    return "";
  });
}

export default function MarkdownView({ source }) {
  const text = String(source || "");
  if (!text.trim()) return null;
  const blocks = parseMarkdownBlocks(text);

  return (
    <div style={{ lineHeight: 1.45 }}>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const Tag = `h${Math.min(6, Math.max(1, Number(block.level || 1)))}`;
          return <Tag key={`h-${index}`}>{renderInline(parseMarkdownInline(block.text), `h${index}`)}</Tag>;
        }
        if (block.type === "blockquote") {
          return <blockquote key={`q-${index}`}>{renderInline(parseMarkdownInline(block.text), `q${index}`)}</blockquote>;
        }
        if (block.type === "unordered-list") {
          return (
            <ul key={`ul-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`uli-${index}-${itemIndex}`}>
                  {renderInline(parseMarkdownInline(item), `uli${index}-${itemIndex}`)}
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "ordered-list") {
          return (
            <ol key={`ol-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`oli-${index}-${itemIndex}`}>
                  {renderInline(parseMarkdownInline(item), `oli${index}-${itemIndex}`)}
                </li>
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
        return <p key={`p-${index}`}>{renderInline(parseMarkdownInline(block.text), `p${index}`)}</p>;
      })}
    </div>
  );
}
