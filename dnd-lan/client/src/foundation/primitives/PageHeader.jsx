import React from "react";

export default function PageHeader({ title, subtitle = "", actions = null, className = "" }) {
  return (
    <div className={`fd-page-header ${className}`.trim()}>
      <div>
        <h2 className="fd-page-header-title">{title}</h2>
        {subtitle ? <div className="fd-page-header-subtitle">{subtitle}</div> : null}
      </div>
      {actions ? <div className="fd-page-header-actions">{actions}</div> : null}
    </div>
  );
}
