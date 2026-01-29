import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import PolaroidFrame from "./vintage/PolaroidFrame.jsx";

export default function QRCodeCard({ url }) {
  const [dataUrl, setDataUrl] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { margin: 1, scale: 6 }).then((u) => alive && setDataUrl(u));
    return () => { alive = false; };
  }, [url]);

  return (
    <div className="card taped">
      <div style={{ fontWeight: 800, marginBottom: 8 }}>QR для игроков</div>
      <div className="paper-note" style={{ marginBottom: 10 }}>{url}</div>
      <div style={{ marginTop: 4 }}>
        <PolaroidFrame
          src={dataUrl}
          alt="QR"
          fallback="QR"
          className="qr"
          innerStyle={{ background: "#fff" }}
        />
      </div>
    </div>
  );
}
