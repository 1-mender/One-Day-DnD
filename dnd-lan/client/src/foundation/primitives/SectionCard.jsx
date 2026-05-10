import React from "react";

export default function SectionCard({ title = "", subtitle = "", actions = null, children, className = "" }) {
  return (
    <section className={`fd-section-card ${className}`.trim()}>
      {(title || subtitle || actions) ? (
        <div className="fd-section-card-header">
          <div>
            {title ? <h3 className="fd-section-card-title">{title}</h3> : null}
            {subtitle ? <div className="fd-section-card-subtitle">{subtitle}</div> : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className="fd-section-card-body">{children}</div>
    </section>
  );
}
