import React, { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav.jsx";
import OfflineBanner from "../components/OfflineBanner.jsx";
import { api, storage } from "../api.js";
import VintageShell from "../components/vintage/VintageShell.jsx";
import { formatError } from "../lib/formatError.js";
import { ERROR_CODES } from "../lib/errorCodes.js";
import { useSocket } from "../context/SocketContext.jsx";

export default function PlayerLayout() {
  const nav = useNavigate();
  const location = useLocation();
  const impHandledRef = useRef({ token: null, applied: false });

  const [showOffline, setShowOffline] = useState(false);
  const offlineTimerRef = useRef(null);
  const hasConnectedRef = useRef(false);
  const closingRef = useRef(false);
  const [bestiaryEnabled, setBestiaryEnabled] = useState(false);
  const [impersonating, setImpersonating] = useState(storage.isImpersonating());
  const [impMode, setImpMode] = useState(storage.getImpMode());
  const [me, setMe] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [netErr, setNetErr] = useState("");

  const { socket, refreshAuth, netState } = useSocket();
  const OFFLINE_BANNER_DELAY_MS = 2000;
  const socketErr = netState?.lastError;
  const offlineDetails =
    socketErr && socketErr !== "connect_error"
      ? `Socket error: ${socketErr}`
      : "";

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const imp = sp.get("imp") === "1";
    const token = sp.get("token");
    if (!imp || !token) return;
    if (impHandledRef.current.token !== token) {
      impHandledRef.current = { token, applied: false };
    }
    if (!impHandledRef.current.applied) {
      storage.setPlayerToken(token, "session");
      storage.setImpersonating(true);
      storage.setImpMode("ro");
      setImpersonating(true);
      setImpMode("ro");
      window.history.replaceState({}, "", window.location.pathname);
      impHandledRef.current.applied = true;
    }
    if (socket) refreshAuth();
  }, [location.search, refreshAuth, socket]);

  useEffect(() => {
    if (!socket) return () => {};
    if (!storage.getPlayerToken()) nav("/", { replace: true });

    closingRef.current = false;
    hasConnectedRef.current = false;
    const clearOfflineTimer = () => {
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current);
        offlineTimerRef.current = null;
      }
    };
    const showOfflineNow = () => {
      clearOfflineTimer();
      setShowOffline(true);
    };
    const scheduleOffline = () => {
      clearOfflineTimer();
      offlineTimerRef.current = setTimeout(() => {
        if (socket.connected) return;
        setShowOffline(true);
      }, OFFLINE_BANNER_DELAY_MS);
    };

    const onConnect = () => {
      hasConnectedRef.current = true;
      clearOfflineTimer();
      setShowOffline(false);
    };
    const onDisconnect = () => {
      if (closingRef.current) return;
      scheduleOffline();
    };
    const onConnectError = () => {
      if (closingRef.current) return;
      if (!hasConnectedRef.current) {
        showOfflineNow();
        return;
      }
      scheduleOffline();
    };
    const onKicked = () => {
      storage.clearPlayerToken();
      storage.clearImpersonating();
      storage.clearImpMode();
      nav("/", { replace: true });
    };
    const onSessionInvalid = () => {
      storage.clearPlayerToken();
      storage.clearImpersonating();
      storage.clearImpMode();
      nav("/", { replace: true });
    };
    const onSettingsUpdated = async () => {
      const inf = await api.serverInfo().catch((e) => {
        setNetErr(formatError(e, ERROR_CODES.SERVER_INFO_FAILED));
        return null;
      });
      if (inf) setBestiaryEnabled(!!inf.settings?.bestiaryEnabled);
    };
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("player:kicked", onKicked);
    socket.on("player:sessionInvalid", onSessionInvalid);
    socket.on("settings:updated", onSettingsUpdated);

    api.serverInfo()
      .then((inf) => setBestiaryEnabled(!!inf.settings?.bestiaryEnabled))
      .catch((e) => setNetErr(formatError(e, ERROR_CODES.SERVER_INFO_FAILED)));
    api.me()
      .then(setMe)
      .catch((e) => setNetErr(formatError(e, ERROR_CODES.ME_FAILED)));

    const shouldSend = () => !storage.isImpersonating();
    let last = 0;
    const THROTTLE_MS = 10_000;

    const emitActivity = () => {
      if (!shouldSend()) return;
      const t = Date.now();
      if (t - last < THROTTLE_MS) return;
      last = t;
      socket.emit("player:activity");
    };

    emitActivity();
    if (socket.connected) {
      onConnect();
    } else {
      scheduleOffline();
    }

    const onVis = () => {
      if (document.visibilityState === "visible") emitActivity();
    };

    window.addEventListener("pointerdown", emitActivity, { passive: true });
    window.addEventListener("keydown", emitActivity);
    window.addEventListener("touchstart", emitActivity, { passive: true });
    window.addEventListener("scroll", emitActivity, { passive: true });
    window.addEventListener("focus", emitActivity);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      closingRef.current = true;
      clearOfflineTimer();
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("player:kicked", onKicked);
      socket.off("player:sessionInvalid", onSessionInvalid);
      socket.off("settings:updated", onSettingsUpdated);
      window.removeEventListener("pointerdown", emitActivity);
      window.removeEventListener("keydown", emitActivity);
      window.removeEventListener("touchstart", emitActivity);
      window.removeEventListener("scroll", emitActivity);
      window.removeEventListener("focus", emitActivity);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [nav, socket]);

  async function setWriteMode(nextMode) {
    if (!impersonating || !me?.player?.id) return;
    setErr("");
    setBusy(true);
    try {
      const r = await api.dmImpersonate(me.player.id, nextMode);
      storage.setPlayerToken(r.playerToken, "session");
      storage.setImpMode(nextMode);
      setImpMode(nextMode);
      refreshAuth();
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setBusy(false);
    }
  }

  const items = [
    { to: "/app/players", label: "Players" },
    { to: "/app/profile", label: "Profile" },
    { to: "/app/inventory", label: "Inventory" },
    { to: "/app/notes", label: "Notes" },
    { to: "/app/arcade", label: "Fish" },
    { to: "/app/shop", label: "DJO" },
  ];
  if (bestiaryEnabled) items.push({ to: "/app/bestiary", label: "Bestiary" });

  return (
    <div>
      <OfflineBanner online={!showOffline} details={offlineDetails} />
      {impersonating && (
        <div style={{ padding: 10, background: "#2a220f", borderBottom: "1px solid #6a5622" }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <b>Имперсонализация DM:</b> {me?.player?.displayName ? `как ${me.player.displayName}` : "как игрок"}
              <div className="small">
                Режим: <b>{impMode === "ro" ? "READ-ONLY" : "EDIT"}</b> {err ? `• ошибка: ${err}` : ""}
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              {impMode === "ro" ? (
                <button className="btn" disabled={busy} onClick={() => setWriteMode("rw")}>Разрешить изменения</button>
              ) : (
                <button className="btn secondary" disabled={busy} onClick={() => setWriteMode("ro")}>Сделать read-only</button>
              )}
              <button
                className="btn secondary"
                onClick={() => {
                  storage.clearPlayerToken();
                  storage.clearImpersonating();
                  storage.clearImpMode();
                  window.location.href = "/dm/app/players";
                }}
              >
                Выйти
              </button>
            </div>
          </div>
        </div>
      )}
      <VintageShell layout="spread" pageKey={location.pathname}>
        <div className="container padBottom">
          {netErr && <div className="badge off">Ошибка сети: {netErr}</div>}
          <Outlet context={{ socket }} />
        </div>
      </VintageShell>
      <BottomNav items={items} />
    </div>
  );
}
