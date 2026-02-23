import React from "react";

export default function EmptyState({ title, hint = "", className = "" }) {
  return (
    <div className={`fd-empty-state ${className}`.trim()}>
      <h3 className="fd-empty-state-title">{title}</h3>
      {hint ? <div className="fd-empty-state-hint">{hint}</div> : null}
    </div>
  );
}
