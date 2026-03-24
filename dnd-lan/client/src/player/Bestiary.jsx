import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import Modal from "../components/Modal.jsx";
import MarkdownView from "../components/markdown/MarkdownView.jsx";
import PolaroidFrame from "../components/vintage/PolaroidFrame.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { useLiteMode } from "../hooks/useLiteMode.js";
import { useDebouncedValue } from "../lib/useDebouncedValue.js";
import { t } from "../i18n/index.js";
import useOnScreen from "../hooks/useOnScreen.js";
import { useVirtualizer } from "@tanstack/react-virtual";

export default function Bestiary() {
  const [enabled, setEnabled] = useState(false);
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [nextCursor, setNextCursor] = useState(null);
  const [curId, setCurId] = useState(null);
  const [open, setOpen] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const { socket } = useSocket();
  const lite = useLiteMode();
  const isNarrowScreen = useIsNarrowScreen();
  const dq = useDebouncedValue(q, 250);

  const attachImages = useCallback(async (list, limitPer = 1) => {
    const ids = (list || []).map((m) => m.id).filter(Boolean);
    if (!ids.length) return;
    try {
      const r = await api.bestiaryImagesBatch(ids, { limitPer });
      // support both grouped (object) and legacy array shapes
      const map = new Map();
      if (Array.isArray(r.items)) {
        for (const x of r.items) map.set(x.monsterId || x.id, x.images || []);
      } else if (r.items && typeof r.items === "object") {
        for (const [k, arr] of Object.entries(r.items)) map.set(Number(k), arr || []);
      }
      if (map.size) setItems((prev) => prev.map((m) => (map.has(m.id) ? { ...m, images: map.get(m.id) } : m)));
    } catch {
      // ignore
    }
  }, []);

  const load = useCallback(async () => {
    const r = await api.bestiaryPage({ limit: 120, q: dq });
    setEnabled(!!r.enabled);
    setItems(r.items || []);
    setNextCursor(r.nextCursor || null);
    // load thumbnails for first batch to show initial images quickly
    await attachImages((r.items || []).slice(0, 12), 1);
  }, [attachImages, dq]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const r = await api.bestiaryPage({ limit: 120, q: dq, cursor: nextCursor });
      setEnabled(!!r.enabled);
      setItems((prev) => [...prev, ...(r.items || [])]);
      setNextCursor(r.nextCursor || null);
      // attach thumbnails for next page's leading items
      await attachImages((r.items || []).slice(0, 12), 1);
    } finally {
      setLoadingMore(false);
    }
  }, [attachImages, dq, nextCursor]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  useEffect(() => {
    if (!socket) return () => {};
    const onUpdated = () => load().catch(() => {});
    const onSettings = () => load().catch(() => {});
    socket.on("bestiary:updated", onUpdated);
    socket.on("settings:updated", onSettings);
    return () => {
      socket.off("bestiary:updated", onUpdated);
      socket.off("settings:updated", onSettings);
    };
  }, [load, socket]);


  const cur = useMemo(() => items.find((m) => m.id === curId) || null, [curId, items]);
  const gallery = lite ? (cur?.images || []).slice(0, 1) : (cur?.images || []);
  const gridCols = lite || isNarrowScreen ? "repeat(auto-fill, minmax(120px, 1fr))" : "repeat(auto-fill, minmax(170px, 1fr))";

  if (!enabled) return <div className="card taped"><div className="badge warn">{t("bestiary.disabled", null, "Бестиарий отключён DM")}</div></div>;

  return (
    <div className={`card taped bestiary-shell tf-shell tf-bestiary-shell${lite ? " page-lite" : ""}`.trim()}>
      <div className="bestiary-head tf-page-head">
        <div className="bestiary-head-main tf-page-head-main">
          <div className="tf-overline">Field Compendium</div>
          <div className="bestiary-title tf-page-title">{t("bestiary.title", null, "Бестиарий")}</div>
          <div className="small">{t("bestiary.readOnly", null, "Режим только чтения для игроков")}</div>
        </div>
        <div className="bestiary-head-meta">
          <span className="badge secondary">Монстров: {items.length}</span>
        </div>
      </div>

      <div className="bestiary-toolbar tf-panel tf-command-bar">
        <div className="tf-section-copy">
          <div className="tf-section-kicker">Search archive</div>
          <div className="bestiary-toolbar-title">Поиск и обзор</div>
        </div>
        <input
          className="bestiary-search"
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          placeholder={t("bestiary.search", null, "Поиск по имени...")}
          aria-label="Поиск монстров по имени"
        />
      </div>

      <div className="bestiary-list tf-bestiary-list" style={{ marginTop: 12 }}>
        {isNarrowScreen ? (
          <div className="list">
            {items.map((m) => {
              const thumb = (m.name || "??").slice(0, 2).toUpperCase();
              return (
                <MonsterCard
                  key={m.id}
                  m={m}
                  lite={lite}
                  thumb={thumb}
                  onOpen={async () => {
                    setCurId(m.id);
                    setOpen(true);
                    await attachImages([m], 12);
                  }}
                  attachImages={attachImages}
                />
              );
            })}
          </div>
        ) : (
          <VirtualizedList
            items={items}
            lite={lite}
            onOpen={async (m) => {
              setCurId(m.id);
              setOpen(true);
              await attachImages([m], 12);
            }}
            attachImages={attachImages}
          />
        )}
      </div>
      {nextCursor && (
        <div className="row bestiary-more-row" style={{ marginTop: 10 }}>
          <button className="btn secondary" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? t("common.loading") : t("bestiary.showMore", null, "Показать ещё")}
          </button>
        </div>
      )}

      <Modal open={open} title={cur?.name || ""} onClose={() => { setOpen(false); setCurId(null); }}>
        <div className="bestiary-modal">
        <div className="small bestiary-modal-meta">
          {t("bestiary.meta", {
            type: cur?.type || "—",
            habitat: cur?.habitat || "—"
          }, `Тип: ${cur?.type || "—"} • Среда: ${cur?.habitat || "—"}`)}
        </div>
        <div className="bestiary-modal-threat">
          <span className="small">{t("bestiary.threatLabel", null, "Угроза")}</span>
          <ThreatBadge cr={cur?.cr} />
        </div>
        <hr />
        <div className="bestiary-gallery" style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12, marginBottom: 10 }}>
          {gallery.map((im) => (
            <PolaroidFrame key={im.id} src={im.url} alt="" fallback="IMG" className={lite ? "sm" : "lg"} />
          ))}
        </div>
        <div className="bestiary-modal-body">
          <MarkdownView source={cur?.description} />
        </div>
        </div>
      </Modal>
    </div>
  );
}

