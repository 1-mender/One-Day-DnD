import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import QRCodeCard from "../components/QRCodeCard.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { Copy, QrCode, RefreshCcw } from "lucide-react";

export default function DMOpsBar() {
  const { socket } = useSocket();
  const [info, setInfo] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [players, setPlayers] = useState([]);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState({ url: false, code: false });
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try {
      const [i, p] = await Promise.all([api.serverInfo(), api.dmPlayers()]);
      setInfo(i);
      setPlayers(p.items || []);
      if (i?.party?.joinCodeEnabled) {
        const r = await api.dmGetJoinCode();
        setJoinCode(String(r?.joinCode || ""));
      } else {
        setJoinCode("");
      }
    } catch (e) {
      setErr(String(e?.message || e));
    }
  }, []);

  useEffect(() => {
    if (!socket) return () => {};
    load().catch(() => {});
    const onPlayers = () => load().catch(() => {});
    const onStatus = () => load().catch(() => {});
    const onSettings = () => load().catch(() => {});
    socket.on("players:updated", onPlayers);
    socket.on("player:statusChanged", onStatus);
    socket.on("settings:updated", onSettings);
    return () => {
      socket.off("players:updated", onPlayers);
      socket.off("player:statusChanged", onStatus);
      socket.off("settings:updated", onSettings);
    };
  }, [load, socket]);

  const counts = useMemo(() => {
    return (players || []).reduce((acc, p) => {
      const s = String(p.status || "offline");
      if (s === "online") acc.online += 1;
      else if (s === "idle") acc.idle += 1;
      else acc.offline += 1;
      return acc;
    }, { online: 0, idle: 0, offline: 0 });
  }, [players]);

  const url = info?.urls?.[0] || (info?.ips?.[0] ? `http://${info.ips[0]}:${info?.port || 3000}` : "http://<LAN-IP>:3000");
  const joinCodeEnabled = !!info?.party?.joinCodeEnabled;

  const copyText = async (text, key) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => setCopied((prev) => ({ ...prev, [key]: false })), 1500);
    } catch {
      window.prompt("Copy:", text);
    }
  };

  return (
    <div className="dm-ops">
      <div className="dm-ops-row">
        <div className="dm-ops-title">
          {info?.party?.name ? `Party: ${info.party.name}` : "Party control"}
        </div>
        <div className="dm-ops-status">
          <span className="badge ok">Online: {counts.online}</span>
          <span className="badge warn">Idle: {counts.idle}</span>
          <span className="badge off">Offline: {counts.offline}</span>
        </div>
        <div className="dm-ops-actions">
          <button className="btn secondary" onClick={load} title="Refresh">
            <RefreshCcw className="icon" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      <div className="dm-ops-row">
        <div className="dm-ops-field">
          <div className="dm-ops-label">Join URL</div>
          <div className="dm-ops-value">{url}</div>
          <div className="dm-ops-actions">
            <button className="btn secondary" onClick={() => copyText(url, "url")}>
              <Copy className="icon" aria-hidden="true" />
              {copied.url ? "Copied" : "Copy URL"}
            </button>
            <button className="btn secondary" onClick={() => setShowQr((v) => !v)}>
              <QrCode className="icon" aria-hidden="true" />
              {showQr ? "Hide QR" : "QR"}
            </button>
          </div>
        </div>

        <div className="dm-ops-field">
          <div className="dm-ops-label">Join code</div>
          <div className="dm-ops-value">
            {joinCodeEnabled ? (joinCode || "—") : "Disabled"}
          </div>
          <div className="dm-ops-actions">
            <button className="btn secondary" onClick={() => copyText(joinCode, "code")} disabled={!joinCodeEnabled || !joinCode}>
              <Copy className="icon" aria-hidden="true" />
              {copied.code ? "Copied" : "Copy code"}
            </button>
          </div>
        </div>
      </div>

      {err ? (
        <div className="badge off" style={{ marginTop: 8 }}>
          Ops error: {err}
        </div>
      ) : null}

      {showQr ? (
        <div className="dm-ops-qr">
          <QRCodeCard url={url} className="compact" />
        </div>
      ) : null}
    </div>
  );
}
