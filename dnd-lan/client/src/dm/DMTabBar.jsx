import React, { useEffect, useId, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import { t } from "../i18n/index.js";

const primaryItems = [
  { to: "/dm/app/dashboard", label: t("dmTabBar.dashboard") },
  { to: "/dm/app/lobby", label: t("dmTabBar.lobby") },
  { to: "/dm/app/players", label: t("dmTabBar.players") },
  { to: "/dm/app/events", label: t("dmTabBar.events") },
  { to: "/dm/app/settings", label: t("dmTabBar.settings") }
];

const secondaryItems = [
  { to: "/dm/app/inventory", label: t("dmTabBar.inventory") },
  { to: "/dm/app/bestiary", label: t("dmTabBar.bestiary") },
  { to: "/dm/app/info", label: t("dmTabBar.infoBlocks") }
];

export default function DMTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef(null);
  const toggleRef = useRef(null);
  const itemRefs = useRef([]);
  const menuId = useId();

  const isPathActive = (to) => location.pathname === to || location.pathname.startsWith(`${to}/`);
  const secondaryActive = secondaryItems.some((it) => isPathActive(it.to));

  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, secondaryItems.length);
  }, [secondaryItems.length]);

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
    setActiveIndex(secondaryItems.length ? 0 : -1);
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const node = itemRefs.current[activeIndex];
    if (!node) return;
    window.requestAnimationFrame(() => node.focus());
  }, [activeIndex, open]);

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
            ref={toggleRef}
            aria-haspopup="menu"
            aria-expanded={open ? "true" : "false"}
            aria-controls={open ? menuId : undefined}
            onClick={() => setOpen((v) => !v)}
            onKeyDown={(event) => {
              if (!secondaryItems.length) return;
              if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setOpen(true);
                setActiveIndex(0);
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setOpen(true);
                setActiveIndex(secondaryItems.length - 1);
              }
              if (event.key === "Tab" && open) {
                setOpen(false);
              }
            }}
          >
            <MoreHorizontal className="icon" aria-hidden="true" />
            {t("common.more")}
          </button>
          {open ? (
            <div
              id={menuId}
              className="dm-topbar-popover"
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
                if (!secondaryItems.length) return;
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex((idx) => (idx + 1) % secondaryItems.length);
                  return;
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex((idx) => (idx - 1 + secondaryItems.length) % secondaryItems.length);
                  return;
                }
                if (event.key === "Home") {
                  event.preventDefault();
                  setActiveIndex(0);
                  return;
                }
                if (event.key === "End") {
                  event.preventDefault();
                  setActiveIndex(secondaryItems.length - 1);
                }
              }}
            >
              {secondaryItems.map((it, idx) => (
                <button
                  key={it.to}
                  type="button"
                  role="menuitem"
                  className={`dm-topbar-popover-item${isPathActive(it.to) ? " active" : ""}`.trim()}
                  ref={(node) => {
                    itemRefs.current[idx] = node;
                  }}
                  tabIndex={idx === activeIndex ? 0 : -1}
                  onClick={() => {
                    setOpen(false);
                    navigate(it.to);
                  }}
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
