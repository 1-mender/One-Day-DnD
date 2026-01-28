import React from "react";

export default function OfflineBanner({ online }) {
  if (online) return null;
  return (
    <div className="offline-ribbon">
      <div className="inner">
        Offline / Reconnecting... проверьте Wi-Fi и подождите пару секунд
      </div>
    </div>
  );
}
