import React, { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

export default function ActionMenu({ items = [], align = "right", label = "Actions" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const list = (items || []).filter(Boolean);

  useEffect(() => {
    if (!open) return () => {};
    const onDoc = (e) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  if (!list.length) return null;

  return (
    <div className="action-menu" data-align={align} ref={rootRef}>
      <button
        type="button"
        className="btn secondary icon-btn action-menu-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open ? "true" : "false"}
        aria-label={label}
        title={label}
      >
        <MoreHorizontal className="icon" aria-hidden="true" />
      </button>
      {open ? (
        <div className="action-menu-list" role="menu">
          {list.map((item, idx) => {
            const Icon = item.icon || null;
            const tone = item.tone ? ` ${item.tone}` : "";
            return (
              <button
                key={`${item.label}-${idx}`}
                type="button"
                role="menuitem"
                className={`action-menu-item${tone}`.trim()}
                onClick={() => {
                  if (item.disabled) return;
                  setOpen(false);
                  item.onClick?.();
                }}
                disabled={item.disabled}
              >
                {Icon ? <Icon className="icon" aria-hidden="true" /> : null}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
