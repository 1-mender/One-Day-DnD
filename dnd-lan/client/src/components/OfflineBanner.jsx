import React from "react";

export default function OfflineBanner({ online, details, tone = "offline" }) {
  if (online) return null;
  return (
    <div className={`offline-ribbon ${tone === "readonly" ? "readonly" : ""}`.trim()}>
      <div className="inner">
        {tone === "readonly" ? "Read-only mode" : "Offline / Reconnecting... Check Wi-Fi and wait a few seconds."}
      </div>
      {details ? <div className="inner">{details}</div> : null}
    </div>
  );
}
