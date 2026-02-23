import React, { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";

const primaryItems = [
  { to: "/dm/app/dashboard", label: "Обзор" },
  { to: "/dm/app/lobby", label: "Лобби" },
  { to: "/dm/app/players", label: "Игроки" },
  { to: "/dm/app/events", label: "События" },
  { to: "/dm/app/settings", label: "Настройки" }
];

const secondaryItems = [
  { to: "/dm/app/inventory", label: "Инвентарь" },
  { to: "/dm/app/bestiary", label: "Бестиарий" },
  { to: "/dm/app/info", label: "Инфоблоки" }
];

export default function DMTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const isPathActive = (to) => location.pathname === to || location.pathname.startsWith(`${to}/`);
  const secondaryActive = secondaryItems.some((it) => isPathActive(it.to));

  useEffect(() => {
    if (!open) return () => {};
    const onDoc = (event) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="dm-topbar-wrap">
      <div className="dm-topbar" ref={rootRef}>
        {primaryItems.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) => "dm-tab" + (isActive ? " active" : "")}
          >
            {it.label}
          </NavLink>
        ))}
        <div className="dm-tab-more">
          <button
            type="button"
            className={`dm-tab dm-tab-more-btn${secondaryActive ? " active" : ""}`.trim()}
            aria-haspopup="menu"
            aria-expanded={open ? "true" : "false"}
            onClick={() => setOpen((v) => !v)}
          >
            <MoreHorizontal className="icon" aria-hidden="true" />
            Ещё
          </button>
          {open ? (
            <div className="dm-topbar-popover" role="menu">
              {secondaryItems.map((it) => (
                <button
                  key={it.to}
                  type="button"
                  role="menuitem"
                  className={`dm-topbar-popover-item${isPathActive(it.to) ? " active" : ""}`.trim()}
                  onClick={() => navigate(it.to)}
                >
                  {it.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
