import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import QRCodeCard from "../components/QRCodeCard.jsx";
import PlayerStatusPill from "../components/PlayerStatusPill.jsx";
import { connectSocket } from "../socket.js";

export default function DMDashboard() {
  const [info, setInfo] = useState(null);
  const [players, setPlayers] = useState([]);
  const socket = useMemo(() => connectSocket({ role: "dm" }), []);

  const load = useCallback(async () => {
    const i = await api.serverInfo();
    setInfo(i);
    const p = await api.dmPlayers();
    setPlayers(p.items || []);
  }, []);

  useEffect(() => {
    load().catch(() => {});
    socket.on("players:updated", () => load().catch(() => {}));
    socket.on("player:approved", () => load().catch(() => {}));
    socket.on("settings:updated", () => load().catch(() => {}));
    return () => socket.disconnect();
  }, [load, socket]);

  const url = (info?.urls?.[0] || "http://<LAN-IP>:3000");

  return (
    <div className="spread-grid">
      <div className="spread-col">
        <div className="card taped scrap-card paper-stack tilt-2">
          <div style={{ fontWeight: 900, fontSize: 20 }}>Dashboard</div>
          <div className="small">LAN IP/URL (покажите игрокам или дайте QR)</div>
          <hr />
          <div className="list">
            <div className="item">
              <div className="kv">
                <div style={{ fontWeight: 700 }}>URL для игроков</div>
                <div className="small">{url}</div>
              </div>
              <span className="badge">{info?.port || 3000}</span>
            </div>

            {info && (
              <div className="paper-note" style={{ marginTop: 6 }}>
                <div className="title">LAN подсказка</div>
                <div className="small">Устройства должны быть в одной Wi‑Fi сети. Если Windows спросит — разрешите доступ в Firewall (Private networks).</div>
              </div>
            )}

            <div className="item">
              <div className="kv">
                <div style={{ fontWeight: 700 }}>Bestiary (для игроков)</div>
                <div className="small">{info?.settings?.bestiaryEnabled ? "Enabled" : "Disabled"}</div>
              </div>
              <span className={`badge ${info?.settings?.bestiaryEnabled ? "ok" : "off"}`}>
                {info?.settings?.bestiaryEnabled ? "ON" : "OFF"}
              </span>
            </div>

            <div className="card taped">
              <div style={{ fontWeight: 800 }}>Подключены</div>
              <div className="small">Online/Offline обновляется по WebSocket</div>
              <hr />
              <div className="list">
                {players.map((p) => (
                  <div key={p.id} className="item">
                    <div className="kv">
                      <div style={{ fontWeight: 700 }}>{p.displayName}</div>
                      <div className="small">id: {p.id}</div>
                    </div>
                    <PlayerStatusPill status={p.status} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="spread-col">
        <QRCodeCard url={url} className="scrap-card paper-stack tilt-1" />
      </div>
    </div>
  );
}
