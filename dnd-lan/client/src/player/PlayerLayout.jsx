import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav.jsx";
import OfflineBanner from "../components/OfflineBanner.jsx";
import { api, storage } from "../api.js";
import VintageShell from "../components/vintage/VintageShell.jsx";
import { formatError } from "../lib/formatError.js";
import { ERROR_CODES } from "../lib/errorCodes.js";
import { useSocket } from "../context/SocketContext.jsx";
import { Backpack, BookOpen, Gamepad2, Send, ShoppingBag, StickyNote, Users, UserRound } from "lucide-react";
import { t } from "../i18n/index.js";

const CORE_NAV_ROUTES = ["/app/players", "/app/profile", "/app/inventory"];
const OPTIONAL_NAV_BASE_ORDER = ["/app/shop", "/app/bestiary", "/app/notes", "/app/transfers", "/app/arcade"];
const ROUTE_TO_ICON = {
  "/app/players": Users,
  "/app/profile": UserRound,
  "/app/inventory": Backpack,
  "/app/arcade": Gamepad2,
  "/app/transfers": Send,
  "/app/notes": StickyNote,
  "/app/shop": ShoppingBag,
  "/app/bestiary": BookOpen
};
const ROUTE_TO_LABEL = {
  "/app/players": "playerLayout.navPlayers",
  "/app/profile": "playerLayout.navProfile",
  "/app/inventory": "playerLayout.navInventory",
  "/app/arcade": "playerLayout.navArcade",
  "/app/transfers": "playerLayout.navTransfers",
  "/app/notes": "playerLayout.navNotes",
  "/app/shop": "playerLayout.navShop",
  "/app/bestiary": "playerLayout.navBestiary"
};

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
  const [transferBadge, setTransferBadge] = useState(0);

  const { socket, refreshAuth, netState } = useSocket();
  const OFFLINE_BANNER_DELAY_MS = 2000;
  const socketErr = netState?.lastError;
  const degradedReason = netState?.degradedReason;
  const offlineDetails =
    socketErr && socketErr !== "connect_error"
      ? t("playerLayout.offlineDetails")
      : "";
  const degradedDetails = netState?.degraded
    ? formatError(degradedReason || ERROR_CODES.READ_ONLY)
    : "";

  const loadTransferBadge = useCallback(async () => {
    try {
      const [inbox, outbox] = await Promise.all([
        api.invTransferInbox(),
        api.invTransferOutbox()
      ]);
      const inboxCount = Array.isArray(inbox?.items) ? inbox.items.length : 0;
      const outboxCount = Array.isArray(outbox?.items) ? outbox.items.length : 0;
      setTransferBadge(inboxCount + outboxCount);
    } catch {
      setTransferBadge(0);
    }
  }, []);

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const imp = sp.get("imp") === "1";
    const token = sp.get("token");
    if (!imp || !token) return;
    if (impHandledRef.current.token !== token) {
      impHandledRef.current = { token, applied: false };
    }
    if (!impHandledRef.current.applied) {
      impHandledRef.current.applied = true;
      storage.setPlayerToken(token);
      api.playerSessionStart(token)
        .then(() => {
          storage.setImpersonating(true);
          storage.setImpMode("ro");
          setImpersonating(true);
          setImpMode("ro");
          window.history.replaceState({}, "", window.location.pathname);
          if (socket) refreshAuth();
        })
        .catch((e) => {
          setErr(formatError(e));
        });
    }
  }, [location.search, refreshAuth, socket]);

  useEffect(() => {
    if (!socket) return () => {};

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
    socket.on("transfers:updated", loadTransferBadge);

    api.serverInfo()
      .then((inf) => setBestiaryEnabled(!!inf.settings?.bestiaryEnabled))
      .catch((e) => setNetErr(formatError(e, ERROR_CODES.SERVER_INFO_FAILED)));
    api.me()
      .then(setMe)
      .catch((e) => {
        if (String(e?.message || "") === "not_authenticated") {
          storage.clearPlayerToken();
          storage.clearImpersonating();
          storage.clearImpMode();
          nav("/", { replace: true });
          return;
        }
        setNetErr(formatError(e, ERROR_CODES.ME_FAILED));
      });
    loadTransferBadge().catch(() => {});

    const shouldSend = () => !storage.isImpersonating();
    let last = 0;
    const THROTTLE_MS = 10_000;

    const emitActivity = () => {
      if (!shouldSend()) return;
      const tick = Date.now();
      if (tick - last < THROTTLE_MS) return;
      last = tick;
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
      socket.off("transfers:updated", loadTransferBadge);
      window.removeEventListener("pointerdown", emitActivity);
      window.removeEventListener("keydown", emitActivity);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadTransferBadge, nav, socket]);

  async function setWriteMode(nextMode) {
    if (!impersonating || !me?.player?.id) return;
    setErr("");
    setBusy(true);
    try {
      const r = await api.dmImpersonate(me.player.id, nextMode);
      await api.playerSessionStart(r.playerToken);
      storage.setImpMode(nextMode);
      setImpMode(nextMode);
      refreshAuth();
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setBusy(false);
    }
  }

  const navItems = useMemo(() => {
    const optionalOrder = bestiaryEnabled
      ? OPTIONAL_NAV_BASE_ORDER
      : OPTIONAL_NAV_BASE_ORDER.filter((route) => route !== "/app/bestiary");
    const selectedRoutes = [...CORE_NAV_ROUTES, ...optionalOrder];
    return selectedRoutes.map((to) => ({
      to,
      label: t(ROUTE_TO_LABEL[to]),
      icon: ROUTE_TO_ICON[to],
      badge: to === "/app/transfers" ? transferBadge : 0,
      primary: true
    }));
  }, [bestiaryEnabled, transferBadge]);

  return (
    <div>
      <OfflineBanner online={!showOffline} details={offlineDetails} />
      {netState?.degraded ? <OfflineBanner online={false} details={degradedDetails} tone="readonly" /> : null}
      {impersonating && (
        <div className="impersonation-banner">
          <div className="row u-row-between-center">
            <div>
              <b>{t("playerLayout.impersonationTitle")}</b> {me?.player?.displayName ? `как ${me.player.displayName}` : t("playerLayout.impersonationAsPlayer")}
              <div className="small">
                {t("playerLayout.impersonationMode")} <b>{impMode === "ro" ? t("playerLayout.impersonationModeRead") : t("playerLayout.impersonationModeWrite")}</b>
                {err ? ` - ${t("playerLayout.impersonationError", { message: err })}` : ""}
              </div>
            </div>
            <div className="row u-row-gap-8">
              {impMode === "ro" ? (
                <button className="btn" disabled={busy} onClick={() => setWriteMode("rw")}>{t("playerLayout.allowChanges")}</button>
              ) : (
                <button className="btn secondary" disabled={busy} onClick={() => setWriteMode("ro")}>{t("playerLayout.switchToReadMode")}</button>
              )}
              <button
                className="btn secondary"
                onClick={async () => {
                  try {
                    await api.playerLogout();
                  } finally {
                    window.location.href = "/dm/app/players";
                  }
                }}
              >
                {t("playerLayout.exitImpersonation")}
              </button>
            </div>
          </div>
        </div>
      )}
      <VintageShell layout="spread" pageKey={location.pathname}>
        <div className="container padBottom">
          {netErr && <div className="badge off">{t("playerLayout.networkError", { message: netErr })}</div>}
          <Outlet context={{ socket }} />
        </div>
      </VintageShell>
      <BottomNav items={navItems} />
    </div>
  );
}
