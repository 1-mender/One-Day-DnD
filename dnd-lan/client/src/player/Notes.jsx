import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import Modal from "../components/Modal.jsx";
import { connectSocket } from "../socket.js";
import MarkdownView from "../components/markdown/MarkdownView.jsx";

export default function Notes() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState(null);
  const socket = useMemo(() => connectSocket({ role: "player" }), []);

  async function load() {
    const r = await api.infoBlocks();
    setItems(r.items || []);
  }

  useEffect(() => {
    load().catch(()=>{});
    socket.on("infoBlocks:updated", () => load().catch(()=>{}));
    return () => socket.disconnect();
  }, []);

  const filtered = items.filter((b) => (b.title || "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="card">
      <div style={{ fontWeight: 800, fontSize: 18 }}>Notes</div>
      <div className="small">Показываются только доступные вам блоки</div>
      <hr />
      <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Поиск..." style={{ width:"100%" }} />
      <div className="list" style={{ marginTop: 12 }}>
        {filtered.map((b) => (
          <div key={b.id} className="item" onClick={() => { setCur(b); setOpen(true); }} style={{ cursor:"pointer" }}>
            <div className="kv">
              <div style={{ fontWeight: 700 }}>{b.title}</div>
              <div className="small">{b.category} • {b.access}</div>
            </div>
            <span className="badge">Открыть</span>
          </div>
        ))}
      </div>

      <Modal open={open} title={cur?.title || ""} onClose={() => setOpen(false)}>
        <div className="small">Категория: {cur?.category}</div>
        <hr />
        <MarkdownView source={cur?.content} />
      </Modal>
    </div>
  );
}
