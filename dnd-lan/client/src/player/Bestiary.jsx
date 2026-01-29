import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import Modal from "../components/Modal.jsx";
import { connectSocket } from "../socket.js";
import MarkdownView from "../components/markdown/MarkdownView.jsx";
import PolaroidFrame from "../components/vintage/PolaroidFrame.jsx";

export default function Bestiary() {
  const [enabled, setEnabled] = useState(false);
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [cur, setCur] = useState(null);
  const [open, setOpen] = useState(false);
  const socket = useMemo(() => connectSocket({ role: "player" }), []);

  async function load() {
    const r = await api.bestiary();
    setEnabled(!!r.enabled);
    setItems(r.items || []);
  }

  useEffect(() => {
    load().catch(()=>{});
    socket.on("bestiary:updated", () => load().catch(()=>{}));
    socket.on("settings:updated", () => load().catch(()=>{}));
    return () => socket.disconnect();
  }, []);

  if (!enabled) return <div className="card taped"><div className="badge warn">Бестиарий отключён DM</div></div>;

  const filtered = items.filter((m) => (m.name || "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="card taped">
      <div style={{ fontWeight: 800, fontSize: 18 }}>Bestiary</div>
      <div className="small">Read-only для игроков</div>
      <hr />
  <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Поиск по имени..." style={{ width:"100%" }} />
      <div className="list" style={{ marginTop: 12 }}>
        {filtered.map((m) => (
          <div key={m.id} className="item taped" style={{ cursor:"pointer", alignItems: "stretch" }} onClick={() => { setCur(m); setOpen(true); }}>
            <PolaroidFrame src={m.images?.[0]?.url} alt={m.name} fallback="МОН" />
            <div className="kv" style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{m.name}</div>
              <div className="small">{m.type || "—"} • CR: {m.cr || "—"}</div>
            </div>
            <span className="badge">Открыть</span>
          </div>
        ))}
      </div>

      <Modal open={open} title={cur?.name || ""} onClose={() => setOpen(false)}>
        <div className="small">Type: {cur?.type || "—"} • Habitat: {cur?.habitat || "—"} • CR: {cur?.cr || "—"}</div>
        <hr />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12, marginBottom: 10 }}>
          {(cur?.images || []).map((im) => (
            <PolaroidFrame key={im.id} src={im.url} alt="" fallback="IMG" className="lg" />
          ))}
        </div>
        <MarkdownView source={cur?.description} />
      </Modal>
    </div>
  );
}
