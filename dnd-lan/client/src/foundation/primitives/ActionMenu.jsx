import React, { useEffect, useId, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { t } from "../../i18n/index.js";

function findNextEnabledIndex(items, from, step) {
  if (!items.length) return -1;
  let idx = from;
  for (let guard = 0; guard < items.length; guard += 1) {
    idx = (idx + step + items.length) % items.length;
    if (!items[idx]?.disabled) return idx;
  }
  return -1;
}

export default function ActionMenu({ items = [], align = "right", label = t("actionMenu.defaultLabel") }) {
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
    try {
      const root = rootRef.current;
      const active = typeof document !== "undefined" ? document.activeElement : null;
      if (root && active && root.contains(active)) {
        triggerRef.current?.focus?.({ preventScroll: true });
      }
    } catch {
      // ignore focus restoration failures
    }
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
    const onDoc = (event) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target)) closeMenu();
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
        onClick={(event) => {
          event.stopPropagation();
          if (open) {
            closeMenu();
            return;
          }
          const first = findNextEnabledIndex(list, -1, 1);
          openMenu(first);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            const first = findNextEnabledIndex(list, -1, 1);
            openMenu(first);
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
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
          aria-label={label}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closeMenu();
              triggerRef.current?.focus();
              return;
            }
            if (event.key === "Tab") {
              closeMenu();
              return;
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              const next = findNextEnabledIndex(list, activeIndex, 1);
              if (next >= 0) setActiveIndex(next);
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              const prev = findNextEnabledIndex(list, activeIndex, -1);
              if (prev >= 0) setActiveIndex(prev);
              return;
            }
            if (event.key === "Home") {
              event.preventDefault();
              const first = findNextEnabledIndex(list, -1, 1);
              if (first >= 0) setActiveIndex(first);
              return;
            }
            if (event.key === "End") {
              event.preventDefault();
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
                aria-disabled={item.disabled ? "true" : "false"}
                onClick={(event) => {
                  event.stopPropagation();
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
