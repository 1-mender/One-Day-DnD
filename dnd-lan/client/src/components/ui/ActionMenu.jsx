import React, { useEffect, useId, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

function findNextEnabledIndex(items, from, step) {
  if (!items.length) return -1;
  let i = from;
  for (let guard = 0; guard < items.length; guard += 1) {
    i = (i + step + items.length) % items.length;
    if (!items[i]?.disabled) return i;
  }
  return -1;
}

export default function ActionMenu({ items = [], align = "right", label = "Действия" }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const itemRefs = useRef([]);
  const list = (items || []).filter(Boolean);
  const menuId = useId();

  const closeMenu = () => {
    setOpen(false);
    setActiveIndex(-1);
  };

  const openMenu = (initialIndex = 0) => {
    if (!list.length) return;
    setOpen(true);
    setActiveIndex(initialIndex);
  };

  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, list.length);
  }, [list.length]);

  useEffect(() => {
    if (!open) return () => {};
    const onDoc = (e) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) closeMenu();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const node = itemRefs.current[activeIndex];
    if (!node) return;
    window.requestAnimationFrame(() => node.focus());
  }, [activeIndex, open]);

  if (!list.length) return null;

  return (
    <div className="action-menu" data-align={align} ref={rootRef}>
      <button
        type="button"
        className="btn secondary icon-btn action-menu-btn"
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          if (open) {
            closeMenu();
            return;
          }
          const first = findNextEnabledIndex(list, -1, 1);
          openMenu(first);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            const first = findNextEnabledIndex(list, -1, 1);
            openMenu(first);
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            const last = findNextEnabledIndex(list, 0, -1);
            openMenu(last);
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open ? "true" : "false"}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        title={label}
      >
        <MoreHorizontal className="icon" aria-hidden="true" />
      </button>
      {open ? (
        <div
          id={menuId}
          className="action-menu-list"
          role="menu"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              closeMenu();
              triggerRef.current?.focus();
              return;
            }
            if (e.key === "Tab") {
              closeMenu();
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              const next = findNextEnabledIndex(list, activeIndex, 1);
              if (next >= 0) setActiveIndex(next);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              const prev = findNextEnabledIndex(list, activeIndex, -1);
              if (prev >= 0) setActiveIndex(prev);
              return;
            }
            if (e.key === "Home") {
              e.preventDefault();
              const first = findNextEnabledIndex(list, -1, 1);
              if (first >= 0) setActiveIndex(first);
              return;
            }
            if (e.key === "End") {
              e.preventDefault();
              const last = findNextEnabledIndex(list, 0, -1);
              if (last >= 0) setActiveIndex(last);
            }
          }}
        >
          {list.map((item, idx) => {
            const Icon = item.icon || null;
            const tone = item.tone ? ` ${item.tone}` : "";
            return (
              <button
                key={`${item.label}-${idx}`}
                type="button"
                ref={(node) => {
                  itemRefs.current[idx] = node;
                }}
                role="menuitem"
                className={`action-menu-item${tone}`.trim()}
                tabIndex={idx === activeIndex ? 0 : -1}
                onClick={(e) => {
                  e.stopPropagation();
                  if (item.disabled) return;
                  closeMenu();
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
