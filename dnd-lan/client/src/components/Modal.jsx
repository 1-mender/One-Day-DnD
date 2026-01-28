import React from "react";

export default function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
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
}
