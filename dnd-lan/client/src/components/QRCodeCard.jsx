import React, { useEffect, useState } from "react";
import { t } from "../i18n/index.js";

export default function QRCodeCard({ url, className = "" }) {
  const [dataUrl, setDataUrl] = useState("");
  useEffect(() => {
    let alive = true;
    setDataUrl("");
    import("qrcode")
      .then((module) => module.default.toDataURL(url, { margin: 2, scale: 6 }))
      .then((nextUrl) => {
        if (alive) setDataUrl(nextUrl);
      })
      .catch(() => {
        if (alive) setDataUrl("");
      });
    return () => {
      alive = false;
    };
  }, [url]);

  return (
    <div className={`card taped qr-card ${className}`.trim()}>
      <div className="qr-card-title">{t("qrCard.title")}</div>
      <div className="paper-note qr-url qr-card-url">{url}</div>
      <div className="qr-wrap">
        {dataUrl ? (
          <img className="qr-plain" src={dataUrl} alt={t("qrCard.alt")} />
        ) : (
          <div className="qr-plain qr-fallback">{t("qrCard.fallback")}</div>
        )}
      </div>
    </div>
  );
}
