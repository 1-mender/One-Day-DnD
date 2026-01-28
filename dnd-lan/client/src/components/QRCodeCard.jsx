import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function QRCodeCard({ url }) {
  const [dataUrl, setDataUrl] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { margin: 1, scale: 6 }).then((u) => alive && setDataUrl(u));
    return () => { alive = false; };
  }, [url]);

  return (
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: 8 }}>QR для игроков</div>
      <div className="small">{url}</div>
      <div style={{ marginTop: 10 }}>
        {dataUrl ? <img src={dataUrl} alt="QR" style={{ width: 220, borderRadius: 12, border: "1px solid #1f2a3a" }} /> : "Генерация…"}
      </div>
    </div>
  );
}
