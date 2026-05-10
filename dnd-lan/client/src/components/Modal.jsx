import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { t } from "../i18n/index.js";
import { getFocusable, getTrapFocusTarget, shouldCloseOnBackdropMouseDown } from "./modalA11y.js";

export default function Modal({ open, title, children, onClose, headerless = false, className = "", bodyClassName = "" }) {
  const dialogRef = useRef(null);
  const lastFocusedRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return () => {};

    lastFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    const focusInitial = () => {
      const root = dialogRef.current;
      if (!root) return;
      const focusable = getFocusable(root);
      const autoFocusNode = focusable.find((node) => node.hasAttribute("autofocus"));
      const target = autoFocusNode || focusable[0] || root;
      target.focus({ preventScroll: true });
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current?.();
      }
    };

    const onFocusIn = (event) => {
      const root = dialogRef.current;
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
      document.body.style.paddingRight = prevPaddingRight;
      if (lastFocusedRef.current?.focus) {
        lastFocusedRef.current.focus({ preventScroll: true });
      }
    };
  }, [open]);

  const onDialogKeyDown = (event) => {
    if (event.key !== "Tab") return;
    const root = dialogRef.current;
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
      className="vintage-modal-overlay tf-modal-overlay"
      onMouseDown={(event) => {
        if (shouldCloseOnBackdropMouseDown(event.target, event.currentTarget)) onCloseRef.current?.();
      }}
    >
      <div
        ref={dialogRef}
        className={`vintage-modal tf-modal ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={!title ? t("common.dialog", null, "Dialog") : undefined}
        tabIndex={-1}
        onKeyDown={onDialogKeyDown}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {!headerless ? (
          <div className="vintage-modal-header tf-modal-header">
            <div id={title ? titleId : undefined} className="vintage-modal-title tf-modal-title">{title || ""}</div>
            <button
              type="button"
              className="btn secondary tf-modal-close"
              onClick={() => onCloseRef.current?.()}
              aria-label={t("common.close", null, "Close")}
            >
              X
            </button>
          </div>
        ) : null}
        <div className={`vintage-modal-body tf-modal-body ${bodyClassName}`.trim()} role="document">{children}</div>
      </div>
    </div>
  );
  if (typeof document === "undefined") return content;
  return createPortal(content, document.body);
}
