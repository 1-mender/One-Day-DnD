import React, { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import OfflineBanner from "../components/OfflineBanner.jsx";
import VintageShell from "../components/vintage/VintageShell.jsx";
import DMTabBar from "./DMTabBar.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import DMOpsBar from "./DMOpsBar.jsx";

export default function DMLayout() {
  const nav = useNavigate();
  const location = useLocation();
  const [showOffline, setShowOffline] = useState(false);
  const offlineTimerRef = useRef(null);
  const hasConnectedRef = useRef(false);
  const closingRef = useRef(false);
  const { socket, netState } = useSocket();
  const OFFLINE_BANNER_DELAY_MS = 2000;
  const socketErr = netState?.lastError;
  const degradedReason = netState?.degradedReason;
  const offlineDetails =
    socketErr === "dm_token_invalid"
      ? "DM session expired. Please sign in again."
      : socketErr && socketErr !== "connect_error"
        ? `Socket error: ${socketErr}`
        : "";
  const degradedDetails = netState?.degraded
    ? `Read-only mode: ${degradedReason || "not_ready"}`
    : "";

  useEffect(() => {
    if (!socket) return () => {};
    api.dmMe().then((r) => {
      if (r.needsSetup) nav("/dm/setup", { replace: true });
      if (!r.authenticated) nav("/dm", { replace: true });
    }).catch(() => nav("/dm", { replace: true }));

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
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    if (socket.connected) {
      onConnect();
    } else {
      scheduleOffline();
    }
    return () => {
      closingRef.current = true;
      clearOfflineTimer();
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
    };
  }, [nav, socket]);

  return (
    <div className="dm-root">
      <OfflineBanner online={!showOffline} details={offlineDetails} />
      {netState?.degraded ? <OfflineBanner online={false} details={degradedDetails} tone="readonly" /> : null}
      <VintageShell layout="spread" pageKey={location.pathname}>
        <DMOpsBar />
        <DMTabBar />
        <div className="container">
          <Outlet context={{ socket }} />
        </div>
      </VintageShell>
    </div>
  );
}
