import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import { useToast } from "../foundation/providers/index.js";
import { useDebouncedValue } from "../lib/useDebouncedValue.js";
import { formatError } from "../lib/formatError.js";
import { ERROR_CODES } from "../lib/errorCodes.js";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useSocket } from "../context/SocketContext.jsx";
import { useReadOnly } from "../hooks/useReadOnly.js";
import { useQueryState } from "../hooks/useQueryState.js";
import { Copy } from "lucide-react";
import { t } from "../i18n/index.js";
import { ConfirmDialog, FilterBar, PageHeader, SectionCard, StatusBanner } from "../foundation/primitives/index.js";

const scopes = [
  { key: "", labelKey: "dmEvents.scopeAll", prefix: "" },
  { key: "player", labelKey: "dmEvents.scopePlayer", prefix: "player." },
  { key: "join", labelKey: "dmEvents.scopeJoin", prefix: "join." },
  { key: "inv", labelKey: "dmEvents.scopeInventory", prefix: "inventory." },
  { key: "best", labelKey: "dmEvents.scopeBestiary", prefix: "bestiary." },
  { key: "info", labelKey: "dmEvents.scopeInfo", prefix: "info." }
];

export default function DMEvents() {
  const [q, setQ] = useQueryState("q", "");
  const [scope, setScope] = useQueryState("scope", "");
  const [viewMode, setViewMode] = useQueryState("view", "all");
  const [sinceParam, setSinceParam] = useQueryState("since", "");
  const [items, setItems] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [cleanupDays, setCleanupDays] = useState(30);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [eventsOffset, setEventsOffset] = useState(340);
  const toast = useToast();
  const readOnly = useReadOnly();
  const { socket } = useSocket();
  const confirmDeletePhrase = t("dmEvents.confirmDeletePhrase");

  const limit = 200;
  const debouncedQ = useDebouncedValue(q, 250);
  const prefix = scopes.find((entry) => entry.key === scope)?.prefix || "";
  const sinceMs = Number(sinceParam || 0);
  const activeRange = !sinceMs ? "all" : (Date.now() - sinceMs <= 90 * 60 * 1000 ? "1h" : "24h");
  const offsetRef = useRef(0);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  const load = useCallback(async (reset = true) => {
    setErr("");
    setBusy(true);
    try {
      const pageOffset = reset ? 0 : offsetRef.current;
      const response = await api.dmEventsList({
        limit,
        offset: pageOffset,
        q: debouncedQ,
        prefix,
        since: Number.isFinite(sinceMs) && sinceMs > 0 ? sinceMs : undefined
      });
      const next = response.items || [];
      if (reset) {
        setItems(next);
        setOffset(next.length);
        offsetRef.current = next.length;
      } else {
        setItems((prev) => [...prev, ...next]);
        setOffset((prev) => {
          const updated = prev + next.length;
          offsetRef.current = updated;
          return updated;
        });
      }
      setHasMore(!!response.hasMore);
    } catch (error) {
      setErr(formatError(error, ERROR_CODES.LOAD_FAILED));
    } finally {
      setBusy(false);
    }
  }, [limit, debouncedQ, prefix, sinceMs]);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    load(true).catch(() => {});
  }, [load]);

  useEffect(() => {
    if (!socket) return () => {};
    const onUpdated = () => loadRef.current?.(true).catch(() => {});
    socket.on("events:updated", onUpdated);
    return () => {
      socket.off("events:updated", onUpdated);
    };
  }, [socket]);

  const rows = useMemo(() => items.map((event) => ({
    ...event,
    _time: fmtTime(event.created_at)
  })), [items]);

  const displayRows = useMemo(() => {
    if (viewMode === "recent") return rows.slice(0, 50);
    return rows;
  }, [rows, viewMode]);

  const listRef = useRef(null);
  const recalcEventsOffset = useCallback(() => {
    if (typeof window === "undefined") return;
    const root = listRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const nextOffset = Math.max(220, Math.round(rect.top + 16));
    setEventsOffset(nextOffset);
  }, []);

  useEffect(() => {
    recalcEventsOffset();
    if (typeof window === "undefined") return () => {};
    window.addEventListener("resize", recalcEventsOffset);
    window.addEventListener("orientationchange", recalcEventsOffset);
    return () => {
      window.removeEventListener("resize", recalcEventsOffset);
      window.removeEventListener("orientationchange", recalcEventsOffset);
    };
  }, [displayRows.length, recalcEventsOffset]);

  const rowVirtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 140,
    overscan: 8
  });

  async function copyEvent(eventItem) {
    const text = formatEventSnippet(eventItem);
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("dmEvents.copySuccess"));
    } catch {
      toast.warn(t("dmEvents.copyFail"));
    }
  }

  function setSinceHours(hours) {
    if (!hours) {
      setSinceParam("");
      return;
    }
    const ms = Date.now() - hours * 60 * 60 * 1000;
    setSinceParam(String(ms));
  }

  async function exportJson() {
    setErr("");
    setBusy(true);
    try {
      const blob = await api.dmEventsExportJson({
        q,
        prefix,
        since: Number.isFinite(sinceMs) && sinceMs > 0 ? sinceMs : undefined
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `events_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErr(formatError(error, ERROR_CODES.EXPORT_FAILED));
    } finally {
      setBusy(false);
    }
  }

  async function runCleanup(payload) {
    setErr("");
    setBusy(true);
    try {
      const response = await api.dmEventsCleanup(payload);
      await load(true);
      toast.success(t("dmEvents.cleanupDeleted", { count: response.deleted }));
    } catch (error) {
      const message = formatError(error, ERROR_CODES.LOAD_FAILED);
      setErr(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmCleanup() {
    if (!confirmDialog || readOnly) return;
    if (confirmDialog.mode === "all") {
      if (confirmDialog.phrase !== confirmDeletePhrase) {
        toast.warn(t("dmEvents.cleanupNeedDelete"));
        return;
      }
      await runCleanup({ mode: "all", confirm: confirmDeletePhrase });
      setConfirmDialog(null);
      return;
    }
    if (confirmDialog.mode === "older") {
      await runCleanup({ mode: "olderThanDays", days: confirmDialog.days });
      setConfirmDialog(null);
    }
  }

  function cleanupAll() {
    if (readOnly) return;
    setConfirmDialog({ mode: "all", phrase: "", days: 0 });
  }

  function cleanupOlder() {
    if (readOnly) return;
    const days = Math.max(1, Math.min(3650, Math.floor(Number(cleanupDays || 30))));
    setConfirmDialog({ mode: "older", phrase: "", days });
  }

  return (
    <div className="card taped tf-shell tf-dm-events-shell">
      <PageHeader
        title={t("dmEvents.title")}
        subtitle={t("dmEvents.subtitle")}
        actions={(
          <>
            <button className="btn secondary" onClick={() => load(true)} disabled={busy}>{t("dmEvents.refresh")}</button>
            <button className="btn" onClick={exportJson} disabled={busy}>{t("dmEvents.exportJson")}</button>
          </>
        )}
      />
      <hr />

      {readOnly ? <StatusBanner tone="warning">{t("dmEvents.readOnly")}</StatusBanner> : null}

      <FilterBar className="dm-events-toolbar">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("dmEvents.searchPlaceholder")} aria-label="Поиск по журналу событий" className="u-w-min-520" />
        <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Фильтр источника событий">
          {scopes.map((entry) => (
            <option key={entry.key} value={entry.key}>{t(entry.labelKey)}</option>
          ))}
        </select>
        <select value={viewMode} onChange={(e) => setViewMode(e.target.value)} aria-label="Режим просмотра журнала">
          <option value="all">{t("dmEvents.viewAll")}</option>
          <option value="recent">{t("dmEvents.viewRecent")}</option>
        </select>
        <div className="row u-row-gap-6 u-row-wrap tf-segmented dm-events-range">
          <button className={`btn tf-segmented-btn ${activeRange === "all" ? "tf-segmented-btn-active" : "secondary"}`} onClick={() => setSinceHours(0)}>
            {t("dmEvents.rangeAll")}
          </button>
          <button className={`btn tf-segmented-btn ${activeRange === "1h" ? "tf-segmented-btn-active" : "secondary"}`} onClick={() => setSinceHours(1)}>
            {t("dmEvents.range1h")}
          </button>
          <button className={`btn tf-segmented-btn ${activeRange === "24h" ? "tf-segmented-btn-active" : "secondary"}`} onClick={() => setSinceHours(24)}>
            {t("dmEvents.range24h")}
          </button>
        </div>
      </FilterBar>

      {viewMode === "recent" ? (
        <div className="badge secondary u-mt-8">{t("dmEvents.recentHint")}</div>
      ) : null}

      <SectionCard
        className="u-mt-10 dm-events-cleanup-card"
        title={t("dmEvents.cleanupTitle")}
        subtitle={t("dmEvents.cleanupHint")}
        actions={(
          <FilterBar>
            <button className="btn danger" onClick={cleanupAll} disabled={busy || readOnly}>
              {t("dmEvents.cleanupAll")}
            </button>
            <div className="row u-row-gap-8 u-row-center-wrap">
              <input
                type="number"
                min="1"
                max="3650"
                value={cleanupDays}
                onChange={(e) => setCleanupDays(e.target.value)}
                aria-label="Удалить события старше N дней"
                className="u-number-input"
                disabled={readOnly}
              />
              <button className="btn secondary" onClick={cleanupOlder} disabled={busy || readOnly}>
                {t("dmEvents.cleanupOlder")}
              </button>
            </div>
          </FilterBar>
        )}
      />

      {err ? <div className="badge off u-mt-10">{t("common.error")}: {err}</div> : null}

      <div ref={listRef} className="list events-list tf-panel dm-events-list" style={{ "--events-offset": `${eventsOffset}px` }}>
        {displayRows.length === 0 && !busy ? (
          <div className="small">{t("dmEvents.empty")}</div>
        ) : (
          <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
            {rowVirtualizer.getVirtualItems().map((vRow) => {
              const eventItem = displayRows[vRow.index];
              return (
                <div
                  key={eventItem.id}
                  className="item taped dm-events-item"
                  style={{
                    alignItems: "flex-start",
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${vRow.start}px)`
                  }}
                >
                  <div className="kv u-minw-170">
                    <div className="u-fw-800">{eventItem._time}</div>
                    <div className="small">{eventItem.type}</div>
                    <div className="small">
                      {eventItem.actor_role}{eventItem.actor_name ? ` • ${eventItem.actor_name}` : ""}
                    </div>
                  </div>
                  <div className="u-flex-1">
                    <div className="u-fw-700">{eventItem.message || t("common.notAvailable")}</div>
                    <div className="small">
                      {eventItem.target_type ? `${t("dmEvents.targetLabel")} ${eventItem.target_type}` : ""}
                      {eventItem.target_id ? ` #${eventItem.target_id}` : ""}
                    </div>
                  </div>
                  <div className="row u-row-gap-6">
                    <button
                      className="btn secondary icon-btn"
                      onClick={() => copyEvent(eventItem)}
                      title={t("dmEvents.copyButton")}
                      aria-label={t("dmEvents.copyButton")}
                    >
                      <Copy className="icon" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {hasMore && viewMode !== "recent" ? (
        <button className="btn secondary u-mt-12" onClick={() => load(false)} disabled={busy}>
          {t("dmEvents.loadMore")}
        </button>
      ) : null}

      <ConfirmDialog
        open={!!confirmDialog}
        title={confirmDialog?.mode === "all" ? t("dmEvents.confirmAllTitle") : t("dmEvents.confirmOlderTitle")}
        message={confirmDialog?.mode === "all" ? t("dmEvents.confirmAllBody") : t("dmEvents.confirmOlderBody", { days: confirmDialog?.days ?? 0 })}
        onCancel={() => setConfirmDialog(null)}
        onConfirm={confirmCleanup}
        confirmLabel={t("common.confirm")}
        confirmDisabled={busy || readOnly}
      >
        {confirmDialog?.mode === "all" ? (
          <>
            <div className="small">{t("dmEvents.confirmAllTypeDelete", { phrase: confirmDeletePhrase })}</div>
            <input
              value={confirmDialog?.phrase || ""}
              onChange={(e) => setConfirmDialog((prev) => ({ ...(prev || {}), phrase: e.target.value }))}
              placeholder={confirmDeletePhrase}
              aria-label="Подтверждение удаления событий"
              className="u-w-full"
              autoFocus
              disabled={readOnly}
            />
          </>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

function fmtTime(ts) {
  const date = new Date(Number(ts || 0));
  if (!Number.isFinite(date.getTime())) return t("common.notAvailable");
  return date.toLocaleString();
}

function formatEventSnippet(eventItem) {
  const time = fmtTime(eventItem?.created_at);
  const actor = eventItem?.actor_name ? `${eventItem.actor_role} • ${eventItem.actor_name}` : String(eventItem?.actor_role || "");
  const target = eventItem?.target_type ? `${eventItem.target_type}${eventItem?.target_id ? ` #${eventItem.target_id}` : ""}` : "";
  const message = eventItem?.message || "";
  return [time, eventItem?.type, actor, target, message].filter(Boolean).join(" | ");
}

