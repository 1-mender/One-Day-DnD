import React from "react";
import { mapError } from "../../lib/errorMapper.js";
import { t } from "../../i18n/index.js";

export default function ErrorBanner({ message, error, onRetry }) {
  const mapped = message ? { message, hint: "" } : mapError(error, "");
  const text = mapped?.message || "";
  if (!text) return null;
  return (
    <div className="banner error" role="alert">
      <div className="error-banner-title">{t("errorBanner.title")}</div>
      <div className="small error-banner-text">{text}</div>
      {mapped?.hint ? <div className="small error-banner-hint">{mapped.hint}</div> : null}
      {onRetry ? <button className="btn secondary error-banner-action" onClick={onRetry}>{t("common.retry")}</button> : null}
    </div>
  );
}
