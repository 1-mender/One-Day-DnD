import React from "react";
import { createPortal } from "react-dom";

export default function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  const content = (
    <div className="vintage-modal-overlay" onMouseDown={onClose}>
      <div className="vintage-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="vintage-modal-header">
          <div className="vintage-modal-title">{title || ""}</div>
          <button className="btn secondary" onClick={onClose}>X</button>
        </div>
        <div className="vintage-modal-body">{children}</div>
      </div>
    </div>
  );
  if (typeof document === "undefined") return content;
  return createPortal(content, document.body);
}