function useIsNarrowScreen(maxWidth = 720) {
  const [isNarrow, setIsNarrow] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${maxWidth}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return () => {};
    const media = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const apply = () => setIsNarrow(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [maxWidth]);

  return isNarrow;
}

function VirtualizedList({ items, lite, onOpen, attachImages }) {
  const parentRef = useRef(null);
  const [listHeight, setListHeight] = useState(600);
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 140,
    overscan: 6
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    const refreshHeight = () => {
      const node = parentRef.current;
      if (!node || typeof window === "undefined") return;
      const viewportHeight = window.visualViewport?.height || window.innerHeight || 0;
      const rect = node.getBoundingClientRect();
      const bottomNav = getBottomNavHeight();
      const available = Math.floor(viewportHeight - rect.top - bottomNav - 20);
      const nextHeight = Math.max(260, Math.min(760, available || 0));
      setListHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    };

    const visualViewport = window.visualViewport || null;
    const frame = window.requestAnimationFrame(refreshHeight);
    window.addEventListener("resize", refreshHeight);
    window.addEventListener("orientationchange", refreshHeight);
    visualViewport?.addEventListener("resize", refreshHeight);
    visualViewport?.addEventListener("scroll", refreshHeight);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", refreshHeight);
      window.removeEventListener("orientationchange", refreshHeight);
      visualViewport?.removeEventListener("resize", refreshHeight);
      visualViewport?.removeEventListener("scroll", refreshHeight);
    };
  }, [items.length]);

  useEffect(() => {
    if (!virtualItems.length) return;
    const toLoad = [];
    for (const vi of virtualItems) {
      const m = items[vi.index];
      if (m && !(m.images && m.images.length)) toLoad.push(m);
    }
    if (toLoad.length) attachImages(toLoad, 1).catch(() => {});
  }, [virtualItems, items, attachImages]);

  return (
    <div
      ref={parentRef}
      className="bestiary-virtual-list"
      style={{
        height: listHeight,
        maxHeight: "calc(100dvh - var(--bottom-nav-h) - env(safe-area-inset-bottom) - 24px)",
        overflow: "auto",
        overscrollBehavior: "contain"
      }}
    >
      <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
        {virtualItems.map((vi) => {
          const m = items[vi.index];
          if (!m) return null;
          const thumb = (m.name || "??").slice(0, 2).toUpperCase();
          return (
            <div key={m.id} style={{ position: "absolute", top: vi.start, left: 0, width: "100%", height: vi.size }}>
              <MonsterCard m={m} lite={lite} thumb={thumb} onOpen={() => onOpen(m)} attachImages={attachImages} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getBottomNavHeight() {
  if (typeof window === "undefined") return 90;
  const raw = window.getComputedStyle(document.documentElement).getPropertyValue("--bottom-nav-h");
  const n = Number.parseFloat(raw);
  if (Number.isFinite(n) && n > 0) return n;
  return 90;
}

function MonsterCard({ m, lite, thumb, onOpen, attachImages }) {
  // lazy-load images for this monster when it enters viewport
  // use a small threshold so images load slightly before visible
  const [ref, visible] = useOnScreen({ root: null, rootMargin: "100px", threshold: 0.1 });

  useEffect(() => {
    if (visible && !(m.images && m.images.length)) {
      attachImages([m], 1).catch(() => {});
    }
  }, [visible, m, attachImages]);

  return (
    <div
      ref={ref}
      className="item taped bestiary-card tf-monster-card"
      style={{ cursor: "pointer", alignItems: "stretch" }}
      onClick={onOpen}
    >
      {lite ? (
        <div className="bestiary-thumb tf-monster-thumb" aria-hidden="true">{thumb}</div>
      ) : (
        <PolaroidFrame src={m.images?.[0]?.thumbUrl || m.images?.[0]?.url} alt={m.name} fallback="МОН" className="sm" />
      )}
      <div className="kv bestiary-card-copy" style={{ flex: 1 }}>
        <div className="bestiary-card-name">{m.name}</div>
        <div className="small">{m.type || "—"}</div>
        <ThreatBadge cr={m.cr} compact />
      </div>
      <span className="badge secondary">{t("bestiary.open", null, "Открыть")}</span>
    </div>
  );
}

function parseCrValue(raw) {
  const value = String(raw || "").trim();
  if (!value) return NaN;
  if (value.includes("/")) {
    const [left, right] = value.split("/").map((part) => Number(part.trim()));
    if (Number.isFinite(left) && Number.isFinite(right) && right > 0) return left / right;
    return NaN;
  }
  const normalized = value.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function getThreatBand(cr) {
  const value = parseCrValue(cr);
  if (!Number.isFinite(value) || value < 0) {
    return { tone: "gray", icon: "?", label: t("bestiary.threatUnknown", null, "Неясно") };
  }
  if (value <= 1) {
    return { tone: "green", icon: "☠", label: t("bestiary.threatLow", null, "Низкая") };
  }
  if (value <= 4) {
    return { tone: "orange", icon: "☠☠", label: t("bestiary.threatMedium", null, "Опасная") };
  }
  return { tone: "red", icon: "☠☠☠", label: t("bestiary.threatHigh", null, "Критическая") };
}

function ThreatBadge({ cr, compact = false }) {
  const band = getThreatBand(cr);
  return (
    <span className={`bestiary-threat bestiary-threat-${band.tone}${compact ? " compact" : ""}`.trim()}>
      <span className="bestiary-threat-icon" aria-hidden="true">{band.icon}</span>
      <span className="bestiary-threat-text">{band.label}</span>
    </span>
  );
}

