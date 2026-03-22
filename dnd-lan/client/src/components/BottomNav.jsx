import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import { t } from "../i18n/index.js";
import { partitionNavItems } from "./bottomNavDomain.js";
import { getFocusable } from "./modalA11y.js";
import { getPopoverTabTarget } from "./navPopoverA11y.js";

export default function BottomNav({ items = [] }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [compactMobile, setCompactMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 720px)").matches;
  });
  const rootRef = useRef(null);
  const toggleRef = useRef(null);
  const menuRef = useRef(null);
  const itemRefs = useRef([]);
  const menuId = useId();

  const { normalized, primary, secondary } = useMemo(() => {
    const maxPrimary = compactMobile ? 4 : 7;
    const partitioned = partitionNavItems(items, maxPrimary);
    if (!compactMobile) return partitioned;

    const activeSecondary = partitioned.secondary.find(
      (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
    );
    if (!activeSecondary || partitioned.primary.some((item) => item.to === activeSecondary.to)) {
      return partitioned;
    }

    const nextPrimary = [...partitioned.primary];
    nextPrimary[Math.max(0, nextPrimary.length - 1)] = activeSecondary;
    const nextSecondary = partitioned.normalized.filter(
      (item) => !nextPrimary.some((primaryItem) => primaryItem.to === item.to)
    );
    return { ...partitioned, primary: nextPrimary, secondary: nextSecondary };
  }, [compactMobile, items, location.pathname]);

  const isPathActive = (to) => location.pathname === to || location.pathname.startsWith(`${to}/`);
  const secondaryActive = secondary.some((item) => isPathActive(item.to));

  useEffect(() => {
    if (typeof window === "undefined") return () => {};
    const media = window.matchMedia("(max-width: 720px)");
    const apply = () => setCompactMobile(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, secondary.length);
  }, [secondary.length]);

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
    if (!open) return () => {};
    const onFocusIn = (event) => {
      const menu = menuRef.current;
      if (!menu) return;
      if (menu.contains(event.target)) return;
      const focusable = getFocusable(menu);
      const fallback = focusable[0] || menu;
      fallback.focus?.({ preventScroll: true });
    };
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  if (!normalized.length) return null;

  return (
    <nav className="bottom-nav" role="navigation" aria-label={t("bottomNav.ariaLabel", null, "Нижняя навигация")}>
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
              <span className="bottom-nav-badge" aria-label={t("bottomNav.badgeAria", { count: it.badge }, `Новых: ${it.badge}`)}>
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
              aria-label={t("bottomNav.moreAria", null, "Ещё разделы")}
              onClick={() => setOpen((value) => !value)}
              onKeyDown={(event) => {
                if (!secondary.length) return;
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setOpen(true);
                  setActiveIndex(secondary.length - 1);
                }
                if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setOpen(true);
                  setActiveIndex(0);
                }
              }}
            >
              <MoreHorizontal className="icon nav-icon" aria-hidden="true" />
              <span>{t("common.more")}</span>
            </button>
            {open ? (
              <div
                id={menuId}
                className="bottom-nav-popover"
                role="menu"
                ref={menuRef}
                tabIndex={-1}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setOpen(false);
                    toggleRef.current?.focus();
                    return;
                  }
                  if (event.key === "Tab") {
                    const menu = menuRef.current;
                    if (!menu) return;
                    const focusable = getFocusable(menu);
                    const active = menu.contains(document.activeElement) ? document.activeElement : null;
                    const target = getPopoverTabTarget(focusable, active, event.shiftKey);
                    if (!target) return;
                    event.preventDefault();
                    target.focus?.({ preventScroll: true });
                    return;
                  }
                  if (!secondary.length) return;
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveIndex((index) => (index + 1) % secondary.length);
                    return;
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveIndex((index) => (index - 1 + secondary.length) % secondary.length);
                    return;
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
                    {it.icon ? <it.icon className="icon nav-icon" aria-hidden="true" /> : null}
                    <span>{it.label}</span>
                    {Number(it.badge) > 0 ? (
                      <span className="bottom-nav-badge" aria-label={t("bottomNav.badgeAria", { count: it.badge }, `Новых: ${it.badge}`)}>
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
    </nav>
  );
}
