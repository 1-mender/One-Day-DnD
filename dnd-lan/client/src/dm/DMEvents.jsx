import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import { useToast } from "../components/ui/ToastProvider.jsx";
import { useDebouncedValue } from "../lib/useDebouncedValue.js";
import { formatError } from "../lib/formatError.js";
import { ERROR_CODES } from "../lib/errorCodes.js";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useSocket } from "../context/SocketContext.jsx";
import { useReadOnly } from "../hooks/useReadOnly.js";
import { useQueryState } from "../hooks/useQueryState.js";
import { Copy } from "lucide-react";

const scopes = [
  { key: "", label: "Все", prefix: "" },
  { key: "player", label: "Подключения", prefix: "player." },
  { key: "join", label: "Лобби", prefix: "join." },
  { key: "inv", label: "Инвентарь", prefix: "inventory." },
  { key: "best", label: "Бестиарий", prefix: "bestiary." },
  { key: "info", label: "InfoBlocks", prefix: "info." }
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
  const toast = useToast();
  const [cleanupDays, setCleanupDays] = useState(30);
  const readOnly = useReadOnly();

  const { socket } = useSocket();

  const limit = 200;
  const debouncedQ = useDebouncedValue(q, 250);
  const prefix = scopes.find((s) => s.key === scope)?.prefix || "";
  const sinceMs = Number(sinceParam || 0);
  const offsetRef = useRef(0);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  const load = useCallback(async (reset = true) => {
    setErr("");
    setBusy(true);
    try {
      const pageOffset = reset ? 0 : offsetRef.current;
      const r = await api.dmEventsList({
        limit,
        offset: pageOffset,
        q: debouncedQ,
        prefix,
        since: Number.isFinite(sinceMs) && sinceMs > 0 ? sinceMs : undefined
      });
      const next = r.items || [];
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
      setHasMore(!!r.hasMore);
    } catch (e) {
      setErr(formatError(e, ERROR_CODES.LOAD_FAILED));
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

  const rows = useMemo(() => items.map((e) => ({
    ...e,
    _time: fmtTime(e.created_at)
  })), [items]);

  const displayRows = useMemo(() => {
    if (viewMode === "recent") return rows.slice(0, 50);
    return rows;
  }, [rows, viewMode]);

  const listRef = useRef(null);
  const rowVirtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 140,
    overscan: 8
  });

  async function copyEvent(e) {
    const text = formatEventSnippet(e);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Скопировано в буфер");
    } catch {
      window.prompt("Copy:", text);
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
      const a = document.createElement("a");
      a.href = url;
      a.download = `events_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(formatError(e, ERROR_CODES.EXPORT_FAILED));
    } finally {
      setBusy(false);
    }
  }

  async function cleanupAll() {
    if (readOnly) return;
    const first = window.confirm("Удалить ВСЕ события журнала? Это действие нельзя отменить.");
    if (!first) return;

    const phrase = window.prompt("Для подтверждения введите слово DELETE (заглавными):", "");
    if (phrase !== "DELETE") {
      toast.warn("Отменено. Неверное подтверждение.");
      return;
    }

    setErr("");
    setBusy(true);
    try {
      const r = await api.dmEventsCleanup({ mode: "all", confirm: "DELETE" });
      await load(true);
      toast.success(`Удалено: ${r.deleted}`);
    } catch (e) {
      const msg = formatError(e, ERROR_CODES.LOAD_FAILED);
      setErr(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function cleanupOlder() {
    if (readOnly) return;
    const days = Math.max(1, Math.min(3650, Math.floor(Number(cleanupDays || 30))));
    const ok = window.confirm(`Удалить события старше ${days} дней?`);
    if (!ok) return;

    setErr("");
    setBusy(true);
    try {
      const r = await api.dmEventsCleanup({ mode: "olderThanDays", days });
      await load(true);
      toast.success(`Удалено: ${r.deleted}`);
    } catch (e) {
      const msg = formatError(e, ERROR_CODES.LOAD_FAILED);
      setErr(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card taped">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 20 }}>Events</div>
          <div className="small">Минимальный журнал действий и подключений</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn secondary" onClick={() => load(true)} disabled={busy}>Refresh</button>
          <button className="btn" onClick={exportJson} disabled={busy}>Export JSON</button>
          {readOnly ? <div className="badge warn">Read-only: write disabled</div> : null}
        </div>
      </div>

      <hr />

      <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск (type/message/actor)..." style={inp} />
        <select value={scope} onChange={(e) => setScope(e.target.value)} style={sel}>
          {scopes.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <select value={viewMode} onChange={(e) => setViewMode(e.target.value)} style={sel}>
          <option value="all">Все события</option>
          <option value="recent">Последние 50</option>
        </select>
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          <button className={`btn ${!sinceMs ? "" : "secondary"}`} onClick={() => setSinceHours(0)}>
            Всё время
          </button>
          <button className={`btn ${sinceMs ? "secondary" : ""}`} onClick={() => setSinceHours(1)}>
            За 1 час
          </button>
          <button className={`btn ${sinceMs ? "secondary" : ""}`} onClick={() => setSinceHours(24)}>
            За 24 часа
          </button>
        </div>
      </div>
      {viewMode === "recent" ? (
        <div className="badge secondary" style={{ marginTop: 8 }}>Показаны последние 50 событий</div>
      ) : null}
      <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        <button className="btn danger" onClick={cleanupAll} disabled={busy || readOnly}>
          Очистить всё
        </button>
        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          <input
            type="number"
            min="1"
            max="3650"
            value={cleanupDays}
            onChange={(e) => setCleanupDays(e.target.value)}
            style={{ padding: 10, borderRadius: 12, width: 120 }}
            disabled={readOnly}
          />
          <button className="btn secondary" onClick={cleanupOlder} disabled={busy || readOnly}>
            Удалить старше X дней
          </button>
        </div>
        <div className="paper-note" style={{ maxWidth: 520 }}>
          <div className="title">Очистка</div>
          <div className="small">DM-only. Retention (20k) продолжает работать как раньше.</div>
        </div>
      </div>

      {err && <div className="badge off" style={{ marginTop: 10 }}>Ошибка: {err}</div>}

      <div
        ref={listRef}
        className="list"
        style={{ marginTop: 12, height: "70vh", overflow: "auto" }}
      >
        {displayRows.length === 0 && !busy ? (
          <div className="small">Событий пока нет.</div>
        ) : (
          <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
            {rowVirtualizer.getVirtualItems().map((vRow) => {
              const e = displayRows[vRow.index];
              return (
                <div
                  key={e.id}
                  className="item taped"
                  style={{
                    alignItems: "flex-start",
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${vRow.start}px)`
                  }}
                >
                  <div className="kv" style={{ minWidth: 170 }}>
                    <div style={{ fontWeight: 800 }}>{e._time}</div>
                    <div className="small">{e.type}</div>
                    <div className="small">
                      {e.actor_role}{e.actor_name ? ` • ${e.actor_name}` : ""}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{e.message || "—"}</div>
                    <div className="small">
                      {e.target_type ? `target: ${e.target_type}` : ""}{e.target_id ? ` #${e.target_id}` : ""}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn secondary icon-btn" onClick={() => copyEvent(e)} title="Скопировать">
                      <Copy className="icon" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {hasMore && viewMode !== "recent" && (
        <button className="btn secondary" style={{ marginTop: 12 }} onClick={() => load(false)} disabled={busy}>
          Load more
        </button>
      )}
    </div>
  );
}

function fmtTime(ts) {
  const d = new Date(Number(ts || 0));
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString();
}

const inp = { width: "min(520px, 100%)" };
const sel = {};

function formatEventSnippet(e) {
  const time = fmtTime(e?.created_at);
  const actor = e?.actor_name ? `${e.actor_role} • ${e.actor_name}` : String(e?.actor_role || "");
  const target = e?.target_type ? `${e.target_type}${e?.target_id ? ` #${e.target_id}` : ""}` : "";
  const message = e?.message || "";
  return [time, e?.type, actor, target, message].filter(Boolean).join(" | ");
}
