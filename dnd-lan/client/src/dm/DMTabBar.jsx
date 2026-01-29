import React from "react";
import { NavLink } from "react-router-dom";

const items = [
  { to: "/dm/app/dashboard", label: "Dashboard" },
  { to: "/dm/app/lobby", label: "Lobby" },
  { to: "/dm/app/players", label: "Players" },
  { to: "/dm/app/inventory", label: "Inventory" },
  { to: "/dm/app/bestiary", label: "Bestiary" },
  { to: "/dm/app/events", label: "Events" },
  { to: "/dm/app/info", label: "Info Blocks" },
  { to: "/dm/app/settings", label: "Settings" }
];

export default function DMTabBar() {
  return (
    <div className="dm-topbar-wrap">
      <div className="dm-topbar">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) => "dm-tab" + (isActive ? " active" : "")}
          >
            {it.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
