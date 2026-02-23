import React, { createContext, useContext, useMemo, useRef, useState } from "react";
import { t } from "../../i18n/index.js";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(1);

  const api = useMemo(() => {
    const push = (toastInput) => {
      const id = idRef.current++;
      const toast = { id, kind: toastInput.kind || "ok", title: toastInput.title || "", message: toastInput.message || "" };
      setToasts((prev) => [toast, ...prev].slice(0, 4));
      const ttl = toastInput.ttlMs ?? (toast.kind === "error" ? 4500 : 2600);
      window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), ttl);
    };

    return {
      success: (message, title = t("toast.successTitle")) => push({ kind: "ok", title, message }),
      warn: (message, title = t("toast.warnTitle")) => push({ kind: "warn", title, message }),
      error: (message, title = t("toast.errorTitle")) => push({ kind: "error", title, message }),
      info: (message, title = t("toast.infoTitle")) => push({ kind: "ok", title, message }),
      _remove: (id) => setToasts((prev) => prev.filter((x) => x.id !== id))
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
