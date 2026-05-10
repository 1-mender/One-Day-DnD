import React from "react";
import { createPortal } from "react-dom";

export default function ArcadeOverlay({ open, className, children }) {
  if (!open) return null;
  const content = <div className={className}>{children}</div>;
  if (typeof document === "undefined") return content;
  return createPortal(content, document.body);
}
