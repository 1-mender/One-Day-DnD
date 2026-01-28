import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import Modal from "../components/Modal.jsx";
import { connectSocket } from "../socket.js";

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

  if (!enabled) return <div className="card"><div className="badge warn">Бестиарий отключён DM</div></div>;

  const filtered = items.filter((m) => (m.name || "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="card">
      <div style={{ fontWeight: 800, fontSize: 18 }}>Bestiary</div>
      <div className="small">Read-only для игроков</div>
      <hr />
      <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Поиск по имени…" style={{ padding: 10, borderRadius: 12, border: "1px solid #1f2a3a", background:"#0b0f14", color:"#e7eef7", width:"100%" }} />
      <div className="list" style={{ marginTop: 12 }}>
        {filtered.map((m) => (
          <div key={m.id} className="item" style={{ cursor:"pointer" }} onClick={() => { setCur(m); setOpen(true); }}>
            <div className="kv">
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
        {(cur?.images || []).map((im) => (
          <img key={im.id} src={im.url} alt="" style={{ width:"100%", borderRadius: 12, border:"1px solid #1f2a3a", marginBottom: 10 }} />
        ))}
        <pre style={{ whiteSpace:"pre-wrap", margin: 0 }}>{cur?.description}</pre>
      </Modal>
    </div>
  );
}
