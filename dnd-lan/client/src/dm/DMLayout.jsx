import React, { useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import OfflineBanner from "../components/OfflineBanner.jsx";
import { connectSocket } from "../socket.js";
import VintageShell from "../components/vintage/VintageShell.jsx";
import DMTabBar from "./DMTabBar.jsx";

export default function DMLayout() {
  const nav = useNavigate();
  const location = useLocation();
  const [online, setOnline] = useState(true);
  const [showOffline, setShowOffline] = useState(false);
  const offlineTimerRef = useRef(null);
  const hasConnectedRef = useRef(false);
  const closingRef = useRef(false);
  const socket = useMemo(() => connectSocket({ role: "dm" }), []);
  const OFFLINE_BANNER_DELAY_MS = 2500;

  useEffect(() => {
    api.dmMe().then((r) => {
      if (r.needsSetup) nav("/dm/setup", { replace: true });
      if (!r.authenticated) nav("/dm", { replace: true });
    }).catch(() => nav("/dm", { replace: true }));

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
    return () => {
      closingRef.current = true;
      clearOfflineTimer();
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.disconnect();
    };
  }, [nav, socket]);

  return (
    <div className="dm-root">
      <OfflineBanner online={!showOffline} />
      <VintageShell layout="spread" pageKey={location.pathname}>
        <DMTabBar />
        <div className="container">
          <Outlet context={{ socket }} />
        </div>
      </VintageShell>
    </div>
  );
}
