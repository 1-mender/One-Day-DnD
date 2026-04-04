import React, { Suspense } from "react";

const MarkdownRichView = React.lazy(() => import("./MarkdownRichView.js"));

function MarkdownFallback({ source }) {
  const text = String(source || "");
  if (!text.trim()) return null;
  return (
    <div style={{ lineHeight: 1.45, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
      {text}
    </div>
  );
}

export default function MarkdownView({ source }) {
  const text = String(source || "");
  if (!text.trim()) return null;
  return (
    <Suspense fallback={<MarkdownFallback source={text} />}>
      <MarkdownRichView source={text} />
    </Suspense>
  );
}
