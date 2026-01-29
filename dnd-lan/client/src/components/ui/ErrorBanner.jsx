import React from "react";

export default function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="banner error">
      <div style={{ fontWeight: 1000 }}>Ошибка</div>
      <div className="small" style={{ marginTop: 6 }}>{message}</div>
      {onRetry ? <button className="btn secondary" style={{ marginTop: 10 }} onClick={onRetry}>Повторить</button> : null}
    </div>
  );
}
