import React from "react";
import { formatError } from "../../lib/formatError.js";

export default function ErrorBanner({ message, error, onRetry }) {
  const text = message || formatError(error, "");
  if (!text) return null;
  return (
    <div className="banner error">
      <div style={{ fontWeight: 1000 }}>Ошибка</div>
      <div className="small" style={{ marginTop: 6 }}>{text}</div>
      {onRetry ? <button className="btn secondary" style={{ marginTop: 10 }} onClick={onRetry}>Повторить</button> : null}
    </div>
  );
}
