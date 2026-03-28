import React, { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import QRCodeCard from "../components/QRCodeCard.jsx";
import PlayerStatusPill from "../components/PlayerStatusPill.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { Globe2, QrCode, RadioTower, Users } from "lucide-react";

export default function DMDashboard() {
  const [info, setInfo] = useState(null);
  const [players, setPlayers] = useState([]);
  const [copyMsg, setCopyMsg] = useState("");
  const { socket } = useSocket();

  const load = useCallback(async () => {
    const i = await api.serverInfo();
    setInfo(i);
    const p = await api.dmPlayers();
    setPlayers(p.items || []);
  }, []);

  useEffect(() => {
    if (!socket) return () => {};
    load().catch(() => {});
    const onPlayers = () => load().catch(() => {});
    const onApproved = () => load().catch(() => {});
    const onSettings = () => load().catch(() => {});
    socket.on("players:updated", onPlayers);
    socket.on("player:approved", onApproved);
    socket.on("settings:updated", onSettings);
    return () => {
      socket.off("players:updated", onPlayers);
      socket.off("player:approved", onApproved);
      socket.off("settings:updated", onSettings);
    };
  }, [load, socket]);

  const url = (info?.urls?.[0] || "http://<LAN-IP>:3000");
  const onlineCount = players.filter((player) => String(player.status || "offline") === "online").length;
  const idleCount = players.filter((player) => String(player.status || "offline") === "idle").length;
  const offlineCount = players.length - onlineCount - idleCount;

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopyMsg("URL скопирован.");
      window.setTimeout(() => setCopyMsg(""), 1800);
    } catch {
      setCopyMsg("Не удалось скопировать.");
      window.setTimeout(() => setCopyMsg(""), 1800);
    }
  }

  return (
    <div className="spread-grid dm-dashboard-grid">
      <div className="spread-col">
        <div className="card taped scrap-card paper-stack tilt-2 tf-shell tf-dm-dashboard-shell">
          <div className="tf-page-head dm-dashboard-head">
            <div className="tf-page-head-main">
              <div className="tf-overline">Session command</div>
              <div className="tf-page-title dm-dashboard-title">Dashboard</div>
              <div className="small">LAN IP/URL для игроков, состояние партии и live roster.</div>
            </div>
            <div className="dm-dashboard-head-meta">
              <span className="badge secondary">Порт: {info?.port || 3000}</span>
            </div>
          </div>

          <div className="dm-dashboard-summary tf-stat-grid">
            <div className="tf-stat-card">
              <div className="small">Онлайн</div>
              <strong>{onlineCount}</strong>
            </div>
            <div className="tf-stat-card">
              <div className="small">Нет активности</div>
              <strong>{idleCount}</strong>
            </div>
            <div className="tf-stat-card">
              <div className="small">Оффлайн</div>
              <strong>{offlineCount}</strong>
            </div>
            <div className="tf-stat-card">
              <div className="small">Всего игроков</div>
              <strong>{players.length}</strong>
            </div>
          </div>

          <div className="list dm-dashboard-stack">
            <div className="tf-panel tf-command-bar dm-dashboard-url-card">
              <div className="tf-section-copy">
                <div className="tf-section-kicker">Party access</div>
                <div className="dm-dashboard-section-title">URL для игроков</div>
                <div className="small">Главная точка входа для шеринга и QR.</div>
              </div>
              <div className="dm-dashboard-url-actions">
                <div className="dm-dashboard-url-chip">
                  <Globe2 className="icon" aria-hidden="true" />
                  <span>{url}</span>
                </div>
                <button className="btn secondary" onClick={copyUrl}>Копировать URL</button>
              </div>
            </div>
            {copyMsg ? <div className="badge ok">{copyMsg}</div> : null}

            {info && (
              <div className="paper-note tf-panel dm-dashboard-note">
                <div className="title">LAN подсказка</div>
                <div className="small">Устройства должны быть в одной Wi‑Fi сети. Если Windows спросит — разрешите доступ в Firewall (Private networks).</div>
              </div>
            )}

            <div className="tf-panel dm-dashboard-toggle">
              <div className="kv">
                <div className="dm-dashboard-section-title">Bestiary (для игроков)</div>
                <div className="small">{info?.settings?.bestiaryEnabled ? "Enabled" : "Disabled"}</div>
              </div>
              <span className={`badge ${info?.settings?.bestiaryEnabled ? "ok" : "off"}`}>
                {info?.settings?.bestiaryEnabled ? "ON" : "OFF"}
              </span>
            </div>

            <div className="tf-panel dm-dashboard-roster">
              <div className="tf-section-head">
                <div className="tf-section-copy">
                  <div className="tf-section-kicker">Live roster</div>
                  <div className="dm-dashboard-section-title">Подключены</div>
                </div>
                <Users className="dm-dashboard-icon" aria-hidden="true" />
              </div>
              <div className="small">Online/Offline обновляется по WebSocket. Список полезен как быстрый пульт контроля.</div>
              <hr />
              <div className="list dm-dashboard-roster-list">
                {players.map((p) => (
                  <div key={p.id} className="item dm-dashboard-player-row">
                    <div className="kv">
                      <div className="dm-dashboard-player-name">{p.displayName}</div>
                      <div className="small">id: {p.id}</div>
                    </div>
                    <PlayerStatusPill status={p.status} />
                  </div>
                ))}
                {!players.length ? (
                  <div className="small">Игроки пока не подключались.</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

        <div className="spread-col">
        <div className="dm-dashboard-side-stack">
          <QRCodeCard url={url} className="scrap-card paper-stack tilt-1 tf-panel tf-dm-dashboard-qr" />
          <div className="tf-panel dm-dashboard-radio-card">
            <div className="tf-section-head">
              <div className="tf-section-copy">
                <div className="tf-section-kicker">Signal brief</div>
                <div className="dm-dashboard-section-title">Состояние партии</div>
              </div>
              <RadioTower className="dm-dashboard-icon" aria-hidden="true" />
            </div>
            <div className="list dm-dashboard-brief-list">
              <div className="item dm-dashboard-brief-item">
                <div className="kv">
                  <div className="dm-dashboard-player-name">Подключение</div>
                  <div className="small">Игроки заходят по одному URL: вручную или через QR.</div>
                </div>
                <span className="badge ok">READY</span>
              </div>
              <div className="item dm-dashboard-brief-item">
                <div className="kv">
                  <div className="dm-dashboard-player-name">Roster feed</div>
                  <div className="small">Статусы игроков приходят через WebSocket.</div>
                </div>
                <span className="badge secondary">{players.length}</span>
              </div>
              <div className="item dm-dashboard-brief-item">
                <div className="kv">
                  <div className="dm-dashboard-player-name">Бестиарий</div>
                  <div className="small">Игрокам сейчас {info?.settings?.bestiaryEnabled ? "доступен" : "скрыт"} общий каталог монстров.</div>
                </div>
                <span className={`badge ${info?.settings?.bestiaryEnabled ? "ok" : "off"}`}>
                  {info?.settings?.bestiaryEnabled ? "ON" : "OFF"}
                </span>
              </div>
              <div className="item dm-dashboard-brief-item">
                <div className="kv">
                  <div className="dm-dashboard-player-name">QR доступ</div>
                  <div className="small">Покажи код на общем экране или отправь URL вручную.</div>
                </div>
                <QrCode className="dm-dashboard-icon" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
