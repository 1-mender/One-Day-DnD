import React, { useState } from "react";

export default function DMSettingsFold({
  title,
  description,
  summary,
  defaultOpen = false,
  children
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`dm-settings-fold${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="dm-settings-fold-summary"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="dm-settings-fold-main">
          <span className="dm-settings-fold-title">{title}</span>
          {description ? <span className="dm-settings-fold-description">{description}</span> : null}
        </span>
        <span className="dm-settings-fold-meta">
          {summary ? <span className="dm-settings-fold-badge">{summary}</span> : null}
          <span className="dm-settings-fold-icon" aria-hidden="true">{open ? "−" : "+"}</span>
        </span>
      </button>
      {open ? <div className="dm-settings-fold-body">{children}</div> : null}
    </section>
  );
}
