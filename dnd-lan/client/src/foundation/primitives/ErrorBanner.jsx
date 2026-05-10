import React from "react";
import { t } from "../../i18n/index.js";
import { mapError } from "../../lib/errorMapper.js";

export default function ErrorBanner({ message, error, onRetry, className = "" }) {
  const mapped = message ? { message, hint: "" } : mapError(error, "");
  const text = mapped?.message || "";
  if (!text) return null;

  return (
    <div className={`fd-error-banner ${className}`.trim()} role="alert">
      <div className="fd-error-banner-title">{t("errorBanner.title")}</div>
      <div className="fd-error-banner-text">{text}</div>
      {mapped?.hint ? <div className="fd-error-banner-hint">{mapped.hint}</div> : null}
      {onRetry ? (
        <button className="btn secondary fd-error-banner-action" onClick={onRetry}>
          {t("common.retry")}
        </button>
      ) : null}
    </div>
  );
}
