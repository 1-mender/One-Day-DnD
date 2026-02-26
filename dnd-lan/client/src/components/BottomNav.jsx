import React, { useMemo } from "react";
import { NavLink } from "react-router-dom";
import { t } from "../i18n/index.js";
import { partitionNavItems } from "./bottomNavDomain.js";

export default function BottomNav({ items = [] }) {
  const { normalized, primary } = useMemo(() => partitionNavItems(items), [items]);

  if (!normalized.length) return null;

  return (
    <nav className="bottom-nav" role="navigation" aria-label={t("bottomNav.ariaLabel", null, "Нижняя навигация")}>
      <div className="bottom-nav-inner" style={{ "--bottom-nav-cols": String(Math.max(1, primary.length)) }}>
        {primary.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) => "bottom-nav-link" + (isActive ? " active" : "")}
          >
            {it.icon ? <it.icon className="icon nav-icon" aria-hidden="true" /> : null}
            <span>{it.label}</span>
            {Number(it.badge) > 0 ? (
              <span className="bottom-nav-badge" aria-label={t("bottomNav.badgeAria", { count: it.badge }, `Новых: ${it.badge}`)}>
                {Number(it.badge) > 99 ? "99+" : Number(it.badge)}
              </span>
            ) : null}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
