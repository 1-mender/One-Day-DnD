import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

export default function MarkdownView({ source }) {
  const text = String(source || "");
  if (!text.trim()) return null;

  return (
    <div style={{ lineHeight: 1.45 }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
