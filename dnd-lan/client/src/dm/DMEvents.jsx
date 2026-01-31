import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import { connectSocket } from "../socket.js";
import { useToast } from "../components/ui/ToastProvider.jsx";
import { useDebouncedValue } from "../lib/useDebouncedValue.js";
import { formatError } from "../lib/formatError.js";
import { ERROR_CODES } from "../lib/errorCodes.js";
import { useVirtualizer } from "@tanstack/react-virtual";

const scopes = [
  { key: "", label: "All", prefix: "" },
  { key: "player", label: "Connections", prefix: "player." },
  { key: "join", label: "Lobby", prefix: "join." },
  { key: "inv", label: "Inventory", prefix: "inventory." },
  { key: "best", label: "Bestiary", prefix: "bestiary." },
  { key: "info", label: "InfoBlocks", prefix: "info." }
];

export default function DMEvents() {
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("");
  const [items, setItems] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const toast = useToast();
  const [cleanupDays, setCleanupDays] = useState(30);

  const socket = useMemo(() => connectSocket({ role: "dm" }), []);

  const limit = 200;
  const debouncedQ = useDebouncedValue(q, 250);
  const prefix = scopes.find((s) => s.key === scope)?.prefix || "";
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
        prefix
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
  }, [limit, debouncedQ, prefix]);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    load(true).catch(() => {});
  }, [load]);

  useEffect(() => {
    const onUpdated = () => loadRef.current?.(true).catch(() => {});
    socket.on("events:updated", onUpdated);
    return () => {
      socket.off("events:updated", onUpdated);
      socket.disconnect();
    };
  }, [socket]);

  const rows = useMemo(() => items.map((e) => ({
    ...e,
    _time: fmtTime(e.created_at)
  })), [items]);

  const listRef = useRef(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 140,
    overscan: 8
  });

  async function exportJson() {
    setErr("");
    setBusy(true);
    try {
      const blob = await api.dmEventsExportJson({ q, prefix });
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
      </div>
      <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        <button className="btn danger" onClick={cleanupAll} disabled={busy}>
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
          />
          <button className="btn secondary" onClick={cleanupOlder} disabled={busy}>
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
        {rows.length === 0 && !busy ? (
          <div className="small">Событий пока нет.</div>
        ) : (
          <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
            {rowVirtualizer.getVirtualItems().map((vRow) => {
              const e = rows[vRow.index];
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      {hasMore && (
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
