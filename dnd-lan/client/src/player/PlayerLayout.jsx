import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav.jsx";
import OfflineBanner from "../components/OfflineBanner.jsx";
import { api, storage } from "../api.js";
import VintageShell from "../components/vintage/VintageShell.jsx";
import { formatError } from "../lib/formatError.js";
import { ERROR_CODES } from "../lib/errorCodes.js";
import { takeImpersonationHandoff } from "../lib/impersonationHandoff.js";
import { useSocket } from "../context/SocketContext.jsx";
import { BookOpen, Gamepad2, Map, Package, Send, StickyNote, Store, User, Users } from "lucide-react";
import { t } from "../i18n/index.js";

const CORE_NAV_ROUTES = ["/app/players", "/app/profile", "/app/inventory"];
const OPTIONAL_NAV_BASE_ORDER = ["/app/map", "/app/arcade", "/app/shop", "/app/bestiary", "/app/notes", "/app/transfers"];
const PRIMARY_NAV_ROUTES = new Set([
  "/app/players",
  "/app/profile",
  "/app/inventory",
  "/app/map",
  "/app/arcade",
  "/app/shop",
  "/app/bestiary",
  "/app/notes",
  "/app/transfers"
]);
const ROUTE_TO_ICON = {
  "/app/players": Users,
  "/app/profile": User,
  "/app/inventory": Package,
  "/app/map": Map,
  "/app/arcade": Gamepad2,
  "/app/transfers": Send,
  "/app/notes": StickyNote,
  "/app/shop": Store,
  "/app/bestiary": BookOpen
};
const ROUTE_TO_LABEL = {
  "/app/players": "playerLayout.navPlayers",
  "/app/profile": "playerLayout.navProfile",
  "/app/inventory": "playerLayout.navInventory",
  "/app/map": "playerLayout.navMap",
  "/app/arcade": "playerLayout.navArcade",
  "/app/transfers": "playerLayout.navTransfers",
  "/app/notes": "playerLayout.navNotes",
  "/app/shop": "playerLayout.navShop",
  "/app/bestiary": "playerLayout.navBestiary"
};

function getLiveActivityRoute(activity) {
  const kind = String(activity?.kind || "");
  if (kind === "shield") return "/app/shield";
  return "";
}

function getLiveActivityTitle(activity) {
  const kind = String(activity?.kind || "");
  if (kind === "shield") return "Щиток доступен";
  return "Активность доступна";
}

function getLiveActivityCopy(activity) {
  const kind = String(activity?.kind || "");
  if (kind === "shield") return "Мастер открыл для тебя временный доступ к Щитку. Доступ пропадёт, когда он его закроет.";
  return "Мастер открыл для тебя временную активность.";
}
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
  const [activeLiveActivity, setActiveLiveActivity] = useState(null);
  const [liveActivityLoaded, setLiveActivityLoaded] = useState(false);
  const [liveInviteVisible, setLiveInviteVisible] = useState(false);

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
  const activeActivityRoute = getLiveActivityRoute(activeLiveActivity);

  const syncLiveActivity = useCallback(async () => {
    try {
      const response = await api.playerLiveActivityMe();
      const activity = response?.activity || null;
      setActiveLiveActivity(activity);
      setLiveInviteVisible(!!activity);
    } catch {
      setActiveLiveActivity(null);
    } finally {
      setLiveActivityLoaded(true);
    }
  }, []);

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
    const handoffId = String(sp.get("handoff") || "").trim();
    const token = handoffId
      ? takeImpersonationHandoff(handoffId)
      : String(sp.get("token") || "");
    if (imp && (handoffId || token)) {
      window.history.replaceState({}, "", window.location.pathname);
    }
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
      syncLiveActivity().catch(() => {});
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
    const onMinigameOpened = (payload) => {
      const activity = payload?.activity || null;
      setActiveLiveActivity(activity);
      setLiveInviteVisible(!!activity);
    };
    const onMinigameClosed = () => {
      setActiveLiveActivity(null);
      setLiveInviteVisible(false);
      if (location.pathname === "/app/shield") {
        nav("/app/players", { replace: true });
      }
    };
    const syncLiveActivitySoft = () => {
      syncLiveActivity().catch(() => {});
    };
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("player:kicked", onKicked);
    socket.on("player:sessionInvalid", onSessionInvalid);
    socket.on("settings:updated", onSettingsUpdated);
    socket.on("transfers:updated", loadTransferBadge);
    socket.on("player:minigame:opened", onMinigameOpened);
    socket.on("player:minigame:closed", onMinigameClosed);

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
    syncLiveActivity().catch(() => {});
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
      if (document.visibilityState === "visible") {
        emitActivity();
        syncLiveActivitySoft();
      }
    };
    const onFocus = () => {
      emitActivity();
      syncLiveActivitySoft();
    };

    window.addEventListener("pointerdown", emitActivity, { passive: true });
    window.addEventListener("keydown", emitActivity);
    window.addEventListener("focus", onFocus);
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
      socket.off("player:minigame:opened", onMinigameOpened);
      socket.off("player:minigame:closed", onMinigameClosed);
      window.removeEventListener("pointerdown", emitActivity);
      window.removeEventListener("keydown", emitActivity);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadTransferBadge, location.pathname, nav, socket, syncLiveActivity]);

  useEffect(() => {
    if (!liveActivityLoaded) return;
    if (activeActivityRoute && location.pathname === activeActivityRoute) return;
    if (location.pathname !== "/app/shield") return;
    nav("/app/players", { replace: true });
  }, [activeActivityRoute, liveActivityLoaded, location.pathname, nav]);

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
      primary: PRIMARY_NAV_ROUTES.has(to)
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
          {activeActivityRoute && liveInviteVisible && location.pathname !== activeActivityRoute ? (
            <div className="paper-note player-live-activity-banner">
              <div className="title">{getLiveActivityTitle(activeLiveActivity)}</div>
              <div className="small">{getLiveActivityCopy(activeLiveActivity)}</div>
              <div className="row player-live-activity-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setLiveInviteVisible(false);
                    nav(activeActivityRoute);
                  }}
                >
                  Открыть
                </button>
                <button type="button" className="btn secondary" onClick={() => setLiveInviteVisible(false)}>
                  Скрыть
                </button>
              </div>
            </div>
          ) : null}
          <Outlet context={{ socket }} />
        </div>
      </VintageShell>
      <BottomNav items={navItems} />
    </div>
  );
}
