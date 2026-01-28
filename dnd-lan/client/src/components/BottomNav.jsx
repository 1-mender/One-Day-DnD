import React from "react";
import { NavLink } from "react-router-dom";

export default function BottomNav({ items = [] }) {
  if (!items?.length) return null;
  return (
    <div className="bottom-nav">
      <div className="bottom-nav-inner">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) => "bottom-nav-link" + (isActive ? " active" : "")}
          >
            {it.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
