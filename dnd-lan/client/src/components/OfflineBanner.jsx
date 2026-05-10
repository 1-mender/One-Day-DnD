import React from "react";
import { t } from "../i18n/index.js";

export default function OfflineBanner({ online, details, tone = "offline" }) {
  if (online) return null;
  return (
    <div className={`offline-ribbon ${tone === "readonly" ? "readonly" : ""}`.trim()}>
      <div className="inner">
        {tone === "readonly" ? t("offlineBanner.readOnly") : t("offlineBanner.offline")}
      </div>
      {details ? <div className="inner">{details}</div> : null}
    </div>
  );
}
