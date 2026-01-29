import React, { createContext, useContext, useMemo, useRef, useState } from "react";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(1);

  const api = useMemo(() => {
    const push = (t) => {
      const id = idRef.current++;
      const toast = { id, kind: t.kind || "ok", title: t.title || "", message: t.message || "" };
      setToasts((p) => [toast, ...p].slice(0, 4));
      const ttl = t.ttlMs ?? (toast.kind === "error" ? 4500 : 2600);
      window.setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), ttl);
    };

    return {
      success: (message, title = "Готово") => push({ kind: "ok", title, message }),
      warn: (message, title = "Внимание") => push({ kind: "warn", title, message }),
      error: (message, title = "Ошибка") => push({ kind: "error", title, message }),
      info: (message, title = "Инфо") => push({ kind: "ok", title, message }),
      _remove: (id) => setToasts((p) => p.filter((x) => x.id !== id))
    };
  }, []);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toast-viewport">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <div className="toast-head">
              <div className="toast-title">{t.title}</div>
              <button className="btn secondary" onClick={() => api._remove(t.id)}>X</button>
            </div>
            <div className="toast-msg">{t.message}</div>
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
