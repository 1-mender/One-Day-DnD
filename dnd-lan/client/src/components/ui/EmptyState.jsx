import React from "react";

export default function EmptyState({ title = "Пусто", hint = "" }) {
  return (
    <div className="banner empty">
      <div style={{ fontWeight: 1000 }}>{title}</div>
      {hint ? <div className="small" style={{ marginTop: 6 }}>{hint}</div> : null}
    </div>
  );
}
