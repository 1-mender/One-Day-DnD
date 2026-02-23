import React from "react";

export default function OfflineBanner({ online, details, tone = "offline" }) {
  if (online) return null;
  return (
    <div className={`offline-ribbon ${tone === "readonly" ? "readonly" : ""}`.trim()}>
      <div className="inner">
        {tone === "readonly" ? "Режим только чтения" : "Нет подключения. Пытаемся восстановить связь…"}
      </div>
      {details ? <div className="inner">{details}</div> : null}
    </div>
  );
}
