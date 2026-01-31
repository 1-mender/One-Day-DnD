import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function QRCodeCard({ url, className = "" }) {
  const [dataUrl, setDataUrl] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { margin: 2, scale: 6 }).then((u) => alive && setDataUrl(u));
    return () => { alive = false; };
  }, [url]);

  return (
    <div className={`card taped qr-card ${className}`.trim()}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>QR для игроков</div>
      <div className="paper-note qr-url" style={{ marginBottom: 10 }}>{url}</div>
      <div className="qr-wrap">
        {dataUrl ? (
          <img className="qr-plain" src={dataUrl} alt="QR" />
        ) : (
          <div className="qr-plain qr-fallback">QR</div>
        )}
      </div>
    </div>
  );
}
