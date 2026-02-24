import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import { t } from "../i18n/index.js";
import { partitionNavItems } from "./bottomNavDomain.js";

export default function BottomNav({ items = [] }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef(null);
  const toggleRef = useRef(null);
  const itemRefs = useRef([]);
  const menuId = useId();

  const { normalized, primary, secondary } = useMemo(() => partitionNavItems(items), [items]);
  const secondaryBadgeTotal = useMemo(
    () => secondary.reduce((sum, item) => sum + Math.max(0, Number(item.badge) || 0), 0),
    [secondary]
  );

  const isPathActive = (to) => location.pathname === to || location.pathname.startsWith(`${to}/`);
  const secondaryActive = secondary.some((it) => isPathActive(it.to));

  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, secondary.length);
  }, [secondary.length]);

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
    if (!open) {
      setActiveIndex(-1);
      return;
    }
    setActiveIndex(secondary.length ? 0 : -1);
  }, [open, secondary.length]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const node = itemRefs.current[activeIndex];
    if (!node) return;
    window.requestAnimationFrame(() => node.focus());
  }, [activeIndex, open]);

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
            {Number(it.badge) > 0 ? (
              <span className="bottom-nav-badge" aria-label={`Новых: ${it.badge}`}>
                {Number(it.badge) > 99 ? "99+" : Number(it.badge)}
              </span>
            ) : null}
          </NavLink>
        ))}
        {secondary.length ? (
          <div className="bottom-nav-more">
            <button
              type="button"
              className={`bottom-nav-link bottom-nav-link-btn${secondaryActive ? " active" : ""}`.trim()}
              ref={toggleRef}
              aria-haspopup="menu"
              aria-expanded={open ? "true" : "false"}
              aria-controls={open ? menuId : undefined}
              aria-label={t("bottomNav.moreAria")}
              onClick={() => setOpen((v) => !v)}
              onKeyDown={(event) => {
                if (!secondary.length) return;
                if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setOpen(true);
                  setActiveIndex(0);
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setOpen(true);
                  setActiveIndex(secondary.length - 1);
                }
                if (event.key === "Tab" && open) {
                  setOpen(false);
                }
              }}
            >
              <MoreHorizontal className="icon nav-icon" aria-hidden="true" />
              <span>{t("common.more")}</span>
              {secondaryBadgeTotal > 0 ? (
                <span className="bottom-nav-badge bottom-nav-badge-floating" aria-label={`Новых: ${secondaryBadgeTotal}`}>
                  {secondaryBadgeTotal > 99 ? "99+" : secondaryBadgeTotal}
                </span>
              ) : null}
            </button>
            {open ? (
              <div
                id={menuId}
                className="bottom-nav-popover"
                role="menu"
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setOpen(false);
                    toggleRef.current?.focus();
                    return;
                  }
                  if (event.key === "Tab") {
                    setOpen(false);
                    return;
                  }
                  if (!secondary.length) return;
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveIndex((idx) => (idx + 1) % secondary.length);
                    return;
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveIndex((idx) => (idx - 1 + secondary.length) % secondary.length);
                    return;
                  }
                  if (event.key === "Home") {
                    event.preventDefault();
                    setActiveIndex(0);
                    return;
                  }
                  if (event.key === "End") {
                    event.preventDefault();
                    setActiveIndex(secondary.length - 1);
                  }
                }}
              >
                {secondary.map((it, idx) => (
                  <button
                    key={it.to}
                    type="button"
                    role="menuitem"
                    className={`bottom-nav-popover-item${isPathActive(it.to) ? " active" : ""}`.trim()}
                    ref={(node) => {
                      itemRefs.current[idx] = node;
                    }}
                    tabIndex={idx === activeIndex ? 0 : -1}
                    onClick={() => {
                      setOpen(false);
                      navigate(it.to);
                    }}
                  >
                    {it.icon ? <it.icon className="icon" aria-hidden="true" /> : null}
                    <span>{it.label}</span>
                    {Number(it.badge) > 0 ? (
                      <span className="bottom-nav-badge" aria-label={`Новых: ${it.badge}`}>
                        {Number(it.badge) > 99 ? "99+" : Number(it.badge)}
                      </span>
                    ) : null}
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
