import React from "react";
import { NavLink } from "react-router-dom";

const items = [
  { to: "/dm/app/dashboard", label: "Обзор" },
  { to: "/dm/app/lobby", label: "Лобби" },
  { to: "/dm/app/players", label: "Игроки" },
  { to: "/dm/app/inventory", label: "Инвентарь" },
  { to: "/dm/app/bestiary", label: "Бестиарий" },
  { to: "/dm/app/events", label: "События" },
  { to: "/dm/app/info", label: "Инфоблоки" },
  { to: "/dm/app/settings", label: "Настройки" }
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
