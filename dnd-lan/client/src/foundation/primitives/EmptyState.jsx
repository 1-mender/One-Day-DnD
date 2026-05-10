import React from "react";
import { t } from "../../i18n/index.js";

export default function EmptyState({ title = t("emptyState.defaultTitle"), hint = "", className = "" }) {
  return (
    <div className={`fd-empty-state ${className}`.trim()}>
      <h3 className="fd-empty-state-title">{title}</h3>
      {hint ? <div className="fd-empty-state-hint">{hint}</div> : null}
    </div>
  );
}
