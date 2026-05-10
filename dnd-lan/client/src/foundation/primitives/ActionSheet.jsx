import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { getFocusable, getTrapFocusTarget, shouldCloseOnBackdropMouseDown } from "../../components/modalA11y.js";

export default function ActionSheet({ open, title = "", children, onClose }) {
  const sheetRef = useRef(null);
  const lastFocusedRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open || typeof document === "undefined") return () => {};
    lastFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusInitial = () => {
      const root = sheetRef.current;
      if (!root) return;
      const focusable = getFocusable(root);
      (focusable[0] || root).focus({ preventScroll: true });
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
      }
    };

    const onFocusIn = (event) => {
      const root = sheetRef.current;
      if (!root || root.contains(event.target)) return;
      const focusable = getFocusable(root);
      (focusable[0] || root).focus({ preventScroll: true });
    };

    const timer = setTimeout(focusInitial, 0);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      document.body.style.overflow = prevOverflow;
      if (lastFocusedRef.current?.focus) {
        lastFocusedRef.current.focus({ preventScroll: true });
      }
    };
  }, [open, onClose]);

  const onSheetKeyDown = (event) => {
    if (event.key !== "Tab") return;
    const root = sheetRef.current;
    if (!root) return;
    const focusable = getFocusable(root);
    if (!focusable.length) {
      event.preventDefault();
      root.focus({ preventScroll: true });
      return;
    }
    const active = document.activeElement;
    const target = getTrapFocusTarget(focusable, root.contains(active) ? active : null, event.shiftKey);
    if (target) {
      event.preventDefault();
      target.focus({ preventScroll: true });
    }
  };

  if (!open) return null;
  const content = (
    <div
      className="action-sheet-overlay"
      onPointerDown={(event) => {
        if (shouldCloseOnBackdropMouseDown(event.target, event.currentTarget)) onClose?.();
      }}
    >
      <div
        ref={sheetRef}
        className="action-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : "Действия"}
        tabIndex={-1}
        onKeyDown={onSheetKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="action-sheet-handle" aria-hidden="true" />
        {title ? <div id={titleId} className="action-sheet-title">{title}</div> : null}
        <div className="action-sheet-body">{children}</div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return content;
  return createPortal(content, document.body);
}
