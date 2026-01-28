import React, { useEffect, useMemo, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import OfflineBanner from "../components/OfflineBanner.jsx";
import { connectSocket } from "../socket.js";
import VintageShell from "../components/vintage/VintageShell.jsx";

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

  const linkStyle = ({ isActive }) => ({
    color: isActive ? "#fff" : "#cfe4ff",
    borderColor: isActive ? "#1f6feb" : "#1f2a3a"
  });

  return (
    <div>
      <OfflineBanner online={online && navigator.onLine} />
      <div className="navbar">
        <NavLink className="tab" to="/dm/app/dashboard" style={linkStyle}>Dashboard</NavLink>
        <NavLink className="tab" to="/dm/app/lobby" style={linkStyle}>Lobby</NavLink>
        <NavLink className="tab" to="/dm/app/players" style={linkStyle}>Players</NavLink>
        <NavLink className="tab" to="/dm/app/inventory" style={linkStyle}>Inventory</NavLink>
        <NavLink className="tab" to="/dm/app/bestiary" style={linkStyle}>Bestiary</NavLink>
        <NavLink className="tab" to="/dm/app/events" style={linkStyle}>Events</NavLink>
        <NavLink className="tab" to="/dm/app/info" style={linkStyle}>Info Blocks</NavLink>
        <NavLink className="tab" to="/dm/app/settings" style={linkStyle}>Settings</NavLink>
      </div>
      <VintageShell>
        <div className="container">
          <Outlet context={{ socket }} />
        </div>
      </VintageShell>
    </div>
  );
}
