import React, { useEffect, useMemo, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav.jsx";
import OfflineBanner from "../components/OfflineBanner.jsx";
import { api, storage } from "../api.js";
import { connectSocket } from "../socket.js";
import VintageShell from "../components/vintage/VintageShell.jsx";

export default function PlayerLayout() {
  const nav = useNavigate();

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
  const [bestiaryEnabled, setBestiaryEnabled] = useState(false);
  const [impersonating, setImpersonating] = useState(storage.isImpersonating());
  const [impMode, setImpMode] = useState(storage.getImpMode());
  const [me, setMe] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const socket = useMemo(() => connectSocket({ role: "player" }), []);

  useEffect(() => {
    if (!storage.getPlayerToken()) nav("/", { replace: true });

    socket.on("connect", () => setOnline(true));
    socket.on("disconnect", () => setOnline(false));
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
      const inf = await api.serverInfo().catch(() => null);
      if (inf) setBestiaryEnabled(!!inf.settings?.bestiaryEnabled);
    });

    api.serverInfo().then((inf) => setBestiaryEnabled(!!inf.settings?.bestiaryEnabled)).catch(() => {});
    api.me().then(setMe).catch(() => {});

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
      socket.disconnect();
      window.removeEventListener("pointerdown", emitActivity);
      window.removeEventListener("keydown", emitActivity);
      window.removeEventListener("touchstart", emitActivity);
      window.removeEventListener("scroll", emitActivity);
      window.removeEventListener("focus", emitActivity);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

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
      setErr(e.body?.error || e.message);
    } finally {
      setBusy(false);
    }
  }

  const items = [
    { to: "/app/players", label: "Players" },
    { to: "/app/inventory", label: "Inventory" },
    { to: "/app/notes", label: "Notes" },
  ];
  if (bestiaryEnabled) items.push({ to: "/app/bestiary", label: "Bestiary" });

  return (
    <div>
      <OfflineBanner online={online && navigator.onLine} />
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
      <VintageShell>
        <div className="container padBottom">
          <Outlet context={{ socket }} />
        </div>
      </VintageShell>
      <BottomNav items={items} />
    </div>
  );
}
