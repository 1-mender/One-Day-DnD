import React from "react";

export default function OfflineBanner({ online, details }) {
  if (online) return null;
  return (
    <div className="offline-ribbon">
      <div className="inner">
        Offline / Reconnecting... проверьте Wi-Fi и подождите пару секунд
      </div>
      {details ? <div className="inner">{details}</div> : null}
    </div>
  );
}
