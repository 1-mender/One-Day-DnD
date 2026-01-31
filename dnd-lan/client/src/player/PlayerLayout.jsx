import React, { useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav.jsx";
import OfflineBanner from "../components/OfflineBanner.jsx";
import { api, storage } from "../api.js";
import { connectSocket } from "../socket.js";
import VintageShell from "../components/vintage/VintageShell.jsx";
import { formatError } from "../lib/formatError.js";
import { ERROR_CODES } from "../lib/errorCodes.js";

export default function PlayerLayout() {
  const nav = useNavigate();
  const location = useLocation();

  const sp = new URLSearchParams(window.location.search);
  const imp = sp.get("imp") === "1";
  const token = sp.get("token");
  if (imp && token) {
    storage.setPlayerToken(token, "session");
    storage.setImpersonating(true);
    storage.setImpMode("ro");
    window.history.replaceState({}, "", window.location.pathname);
  }

  const [online, setOnline] = useState(true);
  const [showOffline, setShowOffline] = useState(false);
  const offlineTimerRef = useRef(null);
  const hasConnectedRef = useRef(false);
  const closingRef = useRef(false);
  const [bestiaryEnabled, setBestiaryEnabled] = useState(false);
  const [impersonating] = useState(storage.isImpersonating());
  const [impMode, setImpMode] = useState(storage.getImpMode());
  const [me, setMe] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [netErr, setNetErr] = useState("");

  const socket = useMemo(() => connectSocket({ role: "player" }), []);
  const OFFLINE_BANNER_DELAY_MS = 2500;

  useEffect(() => {
    if (!storage.getPlayerToken()) nav("/", { replace: true });

    closingRef.current = false;
    const clearOfflineTimer = () => {
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current);
        offlineTimerRef.current = null;
      }
    };
    const scheduleOffline = () => {
      clearOfflineTimer();
      offlineTimerRef.current = setTimeout(() => {
        setShowOffline(true);
      }, OFFLINE_BANNER_DELAY_MS);
    };

    const onConnect = () => {
      hasConnectedRef.current = true;
      clearOfflineTimer();
      setOnline(true);
      setShowOffline(false);
    };
    const onDisconnect = () => {
      if (closingRef.current) return;
      setOnline(false);
      if (!hasConnectedRef.current) return;
      scheduleOffline();
    };
    const onConnectError = () => {
      if (closingRef.current) return;
      if (hasConnectedRef.current) {
        scheduleOffline();
      }
    };
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("player:kicked", () => {
      storage.clearPlayerToken();
      storage.clearImpersonating();
      storage.clearImpMode();
      nav("/", { replace: true });
    });
    socket.on("player:sessionInvalid", () => {
      storage.clearPlayerToken();
      storage.clearImpersonating();
      storage.clearImpMode();
      nav("/", { replace: true });
    });
    socket.on("settings:updated", async () => {
      const inf = await api.serverInfo().catch((e) => {
        setNetErr(formatError(e, ERROR_CODES.SERVER_INFO_FAILED));
        return null;
      });
      if (inf) setBestiaryEnabled(!!inf.settings?.bestiaryEnabled);
    });

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
      socket.disconnect();
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
  ];
  if (bestiaryEnabled) items.push({ to: "/app/bestiary", label: "Bestiary" });

  return (
    <div>
      <OfflineBanner online={!showOffline} />
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
