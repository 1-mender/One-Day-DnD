import React from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { normalizeSafeUrl } from "./markdownParser.js";

const markdownComponents = {
  a({ children, href }) {
    const safeHref = normalizeSafeUrl(href);
    if (!safeHref) return React.createElement(React.Fragment, null, children);
    const external = /^https?:\/\//i.test(safeHref);
    return React.createElement(
      "a",
      {
        href: safeHref,
        target: external ? "_blank" : undefined,
        rel: external ? "noreferrer" : undefined
      },
      children
    );
  },
  img({ alt, src }) {
    const safeSrc = normalizeSafeUrl(src);
    if (!safeSrc) {
      return alt ? React.createElement(React.Fragment, null, alt) : null;
    }
    return React.createElement("img", {
      src: safeSrc,
      alt: String(alt || ""),
      loading: "lazy"
    });
  }
};

export default function MarkdownRichView({ source }) {
  const text = String(source || "");
  if (!text.trim()) return null;
  return React.createElement(
    "div",
    { style: { lineHeight: 1.45 } },
    React.createElement(
      ReactMarkdown,
      {
        skipHtml: true,
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSanitize],
        components: markdownComponents
      },
      text
    )
  );
}
