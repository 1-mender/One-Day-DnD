import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { connectSocket } from "../socket.js";

export default function DMLobby() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const socket = useMemo(() => connectSocket({ role: "dm" }), []);

  async function load() {
    const r = await api.dmRequests();
    setItems(r.items || []);
  }

  useEffect(() => {
    load().catch(()=>{});
    socket.on("player:joinRequested", () => load().catch(()=>{}));
    return () => socket.disconnect();
  }, []);

  async function approve(id) {
    setErr("");
    try { await api.dmApprove(id); await load(); } catch (e) { setErr(e.body?.error || e.message); }
  }
  async function reject(id) {
    setErr("");
    try { await api.dmReject(id); await load(); } catch (e) { setErr(e.body?.error || e.message); }
  }
  async function ban(id) {
    setErr("");
    try { await api.dmBan(id); await load(); } catch (e) { setErr(e.body?.error || e.message); }
  }

  return (
    <div className="card">
      <div style={{ fontWeight: 900, fontSize: 20 }}>Лобби / Подключения</div>
      <div className="small">Заявки на вход: принять / отклонить / заблокировать IP</div>
      <hr />
      {err && <div className="badge off">Ошибка: {err}</div>}
      <div className="list">
        {items.length === 0 && <div className="badge warn">Нет заявок</div>}
        {items.map((r) => (
          <div key={r.id} className="item">
            <div className="kv">
              <div style={{ fontWeight: 800 }}>{r.display_name}</div>
              <div className="small">{new Date(r.created_at).toLocaleTimeString()} • {r.ip || "ip?"}</div>
              <div className="small">{(r.user_agent || "").slice(0, 80)}</div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn" onClick={() => approve(r.id)}>Принять</button>
              <button className="btn secondary" onClick={() => reject(r.id)}>Отклонить</button>
              <button className="btn danger" onClick={() => ban(r.id)}>Заблок.</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
