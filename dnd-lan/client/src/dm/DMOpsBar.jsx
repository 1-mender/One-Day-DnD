import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import QRCodeCard from "../components/QRCodeCard.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { resolveJoinUrl } from "../lib/joinUrl.js";
import { Copy, QrCode, RefreshCcw } from "lucide-react";
import { formatError } from "../lib/formatError.js";
import { t } from "../i18n/index.js";

export default function DMOpsBar() {
  const { socket } = useSocket();
  const [info, setInfo] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [players, setPlayers] = useState([]);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState({ url: false, code: false });
  const [err, setErr] = useState("");
  const playersRefreshTimerRef = useRef(null);

  const loadInfo = useCallback(async () => {
    const i = await api.serverInfo();
    setInfo(i);
    if (i?.party?.joinCodeEnabled) {
      const r = await api.dmGetJoinCode();
      setJoinCode(String(r?.joinCode || ""));
      return;
    }
    setJoinCode("");
  }, []);

  const loadPlayers = useCallback(async () => {
    const p = await api.dmPlayers();
    setPlayers(p.items || []);
  }, []);

  const load = useCallback(async () => {
    setErr("");
    try {
      await Promise.all([loadInfo(), loadPlayers()]);
    } catch (e) {
      setErr(formatError(e));
    }
  }, [loadInfo, loadPlayers]);

  useEffect(() => {
    if (!socket) return () => {};
    load().catch(() => {});

    const schedulePlayersRefresh = () => {
      if (playersRefreshTimerRef.current != null) return;
      playersRefreshTimerRef.current = setTimeout(() => {
        playersRefreshTimerRef.current = null;
        loadPlayers().catch(() => {});
      }, 150);
    };

    const onPlayers = () => schedulePlayersRefresh();
    const onStatus = (payload) => {
      const playerId = Number(payload?.playerId);
      const status = String(payload?.status || "");
      if (!playerId || !status) return;
      setPlayers((prev) => prev.map((p) => (
        Number(p?.id) === playerId
          ? { ...p, status, lastSeen: Number(payload?.lastSeen || Date.now()) }
          : p
      )));
    };
    const onSettings = () => loadInfo().catch(() => {});

    socket.on("players:updated", onPlayers);
    socket.on("player:statusChanged", onStatus);
    socket.on("settings:updated", onSettings);

    return () => {
      if (playersRefreshTimerRef.current != null) {
        clearTimeout(playersRefreshTimerRef.current);
        playersRefreshTimerRef.current = null;
      }
      socket.off("players:updated", onPlayers);
      socket.off("player:statusChanged", onStatus);
      socket.off("settings:updated", onSettings);
    };
  }, [load, loadInfo, loadPlayers, socket]);

  const counts = useMemo(() => {
    return (players || []).reduce((acc, p) => {
      const s = String(p.status || "offline");
      if (s === "online") acc.online += 1;
      else if (s === "idle") acc.idle += 1;
      else acc.offline += 1;
      return acc;
    }, { online: 0, idle: 0, offline: 0 });
  }, [players]);

  const url = resolveJoinUrl(info);
  const joinCodeEnabled = !!info?.party?.joinCodeEnabled;
  const partyName = info?.party?.name;

  const copyText = async (text, key) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => setCopied((prev) => ({ ...prev, [key]: false })), 1500);
    } catch {
      setErr(t("dmOps.copyFailed", null, "Не удалось скопировать в буфер обмена."));
    }
  };

  return (
    <div className="dm-ops">
      <div className="dm-ops-row">
        <div className="dm-ops-title">
          {partyName ? t("dmOps.partyLabel", { name: partyName }, `Партия: ${partyName}`) : t("dmOps.title", null, "Управление партией")}
        </div>
        <div className="dm-ops-status">
          <span className="badge ok">{t("dmOps.online", null, "Онлайн")}: {counts.online}</span>
          <span className="badge warn">{t("dmOps.idle", null, "Нет активности")}: {counts.idle}</span>
          <span className="badge off">{t("dmOps.offline", null, "Оффлайн")}: {counts.offline}</span>
        </div>
        <div className="dm-ops-actions">
          <button className="btn secondary" onClick={load} title={t("dmOps.refresh", null, "Обновить")}>
            <RefreshCcw className="icon" aria-hidden="true" />
            {t("dmOps.refresh", null, "Обновить")}
          </button>
        </div>
      </div>

      <div className="dm-ops-row">
        <div className="dm-ops-field">
          <div className="dm-ops-label">{t("dmOps.joinUrl", null, "Адрес подключения")}</div>
          <div className="dm-ops-value">{url}</div>
          <div className="dm-ops-actions">
            <button className="btn secondary" onClick={() => copyText(url, "url")}>
              <Copy className="icon" aria-hidden="true" />
              {copied.url ? t("dmOps.copied", null, "Скопировано") : t("dmOps.copyUrl", null, "Копировать адрес")}
            </button>
            <button className="btn secondary" onClick={() => setShowQr((v) => !v)}>
              <QrCode className="icon" aria-hidden="true" />
              {showQr ? t("dmOps.hideQr", null, "Скрыть QR") : t("dmOps.showQr", null, "QR-код")}
            </button>
          </div>
        </div>

        <div className="dm-ops-field">
          <div className="dm-ops-label">{t("dmOps.joinCode", null, "Код партии")}</div>
          <div className="dm-ops-value">
            {joinCodeEnabled ? (joinCode || "-") : t("dmOps.disabled", null, "Отключён")}
          </div>
          <div className="dm-ops-actions">
            <button className="btn secondary" onClick={() => copyText(joinCode, "code")} disabled={!joinCodeEnabled || !joinCode}>
              <Copy className="icon" aria-hidden="true" />
              {copied.code ? t("dmOps.copied", null, "Скопировано") : t("dmOps.copyCode", null, "Копировать код")}
            </button>
          </div>
        </div>
      </div>

      {err ? (
        <div className="badge off u-mt-8">
          {t("common.error")}: {err}
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
