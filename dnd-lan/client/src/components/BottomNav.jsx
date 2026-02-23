import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";

export default function BottomNav({ items = [] }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const normalized = useMemo(
    () => (items || []).filter((it) => it && typeof it.to === "string" && typeof it.label === "string"),
    [items]
  );

  const hasExplicitPrimary = normalized.some((it) => it.primary === true);
  const primary = hasExplicitPrimary
    ? normalized.filter((it) => it.primary === true).slice(0, 4)
    : normalized.slice(0, 4);
  const secondary = normalized.filter((it) => !primary.includes(it));

  const isPathActive = (to) => location.pathname === to || location.pathname.startsWith(`${to}/`);
  const secondaryActive = secondary.some((it) => isPathActive(it.to));

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

  if (!normalized.length) return null;

  return (
    <div className="bottom-nav">
      <div className="bottom-nav-inner" ref={rootRef}>
        {primary.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) => "bottom-nav-link" + (isActive ? " active" : "")}
          >
            {it.icon ? <it.icon className="icon nav-icon" aria-hidden="true" /> : null}
            <span>{it.label}</span>
          </NavLink>
        ))}
        {secondary.length ? (
          <div className="bottom-nav-more">
            <button
              type="button"
              className={`bottom-nav-link bottom-nav-link-btn${secondaryActive ? " active" : ""}`.trim()}
              aria-haspopup="menu"
              aria-expanded={open ? "true" : "false"}
              aria-label="Ещё разделы"
              onClick={() => setOpen((v) => !v)}
            >
              <MoreHorizontal className="icon nav-icon" aria-hidden="true" />
              <span>Ещё</span>
            </button>
            {open ? (
              <div className="bottom-nav-popover" role="menu">
                {secondary.map((it) => (
                  <button
                    key={it.to}
                    type="button"
                    role="menuitem"
                    className={`bottom-nav-popover-item${isPathActive(it.to) ? " active" : ""}`.trim()}
                    onClick={() => navigate(it.to)}
                  >
                    {it.icon ? <it.icon className="icon" aria-hidden="true" /> : null}
                    <span>{it.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
