import React from "react";
import { t } from "../../i18n/index.js";

export default function EmptyState({ title = t("emptyState.defaultTitle"), hint = "" }) {
  return (
    <div className="banner empty">
      <div className="empty-state-title">{title}</div>
      {hint ? <div className="small empty-state-hint">{hint}</div> : null}
    </div>
  );
}
