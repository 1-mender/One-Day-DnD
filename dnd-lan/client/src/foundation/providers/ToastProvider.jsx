import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { t } from "../../i18n/index.js";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(1);
  const timeoutIds = useRef(new Map());

  useEffect(() => () => {
    for (const timeoutId of timeoutIds.current.values()) {
      window.clearTimeout(timeoutId);
    }
    timeoutIds.current.clear();
  }, []);

  const api = useMemo(() => {
    const removeById = (id) => {
      const timeoutId = timeoutIds.current.get(id);
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
        timeoutIds.current.delete(id);
      }
      setToasts((prev) => prev.filter((x) => x.id !== id));
    };

    const push = (toastInput) => {
      const id = idRef.current++;
      const toast = {
        id,
        kind: toastInput.kind || "ok",
        title: toastInput.title || "",
        message: toastInput.message || ""
      };
      setToasts((prev) => [toast, ...prev].slice(0, 4));
      const ttl = toastInput.ttlMs ?? (toast.kind === "error" ? 4500 : 2600);
      const timeoutId = window.setTimeout(() => removeById(id), ttl);
      timeoutIds.current.set(id, timeoutId);
    };

    return {
      success: (message, title = t("toast.successTitle")) => push({ kind: "ok", title, message }),
      warn: (message, title = t("toast.warnTitle")) => push({ kind: "warn", title, message }),
      error: (message, title = t("toast.errorTitle")) => push({ kind: "error", title, message }),
      info: (message, title = t("toast.infoTitle")) => push({ kind: "ok", title, message }),
      _remove: removeById
    };
  }, []);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toast-viewport">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.kind}`} role="status" aria-live="polite">
            <div className="toast-head">
              <div className="toast-title">{toast.title}</div>
              <button
                type="button"
                className="btn secondary"
                aria-label={t("toast.closeAria")}
                onClick={() => api._remove(toast.id)}
              >
                X
              </button>
            </div>
            <div className="toast-msg">{toast.message}</div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    return { success: () => {}, warn: () => {}, error: () => {}, info: () => {} };
  }
  return ctx;
}
