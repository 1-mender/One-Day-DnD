import React, { useEffect, useMemo, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import OfflineBanner from "../components/OfflineBanner.jsx";
import { connectSocket } from "../socket.js";
import VintageShell from "../components/vintage/VintageShell.jsx";
import DMTabBar from "./DMTabBar.jsx";

export default function DMLayout() {
  const nav = useNavigate();
  const [online, setOnline] = useState(true);
  const socket = useMemo(() => connectSocket({ role: "dm" }), []);

  useEffect(() => {
    api.dmMe().then((r) => {
      if (r.needsSetup) nav("/dm/setup", { replace: true });
      if (!r.authenticated) nav("/dm", { replace: true });
    }).catch(()=>nav("/dm", { replace: true }));

    socket.on("connect", () => setOnline(true));
    socket.on("disconnect", () => setOnline(false));
    return () => socket.disconnect();
  }, []);

  return (
    <div className="dm-root">
      <OfflineBanner online={online && navigator.onLine} />
      <VintageShell>
        <DMTabBar />
        <div className="container">
          <Outlet context={{ socket }} />
        </div>
      </VintageShell>
    </div>
  );
}
