import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import Modal from "../components/Modal.jsx";
import MarkdownView from "../components/markdown/MarkdownView.jsx";
import PolaroidFrame from "../components/vintage/PolaroidFrame.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { useLiteMode } from "../hooks/useLiteMode.js";
import { useDebouncedValue } from "../lib/useDebouncedValue.js";

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
  const dq = useDebouncedValue(q, 250);

  const attachImages = useCallback(async (list, limitPer = 1) => {
    const ids = (list || []).map((m) => m.id).filter(Boolean);
    if (!ids.length) return;
    try {
      const r = await api.bestiaryImagesBatch(ids, { limitPer });
      const map = new Map((r.items || []).map((x) => [x.monsterId, x.images || []]));
      setItems((prev) => prev.map((m) => (map.has(m.id) ? { ...m, images: map.get(m.id) } : m)));
    } catch {
      // ignore
    }
  }, []);

  const load = useCallback(async () => {
    const r = await api.bestiaryPage({ limit: 120, q: dq });
    setEnabled(!!r.enabled);
    setItems(r.items || []);
    setNextCursor(r.nextCursor || null);
    await attachImages(r.items || [], 1);
  }, [attachImages, dq]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const r = await api.bestiaryPage({ limit: 120, q: dq, cursor: nextCursor });
      setEnabled(!!r.enabled);
      setItems((prev) => [...prev, ...(r.items || [])]);
      setNextCursor(r.nextCursor || null);
      await attachImages(r.items || [], 1);
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
  const gridCols = lite ? "repeat(auto-fill, minmax(120px, 1fr))" : "repeat(auto-fill, minmax(170px, 1fr))";

  if (!enabled) return <div className="card taped"><div className="badge warn">Бестиарий отключён DM</div></div>;

  return (
    <div className={`card taped bestiary-shell${lite ? " page-lite" : ""}`.trim()}>
      <div style={{ fontWeight: 800, fontSize: 18 }}>Bestiary</div>
      <div className="small">Read-only для игроков</div>
      <hr />
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Поиск по имени..." style={{ width:"100%" }} />
      <div className="bestiary-list" style={{ marginTop: 12 }}>
        {items.map((m) => {
          const thumb = (m.name || "??").slice(0, 2).toUpperCase();
          return (
            <div
              key={m.id}
              className="item taped bestiary-card"
              style={{ cursor:"pointer", alignItems: "stretch" }}
              onClick={async () => {
                setCurId(m.id);
                setOpen(true);
                await attachImages([m], 12);
              }}
            >
              {lite ? (
                <div className="bestiary-thumb" aria-hidden="true">{thumb}</div>
              ) : (
                <PolaroidFrame src={m.images?.[0]?.url} alt={m.name} fallback="МОН" className="sm" />
              )}
              <div className="kv" style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{m.name}</div>
                <div className="small">{m.type || "—"} • CR: {m.cr || "—"}</div>
              </div>
              <span className="badge">Открыть</span>
            </div>
          );
        })}
      </div>
      {nextCursor && (
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn secondary" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Загрузка..." : "Показать ещё"}
          </button>
        </div>
      )}

      <Modal open={open} title={cur?.name || ""} onClose={() => { setOpen(false); setCurId(null); }}>
        <div className="small">Type: {cur?.type || "—"} • Habitat: {cur?.habitat || "—"} • CR: {cur?.cr || "—"}</div>
        <hr />
        <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12, marginBottom: 10 }}>
          {gallery.map((im) => (
            <PolaroidFrame key={im.id} src={im.url} alt="" fallback="IMG" className={lite ? "sm" : "lg"} />
          ))}
        </div>
        <MarkdownView source={cur?.description} />
      </Modal>
    </div>
  );
}

